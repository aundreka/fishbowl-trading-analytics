from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analytics, assets, auth, backtest, strategies, users
from app.api.assistant import router as assistant_router
from app.config import APP_NAME
from app.db.init_db import initialize_data_store

app = FastAPI(
    title=APP_NAME,
    description="Backend API for trading strategy backtesting and performance analytics.",
    version="1.0.0",
)

initialize_data_store()

# Allow frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Fishbowl Trading Analytics API is running.",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "fishbowl-backend",
    }


app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(assets.router, prefix="/api/assets", tags=["Assets"])
app.include_router(strategies.router, prefix="/api/strategies", tags=["Strategies"])
app.include_router(backtest.router, prefix="/api/backtest", tags=["Backtest"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(assistant_router, prefix="/api/assistant", tags=["Assistant"])
