from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel


class AiQuestion(BaseModel):
    question: str
    metrics: Optional[Dict] = None


class AiConfigTuneRequest(BaseModel):
    current_config: Dict[str, Any]
    position_size: int = 15
    metrics: Optional[Dict[str, Any]] = None


class AiConfigTuneResponse(BaseModel):
    provider: str
    model: str
    live: bool
    config: Dict[str, Any]
    position_size: int
    summary: str
    error: Optional[str] = None
