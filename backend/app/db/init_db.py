from app.db.database import ensure_store


def initialize_data_store() -> None:
    ensure_store()
