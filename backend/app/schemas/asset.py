from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class AssetCreate(BaseModel):
    asset_type_id: int
    symbol: str = Field(min_length=1, max_length=20)
    asset_name: str = Field(min_length=2, max_length=100)
    market: Optional[str] = None


class AssetUpdate(BaseModel):
    asset_name: Optional[str] = None
    market: Optional[str] = None
    asset_type_id: Optional[int] = None


class HistoricalDataUpload(BaseModel):
    asset_id: int
    csv_content: str = Field(min_length=10)
