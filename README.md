# Fishbowl Trading Analytics 

Fishbowl Trading Analytics is a full-stack backtesting platform designed for students, aspiring traders, and finance enthusiasts. It provides a controlled environment to test trading strategies against historical data, visualize equity curves dynamically, and consult an AI assistant for performance tuning—all without risking real capital.

## Key Features

- **Backtesting Engine:** Run simulated trading strategies with customizable parameters, capital, and fees.
- **Dynamic Playback Chart:** Watch your equity curve and trades plot in real-time with an auto-zooming timeline and playhead indicators.
- **Fishbowl AI Strategy Assistant:** Integrated with Google Gemini (`gemini-2.5-flash`) to analyze your backtest metrics and suggest configuration tunes.
- **Historical Data Upload:** Import custom CSV market data. The AI assistant maps unfamiliar column headers automatically.
- **Trade Logging & Analytics:** Track every simulated execution and measure performance via Sharpe Ratio, Max Drawdown, Win Rate, and Total Return.

## Tech Stack

- **Backend:** Python, FastAPI
- **Frontend:** Next.js (App Router), React, TypeScript, Pure Vanilla CSS
- **AI Integration:** Google Gemini API (OpenAI compatible endpoint)
- **Data Store:** JSON file MVP (with a PostgreSQL schema ready for production)
- **Deployment:** Docker & Docker Compose

## Getting Started

### Demo Accounts

- **Admin:** `admin@fishbowl.local` / `fishbowl123`
- **User:** `user@fishbowl.local` / `fishbowl123`

### 1. Quick Start (Recommended)

From the repository root, run the setup script. It automatically manages virtual environments, installs dependencies, and launches both servers.

```bash
./start-local.sh
```
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

### 2. Docker Compose

To run the entire stack in isolated containers:

```bash
docker compose up --build
```

### 3. Manual Setup

**Backend (Python 3):**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend (Node.js 18+):**
```bash
cd frontend
npm install
npm run dev
```

## AI Configuration & Environment

To enable live AI replies and automatic configuration tuning, copy `.env.example` to `.env` in the root directory and add your Google Gemini API key:

```env
GEMINI_API_KEY="your_google_ai_studio_key"
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_API_URL="https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
```

If the API key is missing or the request fails, the application will seamlessly fall back to local, canned responses.

## Architecture Notes

- **Database:** The repository includes PostgreSQL schema and seed files in `database/schema.sql` and `database/seed.sql`.
- **MVP State:** The FastAPI backend currently uses a local JSON file (`backend/backend_data/store.json`) for persistence, ensuring the app works instantly without waiting for database driver configurations.
