from pydantic import BaseModel


class AiQuestion(BaseModel):
    question: str
    metrics: dict | None = None
