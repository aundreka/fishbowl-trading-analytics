# API Overview

Base URL: `http://localhost:8000/api`

## Auth

- `POST /auth/login`
- `POST /auth/register`

## Users

- `GET /users`
- `POST /users`
- `PUT /users/{user_id}`
- `DELETE /users/{user_id}`

## Assets

- `GET /assets`
- `POST /assets`
- `PUT /assets/{asset_id}`
- `DELETE /assets/{asset_id}`
- `POST /assets/validate-upload`
- `POST /assets/upload`
- `GET /assets/{asset_id}/prices`

## Strategies

- `GET /strategies`
- `POST /strategies`
- `PUT /strategies/{strategy_id}`
- `DELETE /strategies/{strategy_id}`

## Backtesting

- `GET /backtest/runs`
- `GET /backtest/runs/{run_id}`
- `POST /backtest/run`
- `POST /backtest/compare`
- `DELETE /backtest/runs/{run_id}`

## Analytics

- `GET /analytics/summary`
- `GET /analytics/reports/backtests`

## Assistant

- `POST /assistant/ask`
