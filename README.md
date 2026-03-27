# SQL Performance Leaderboard

A web-based platform for benchmarking and comparing SQL query performance on PostgreSQL. Students submit optimized queries for predefined challenges and compete on a leaderboard based on execution time.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Backend:** FastAPI (Python 3.12), SQLAlchemy (async), Uvicorn
- **Databases:** PostgreSQL 16 (app database + sandbox for query execution)
- **Sandbox:** PostgreSQL 16 with [HypoPG](https://github.com/HypoPG/hypopg) extension

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) and Docker Compose

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd leaderboard
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in all the values in `.env` (database credentials, JWT secret, etc.).

### 3. Start all services

```bash
docker compose up --build
```

This starts four containers:

| Service       | Container Name          | Port  | Description                        |
| ------------- | ----------------------- | ----- | ---------------------------------- |
| `app-db`      | leaderboard-app-db      | 5434  | Application database (users, etc.) |
| `sandbox-pg`  | leaderboard-sandbox-pg  | 5433  | Sandbox for executing user queries |
| `backend`     | leaderboard-backend     | 8000  | FastAPI backend                    |
| `frontend`    | leaderboard-frontend    | 3000  | React dev server                   |

### 4. Access the application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API docs (Swagger):** http://localhost:8000/docs
- **Health check:** http://localhost:8000/api/health

## Running Without Docker

If you prefer to run services individually:

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit .env with your database URLs and JWT secret
uvicorn main:app --reload --port 8000
```

> Requires a running PostgreSQL instance for both the app database (port 5434) and sandbox (port 5433). You can start just the databases with:
> ```bash
> docker compose up app-db sandbox-pg
> ```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs at http://localhost:3000.

## Project Structure

```
leaderboard/
├── backend/
│   ├── main.py              # FastAPI app entrypoint
│   ├── config.py            # App settings (env vars)
│   ├── database.py          # SQLAlchemy async engine
│   ├── models.py            # ORM models
│   ├── schemas.py           # Pydantic schemas
│   ├── routers/             # API route handlers
│   ├── services/            # Business logic
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/                 # React app source
│   ├── package.json
│   └── Dockerfile
├── sandbox/
│   ├── Dockerfile           # PostgreSQL 16 + HypoPG
│   └── init-scripts/        # DB initialization SQL
└── docker-compose.yml
```
