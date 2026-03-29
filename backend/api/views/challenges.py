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
    dump_table_data,
    execute_query,
    extract_create_tables,
    setup_sandbox,
    teardown_sandbox,
)

logger = logging.getLogger(__name__)


def _materialize_challenge(challenge):
    """Run seed SQL once, capture deterministic schema, data, and expected output."""
    try:
        setup_sandbox(challenge.schema_sql, challenge.seed_sql)

        # Store only CREATE TABLE statements (no functions/procedures)
        challenge.materialized_schema_sql = extract_create_tables(challenge.schema_sql)

        # Materialize seed data as concrete INSERT statements
        challenge.materialized_seed_sql = dump_table_data(challenge.schema_sql)

        # Snapshot expected output
        result = execute_query(
            challenge.ground_truth_query, challenge.time_limit_ms
        )
        from api.views.submissions import _serialize_value
        challenge.expected_output = {
            "columns": result.columns,
            "rows": [
                [_serialize_value(v) for v in row] for row in result.rows
            ],
        }
        challenge.save(update_fields=[
            "materialized_schema_sql", "materialized_seed_sql", "expected_output",
        ])
    except Exception:
        logger.exception("Failed to materialize challenge %s", challenge.id)
    finally:
        try:
            teardown_sandbox(challenge.schema_sql)
        except Exception:
            logger.exception("Failed to tear down sandbox")


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
    _materialize_challenge(challenge)
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
    challenge = serializer.save()
    changed = set(serializer.validated_data.keys())
    if changed & {"schema_sql", "seed_sql", "ground_truth_query"}:
        _materialize_challenge(challenge)
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
    """Return stored expected output for a challenge."""
    try:
        challenge = Challenge.objects.get(pk=pk, is_active=True)
    except Challenge.DoesNotExist:
        return Response(
            {"detail": "Challenge not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not challenge.expected_output:
        return Response(
            {"detail": "Expected output not yet generated."},
            status=status.HTTP_404_NOT_FOUND,
        )

    snapshot = challenge.expected_output
    return Response({
        "columns": snapshot["columns"],
        "rows": snapshot["rows"],
        "total_count": len(snapshot["rows"]),
    })
