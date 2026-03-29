from django.db.models import Avg, Count, Min, Q, Value
from django.db.models.functions import Coalesce
from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.models import Challenge, Submission, User


def _build_overall_rankings():
    """Build overall leaderboard: rank by challenges solved (desc), then avg best execution time (asc)."""
    total_challenges = Challenge.objects.filter(is_active=True).count()

    # For each user, get number of distinct challenges solved
    # and avg of their best execution time per challenge
    users = (
        User.objects.filter(
            submissions__is_correct=True,
        )
        .annotate(
            solved=Count(
                "submissions__challenge_id",
                filter=Q(submissions__is_correct=True),
                distinct=True,
            ),
            avg_execution_time_ms=Coalesce(
                Avg(
                    "submissions__execution_time_ms",
                    filter=Q(submissions__is_correct=True),
                ),
                Value(0.0),
            ),
            submission_count=Count("submissions"),
        )
        .filter(solved__gt=0)
        .order_by("-solved", "avg_execution_time_ms")
    )

    entries = []
    for rank, user in enumerate(users, start=1):
        entries.append({
            "rank": rank,
            "username": user.username,
            "solved": user.solved,
            "total": total_challenges,
            "avg_execution_time_ms": user.avg_execution_time_ms,
            "submission_count": user.submission_count,
            "joined": user.date_joined.strftime("%Y-%m-%d"),
        })

    return entries


@api_view(["GET"])
def leaderboard(request):
    return Response(_build_overall_rankings())


@api_view(["GET"])
def challenge_leaderboard(request, pk):
    """Per-challenge leaderboard: rank by best (min) execution time among correct submissions."""
    if not Challenge.objects.filter(pk=pk).exists():
        return Response([])

    users = (
        User.objects.filter(
            submissions__challenge_id=pk,
            submissions__is_correct=True,
        )
        .annotate(
            best_execution_time_ms=Min(
                "submissions__execution_time_ms",
                filter=Q(
                    submissions__challenge_id=pk,
                    submissions__is_correct=True,
                ),
            ),
            avg_execution_time_ms=Avg(
                "submissions__execution_time_ms",
                filter=Q(
                    submissions__challenge_id=pk,
                    submissions__is_correct=True,
                ),
            ),
            planning_time_ms=Min(
                "submissions__planning_time_ms",
                filter=Q(
                    submissions__challenge_id=pk,
                    submissions__is_correct=True,
                ),
            ),
            submission_count=Count(
                "submissions",
                filter=Q(submissions__challenge_id=pk),
            ),
            last_submitted=Min(
                "submissions__submitted_at",
                filter=Q(
                    submissions__challenge_id=pk,
                    submissions__is_correct=True,
                ),
            ),
        )
        .order_by("best_execution_time_ms")
    )

    entries = []
    for rank, user in enumerate(users, start=1):
        entries.append({
            "rank": rank,
            "username": user.username,
            "avg_execution_time_ms": user.avg_execution_time_ms,
            "planning_time_ms": user.planning_time_ms,
            "submission_count": user.submission_count,
            "last_submitted": user.last_submitted.strftime("%Y-%m-%d %H:%M"),
        })

    return Response(entries)


def get_user_rank(user):
    """Get a user's overall rank, or None if they haven't solved anything."""
    rankings = _build_overall_rankings()
    for entry in rankings:
        if entry["username"] == user.username:
            return entry["rank"]
    return None
