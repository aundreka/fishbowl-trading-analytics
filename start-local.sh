#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE="$ROOT_DIR/.env.example"
BACKEND_VENV="$BACKEND_DIR/.venv"
BACKEND_STAMP="$BACKEND_VENV/.requirements-installed"
FRONTEND_STAMP="$FRONTEND_DIR/node_modules/.install-stamp"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

require_command python3
require_command npm

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created .env from .env.example"
fi

mkdir -p "$BACKEND_DIR/backend_data"

if [[ ! -d "$BACKEND_VENV" ]]; then
  echo "Creating backend virtual environment..."
  python3 -m venv "$BACKEND_VENV"
fi

if [[ ! -f "$BACKEND_STAMP" || "$BACKEND_DIR/requirements.txt" -nt "$BACKEND_STAMP" ]]; then
  echo "Installing backend dependencies..."
  "$BACKEND_VENV/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
  touch "$BACKEND_STAMP"
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" || ! -f "$FRONTEND_STAMP" || "$FRONTEND_DIR/package-lock.json" -nt "$FRONTEND_STAMP" || "$FRONTEND_DIR/package.json" -nt "$FRONTEND_STAMP" ]]; then
  echo "Installing frontend dependencies..."
  (
    cd "$FRONTEND_DIR"
    npm install
    touch "$FRONTEND_STAMP"
  )
fi

echo "Starting backend on http://localhost:8000 ..."
(
  cd "$BACKEND_DIR"
  exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
) &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:3000 ..."
(
  cd "$FRONTEND_DIR"
  exec npm run dev -- --hostname 0.0.0.0
) &
FRONTEND_PID=$!

echo "Fishbowl running."
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"
echo "Press Ctrl+C to stop both."

while kill -0 "$BACKEND_PID" >/dev/null 2>&1 && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; do
  sleep 1
done

echo "One process stopped. Shutting down."
