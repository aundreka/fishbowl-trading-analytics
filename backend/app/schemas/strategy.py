from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class StrategyCreate(BaseModel):
    strategy_name: str = Field(min_length=3, max_length=100)
    strategy_key: str = Field(min_length=3, max_length=60)
    description: Optional[str] = None


class StrategyUpdate(BaseModel):
    strategy_name: Optional[str] = None
    description: Optional[str] = None
