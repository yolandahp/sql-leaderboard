# SQL Performance Leaderboard

A web-based platform for benchmarking and comparing SQL query performance on PostgreSQL. Users submit optimized queries for predefined challenges and compete on a leaderboard based on execution time.

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Vite
- **Backend:** Django 5, Django REST Framework, SimpleJWT
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

On first run, the backend automatically:
1. Runs database migrations
2. Seeds default users and sample challenges

This starts four containers:

| Service       | Container Name          | Port  | Description                        |
| ------------- | ----------------------- | ----- | ---------------------------------- |
| `app-db`      | leaderboard-app-db      | 5434  | Application database (users, etc.) |
| `sandbox-pg`  | leaderboard-sandbox-pg  | 5433  | Sandbox for executing user queries |
| `backend`     | leaderboard-backend     | 8000  | Django API server                  |
| `frontend`    | leaderboard-frontend    | 3000  | React dev server                   |

### 4. Access the application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000/api/

Default accounts:

| Role  | Username | Password   |
| ----- | -------- | ---------- |
| Admin | `admin`  | `admin123` |
| User  | `user`   | `user123`  |

## Common Commands

```bash
# Start in background
docker compose up --build -d

# View backend logs
docker compose logs -f backend

# Stop all services
docker compose down

# Reset database (delete volumes)
docker compose down -v

# Run migrations manually
docker compose exec backend python manage.py migrate

# Create new migration after model changes
docker compose exec backend python manage.py makemigrations

# Run seeders
docker compose exec backend python manage.py seed
```

## Project Structure

```
leaderboard/
├── backend/
│   ├── manage.py
│   ├── config/                   # Django settings, URLs, WSGI
│   └── api/                      # Django app
│       ├── models.py             # User, Challenge, Submission
│       ├── views/                # API views (auth, challenges, leaderboard, stats)
│       ├── serializers/          # DRF serializers (auth, challenges, submissions)
│       ├── services/             # Business logic (query parser, executor, scorer)
│       ├── seeds/                # Database seeders (auto-discovered)
│       └── management/commands/  # Custom management commands
├── frontend/
│   └── src/
│       ├── api/                  # API client
│       ├── contexts/             # React context (auth)
│       ├── components/           # Shared UI components
│       └── pages/                # Page components
├── sandbox/
│   ├── Dockerfile                # PostgreSQL 16 + HypoPG
│   └── init-scripts/
└── docker-compose.yml
```

## API Endpoints

```
POST   /api/auth/register         # Public — create account
POST   /api/auth/login            # Public — returns JWT access token
GET    /api/auth/me               # Authenticated — current user info
GET    /api/auth/me/submissions   # Authenticated — submission history

GET    /api/challenges            # Public — list active challenges
POST   /api/challenges            # Admin — create challenge
GET    /api/challenges/<id>       # Public — challenge detail (no ground truth)
PUT    /api/challenges/<id>       # Admin — update challenge
DELETE /api/challenges/<id>       # Admin — delete challenge

GET    /api/stats                 # Public — platform statistics
GET    /api/leaderboard           # Public — overall rankings
```
