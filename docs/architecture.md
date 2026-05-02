# Architecture

Fishbowl Trading Analytics uses a three-part architecture:

1. Next.js frontend for forms, dashboards, tables, and analytics views.
2. FastAPI backend for authentication, CRUD modules, backtesting logic, analytics, and AI assistant responses.
3. PostgreSQL schema and Docker Compose infrastructure for the target course deployment model.

For this workspace MVP, the backend persists data in a local JSON store so the system can run immediately with the currently available Python dependencies.
