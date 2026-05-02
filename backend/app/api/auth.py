from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.db.database import next_id, read_store, write_store
from app.schemas.user import UserCreate, UserLogin
from app.utils.security import create_token, hash_password, verify_password

router = APIRouter()


@router.post("/register")
def register(payload: UserCreate):
    store = read_store()
    if any(user["email"].lower() == payload.email.lower() for user in store["users"]):
        raise HTTPException(status_code=400, detail="Email already exists.")

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
    return {"message": "User registered successfully.", "user": {k: v for k, v in user.items() if k != "password_hash"}}


@router.post("/login")
def login(payload: UserLogin):
    store = read_store()
    user = next((row for row in store["users"] if row["email"].lower() == payload.email.lower()), None)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_token()
    store["sessions"].append({"token": token, "user_id": user["user_id"], "created_at": datetime.utcnow().isoformat()})
    write_store(store)
    return {
        "message": "Login successful.",
        "token": token,
        "user": {k: v for k, v in user.items() if k != "password_hash"},
    }
