from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.db.database import next_id, read_store, write_store
from app.schemas.user import UserCreate, UserUpdate
from app.utils.security import hash_password

router = APIRouter()


@router.get("/")
def get_users():
    store = read_store()
    users = [{k: v for k, v in user.items() if k != "password_hash"} for user in store["users"]]
    return {"users": users}


@router.post("/")
def create_user(payload: UserCreate):
    store = read_store()
    user = {
        "user_id": next_id(store, "users", "user_id"),
        "full_name": payload.full_name,
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "role": payload.role,
        "created_at": datetime.utcnow().isoformat(),
    }
    store["users"].append(user)
    write_store(store)
    return {"message": "User created.", "user": {k: v for k, v in user.items() if k != "password_hash"}}


@router.put("/{user_id}")
def update_user(user_id: int, payload: UserUpdate):
    store = read_store()
    user = next((row for row in store["users"] if row["user_id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    for key, value in payload.model_dump(exclude_none=True).items():
        user[key] = value
    write_store(store)
    return {"message": "User updated.", "user": {k: v for k, v in user.items() if k != "password_hash"}}


@router.delete("/{user_id}")
def delete_user(user_id: int):
    store = read_store()
    before = len(store["users"])
    store["users"] = [row for row in store["users"] if row["user_id"] != user_id]
    if len(store["users"]) == before:
        raise HTTPException(status_code=404, detail="User not found.")
    write_store(store)
    return {"message": "User deleted."}
