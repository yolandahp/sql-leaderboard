from datetime import datetime
from pydantic import BaseModel, EmailStr


# ---------- Auth ----------
class UserRegister(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Challenge ----------
class ChallengeCreate(BaseModel):
    title: str
    description: str
    schema_sql: str
    seed_sql: str
    ground_truth_query: str
    time_limit_ms: int = 5000


class ChallengeOut(BaseModel):
    id: int
    title: str
    description: str
    time_limit_ms: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ChallengeDetail(ChallengeOut):
    schema_sql: str
    seed_sql: str


# ---------- Submission ----------
class SubmissionCreate(BaseModel):
    challenge_id: int
    query: str


class SubmissionOut(BaseModel):
    id: int
    user_id: int
    challenge_id: int
    query: str
    is_correct: bool
    execution_time_ms: float | None
    planning_time_ms: float | None
    total_cost: float | None
    error_message: str | None
    submitted_at: datetime

    model_config = {"from_attributes": True}


# ---------- Leaderboard ----------
class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    best_execution_time_ms: float
    submission_count: int
