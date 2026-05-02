# Fishbowl Trading Analytics

Fishbowl Trading Analytics is a backtesting platform for students, aspiring traders, and finance enthusiasts who want to test strategies in a controlled environment without risking real money.

## Stack

- Backend: FastAPI
- Frontend: Next.js App Router with TypeScript
- Target database: PostgreSQL
- Local MVP data store: JSON file for immediate demo use
- Deployment: Docker Compose

## Modules

- Login / authentication
- User management
- Asset management
- Historical data upload and validation
- Strategy management
- Backtesting dashboard
- Trade logs viewer
- Performance analytics
- Fishbowl AI Strategy Assistant

## Demo Accounts

- `admin@fishbowl.local` / `fishbowl123`
- `user@fishbowl.local` / `fishbowl123`

## Run Locally

### Backend

```powershell
cd backend
.venv\Scripts\python -m uvicorn app.main:app --reload
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Docker Compose

```powershell
docker compose up --build
```

## Notes

- The repository includes a PostgreSQL schema and seed file in [database/schema.sql](/C:/apps/acads/fishbowl-trading-analytics/database/schema.sql) and [database/seed.sql](/C:/apps/acads/fishbowl-trading-analytics/database/seed.sql).
- The FastAPI MVP currently uses `backend/backend_data/store.json` so the app works immediately in this workspace without waiting for database drivers or a live database connection.
- The AI assistant endpoint supports a local educational fallback response and an environment hook for `QWEN_API_KEY`.
