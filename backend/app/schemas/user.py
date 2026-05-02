from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: str
    password: str = Field(min_length=6, max_length=100)
    role: str = "user"


class UserLogin(BaseModel):
    email: str
    password: str


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: str | None = None
