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

### One Script

From the repository root:

```bash
./start-local.sh
```

What it does:

- creates `.env` from `.env.example` if missing
- creates `backend/.venv` if missing
- installs backend dependencies when needed
- installs frontend dependencies when needed
- starts backend on `http://localhost:8000`
- starts frontend on `http://localhost:3000`

Press `Ctrl+C` to stop both servers.

If you want live AI replies, set `OPENROUTER_API_KEY` in the root `.env` before running the script.

### Frontend

Requirements:

- Node.js 18+
- npm

From the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

The frontend defaults to `http://localhost:8000/api` for API requests. If the backend is not running, the shell still loads, but data-driven pages will show request errors.

### Backend

Requirements:

- Python 3

From the repository root:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs at `http://localhost:8000`.

If you need a different API URL for the frontend, create `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

For AI replies, create a root `.env` file from `.env.example` and set `OPENROUTER_API_KEY`. Default AI model is `nvidia/nemotron-3-super-120b-a12b:free`.

### Docker Compose

```bash
docker compose up --build
```

## Notes

- The repository includes PostgreSQL schema and seed files in `database/schema.sql` and `database/seed.sql`.
- The FastAPI MVP currently uses `backend/backend_data/store.json` so the app works immediately in this workspace without waiting for database drivers or a live database connection.
- The AI assistant uses OpenRouter chat completions. Default model is `nvidia/nemotron-3-super-120b-a12b:free`, with local fallback replies if the API key is missing or the request fails.
