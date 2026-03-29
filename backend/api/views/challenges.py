import logging

from django.db.models import Count, Min, Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from api.models import Challenge
from api.permissions import IsAdmin
from api.serializers import (
    ChallengeListSerializer,
    ChallengeDetailSerializer,
    ChallengeAdminSerializer,
    ChallengeCreateUpdateSerializer,
)
from api.services.executor import (
    execute_query,
    setup_sandbox,
    teardown_sandbox,
)

logger = logging.getLogger(__name__)


def _annotate_challenges(qs):
    """Add submission_count and best_time_ms to a Challenge queryset."""
    return qs.annotate(
        submission_count=Count("submissions"),
        best_time_ms=Min(
            "submissions__execution_time_ms",
            filter=Q(submissions__is_correct=True),
        ),
    )


@api_view(["GET", "POST"])
def challenge_list(request):
    if request.method == "GET":
        challenges = _annotate_challenges(Challenge.objects.filter(is_active=True))
        return Response(ChallengeListSerializer(challenges, many=True).data)

    # POST — admin only
    if not (request.user and request.user.is_authenticated and request.user.is_staff):
        return Response({"detail": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

    serializer = ChallengeCreateUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    challenge = serializer.save()
    challenge = _annotate_challenges(Challenge.objects.filter(id=challenge.id)).first()
    return Response(ChallengeAdminSerializer(challenge).data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
def challenge_detail(request, pk):
    try:
        challenge = _annotate_challenges(Challenge.objects.filter(id=pk)).get()
    except Challenge.DoesNotExist:
        return Response({"detail": "Challenge not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(ChallengeDetailSerializer(challenge).data)

    # PUT / DELETE — admin only
    if not (request.user and request.user.is_authenticated and request.user.is_staff):
        return Response({"detail": "Admin access required"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "DELETE":
        challenge.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = ChallengeCreateUpdateSerializer(challenge, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    challenge = _annotate_challenges(Challenge.objects.filter(id=pk)).first()
    return Response(ChallengeAdminSerializer(challenge).data)


@api_view(["GET"])
@permission_classes([IsAdmin])
def challenge_admin_detail(request, pk):
    """Admin view — includes ground truth query."""
    try:
        challenge = _annotate_challenges(Challenge.objects.filter(id=pk)).get()
    except Challenge.DoesNotExist:
        return Response({"detail": "Challenge not found"}, status=status.HTTP_404_NOT_FOUND)
    return Response(ChallengeAdminSerializer(challenge).data)


@api_view(["GET"])
def challenge_expected_output(request, pk):
    """Run ground truth query and return expected output table."""
    try:
        challenge = Challenge.objects.get(pk=pk, is_active=True)
    except Challenge.DoesNotExist:
        return Response(
            {"detail": "Challenge not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        setup_sandbox(challenge.schema_sql, challenge.seed_sql)
        result = execute_query(
            challenge.ground_truth_query, challenge.time_limit_ms
        )

        from api.views.submissions import _build_table
        return Response(_build_table(result.columns, result.rows))

    except Exception as e:
        logger.exception("Failed to compute expected output")
        return Response(
            {"detail": "Failed to compute expected output."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    finally:
        try:
            teardown_sandbox(challenge.schema_sql)
        except Exception:
            logger.exception("Failed to tear down sandbox")
