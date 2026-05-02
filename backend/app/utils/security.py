from __future__ import annotations

import hashlib
import secrets

from app.config import TOKEN_SALT


def hash_password(password: str) -> str:
    return hashlib.sha256(f"{TOKEN_SALT}:{password}".encode("utf-8")).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


def create_token() -> str:
    return secrets.token_urlsafe(24)
