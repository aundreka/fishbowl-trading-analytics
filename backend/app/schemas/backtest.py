from pydantic import BaseModel, Field


class BacktestRequest(BaseModel):
    user_id: int = 1
    asset_id: int
    strategy_id: int
    run_name: str = Field(min_length=3, max_length=100)
    start_date: str
    end_date: str
    initial_capital: float = Field(gt=0)
    trading_fee: float = Field(ge=0, le=0.1)
    parameters: dict[str, float | int | str] = {}


class CompareRequest(BaseModel):
    run_ids: list[int]
