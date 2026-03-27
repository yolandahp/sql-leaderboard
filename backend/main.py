from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import auth, challenges, submissions, leaderboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="SQL Performance Leaderboard", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(challenges.router, prefix="/api/challenges", tags=["challenges"])
app.include_router(submissions.router, prefix="/api/submissions", tags=["submissions"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["leaderboard"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
