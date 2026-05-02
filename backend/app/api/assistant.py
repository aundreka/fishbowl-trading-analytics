from fastapi import APIRouter

from app.ai.qwen_client import ask_qwen
from app.schemas.trade import AiQuestion

router = APIRouter()


@router.post("/ask")
def ask_assistant(payload: AiQuestion):
    response = ask_qwen(payload.question, {"metrics": payload.metrics} if payload.metrics else None)
    return response
