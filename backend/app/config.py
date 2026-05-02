from pathlib import Path
import os


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "backend_data"
STORE_PATH = Path(os.getenv("APP_STORAGE_PATH", DATA_DIR / "store.json"))
QWEN_API_KEY = os.getenv("QWEN_API_KEY", "")
APP_NAME = "Fishbowl Trading Analytics API"
TOKEN_SALT = os.getenv("TOKEN_SALT", "fishbowl-dev-salt")
