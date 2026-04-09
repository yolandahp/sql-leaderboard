# SQL Performance Leaderboard

A web-based platform for benchmarking and comparing SQL query performance on PostgreSQL. Users submit optimized queries for predefined challenges and compete on a leaderboard based on execution time and correctness.

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Vite
- **Backend:** Django 5, Django REST Framework, SimpleJWT
- **Databases:** PostgreSQL 16 (app database + sandboxed query execution)
- **Sandbox:** PostgreSQL 16 with [HypoPG](https://github.com/HypoPG/hypopg) extension (3 instances)

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) and Docker Compose
- (Optional) `make` for shorthand commands — see [Makefile](Makefile)

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
make up          # or: docker compose up --build
```

On first run, the backend automatically:
1. Runs database migrations
2. Seeds default users and sample challenges

This starts six containers:

| Service              | Container Name                 | Port  | Description                          |
| -------------------- | ------------------------------ | ----- | ------------------------------------ |
| `app-db`             | leaderboard-app-db             | 5434  | Application database (users, etc.)   |
| `sandbox-pg`         | leaderboard-sandbox-pg         | 5433  | Sandbox — small dataset              |
| `sandbox-pg-indexed` | leaderboard-sandbox-pg-indexed | 5435  | Sandbox — small dataset with indexes |
| `sandbox-pg-large`   | leaderboard-sandbox-pg-large   | 5436  | Sandbox — large dataset              |
| `backend`            | leaderboard-backend            | 8000  | Django API server                    |
| `frontend`           | leaderboard-frontend           | 3000  | React dev server                     |

### 4. Access the application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000/api/

Default accounts:

| Role  | Username | Password   |
| ----- | -------- | ---------- |
| Admin | `admin`  | `admin123` |
| User  | `user`   | `user123`  |

## Common Commands

All commands are available via `make`. Run `make help` for a full list.

```bash
make up              # Start all services (background)
make down            # Stop all services and delete volumes
make restart         # Restart all services (clean)
make logs            # Tail backend logs
make migrate         # Run Django migrations
make makemigrations  # Create new migration after model changes
make seed            # Run database seeders
make prod            # Start production services (background)
make prod-down       # Stop production services and delete volumes
make prod-restart    # Restart production services (clean)
```

## Production

A production Docker Compose file is provided (`docker-compose.prod.yml`). This uses Gunicorn for the backend and Nginx for the frontend (served on port 80). Set `ALLOWED_HOSTS` and `CORS_ORIGINS` in `.env` for production.

```bash
make prod
```

## Project Structure

```
leaderboard/
├── backend/
│   ├── manage.py
│   ├── config/                   # Django settings, URLs, WSGI
│   └── api/                      # Django app
│       ├── models.py             # User, Challenge, Submission
│       ├── views/                # API views (auth, challenges, submissions, leaderboard, stats)
│       ├── serializers/          # DRF serializers (auth, challenges, submissions)
│       ├── services/             # Business logic (query parser, executor, scorer)
│       ├── seeds/                # Database seeders (auto-discovered)
│       └── management/commands/  # Custom management commands
├── frontend/
│   └── src/
│       ├── api/                  # API client with JWT injection
│       ├── contexts/             # React context (auth)
│       ├── components/           # Shared UI (Navbar, Footer, Pagination, ExecutionPlanTable)
│       └── pages/                # Page components
├── sandbox/
│   ├── Dockerfile                # PostgreSQL 16 + HypoPG
│   └── init-scripts/
├── docker-compose.yml            # Development
├── docker-compose.prod.yml       # Production
└── Makefile
```

## API Endpoints

```
POST   /api/auth/register                    # Public — create account
POST   /api/auth/login                       # Public — returns JWT access token
GET    /api/auth/me                          # Authenticated — current user info
GET    /api/auth/me/submissions              # Authenticated — submission history
GET    /api/auth/me/stats                    # Authenticated — profile stats (solved, rank)

GET    /api/challenges                       # Public — list active challenges
POST   /api/challenges                       # Admin — create challenge
GET    /api/challenges/<id>                  # Public — challenge detail (no ground truth)
PUT    /api/challenges/<id>                  # Admin — update challenge
DELETE /api/challenges/<id>                  # Admin — delete challenge
GET    /api/challenges/<id>/admin            # Admin — detail with ground truth
GET    /api/challenges/<id>/expected-output  # Admin — expected query output

POST   /api/submissions                      # Authenticated — submit a query
GET    /api/submissions/<id>                 # Authenticated — submission detail
GET    /api/submissions/<id>/index-advice    # Authenticated — HypoPG index recommendations
GET    /api/submissions/<id>/comparison-targets  # Authenticated — targets for plan diff
GET    /api/submissions/<id>/plan-diff       # Authenticated — EXPLAIN plan diff

GET    /api/stats                            # Public — platform statistics
GET    /api/leaderboard                      # Public — overall rankings
GET    /api/leaderboard/challenge/<id>       # Public — per-challenge rankings
```
