from pathlib import Path
import os

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional local convenience
    def load_dotenv(*_args, **_kwargs):
        return False

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR.parent / ".env.local", override=True)

DATA_DIR = (BASE_DIR / "backend_data").resolve()
raw_store_path = Path(os.getenv("APP_STORAGE_PATH", "backend/backend_data/store.json"))
STORE_PATH = raw_store_path if raw_store_path.is_absolute() else (BASE_DIR.parent / raw_store_path).resolve()
APP_NAME = "Fishbowl Trading Analytics API"
TOKEN_SALT = os.getenv("TOKEN_SALT", "fishbowl-dev-salt")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemma-4-31b-it:free")
OPENROUTER_API_URL = os.getenv("OPENROUTER_API_URL", "https://openrouter.ai/api/v1/chat/completions")
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "Fishbowl Trading Analytics")
OPENROUTER_TIMEOUT_SECONDS = int(os.getenv("OPENROUTER_TIMEOUT_SECONDS", "30"))
