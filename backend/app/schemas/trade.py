from __future__ import annotations

from typing import Dict, Optional

from pydantic import BaseModel


class AiQuestion(BaseModel):
    question: str
    metrics: Optional[Dict] = None
