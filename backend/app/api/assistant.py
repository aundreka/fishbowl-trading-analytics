from fastapi import APIRouter

from app.ai.openrouter_client import ask_openrouter
from app.schemas.trade import AiQuestion

router = APIRouter()


@router.post("/ask")
def ask_assistant(payload: AiQuestion):
    response = ask_openrouter(payload.question, {"metrics": payload.metrics} if payload.metrics else None)
    return response
