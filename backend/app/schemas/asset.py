from pydantic import BaseModel, Field


class AssetCreate(BaseModel):
    asset_type_id: int
    symbol: str = Field(min_length=1, max_length=20)
    asset_name: str = Field(min_length=2, max_length=100)
    market: str | None = None


class AssetUpdate(BaseModel):
    asset_name: str | None = None
    market: str | None = None
    asset_type_id: int | None = None


class HistoricalDataUpload(BaseModel):
    asset_id: int
    csv_content: str = Field(min_length=10)
