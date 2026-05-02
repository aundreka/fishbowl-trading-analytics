from pydantic import BaseModel, Field


class StrategyCreate(BaseModel):
    strategy_name: str = Field(min_length=3, max_length=100)
    strategy_key: str = Field(min_length=3, max_length=60)
    description: str | None = None


class StrategyUpdate(BaseModel):
    strategy_name: str | None = None
    description: str | None = None
