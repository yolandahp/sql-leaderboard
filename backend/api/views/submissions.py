import json
import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from api.models import Challenge, Submission
from api.serializers import SubmissionCreateSerializer
from api.services.executor import (
    ExecutionError,
    execute_query,
    setup_sandbox,
    teardown_sandbox,
)
from api.services.query_parser import QueryValidationError, validate_query
from api.services.scorer import check_correctness

logger = logging.getLogger(__name__)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_query(request):
    serializer = SubmissionCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    challenge_id = serializer.validated_data["challenge_id"]
    raw_query = serializer.validated_data["query"]

    try:
        challenge = Challenge.objects.get(pk=challenge_id, is_active=True)
    except Challenge.DoesNotExist:
        return Response(
            {"detail": "Challenge not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Validate SQL
    try:
        query = validate_query(raw_query)
    except QueryValidationError as e:
        submission = Submission.objects.create(
            user=request.user,
            challenge=challenge,
            query=raw_query,
            error_message=str(e),
        )
        return Response(_submission_response(submission))

    # Set up sandbox, execute, and score
    try:
        setup_sandbox(challenge.schema_sql, challenge.seed_sql)

        user_result = execute_query(query, challenge.time_limit_ms)

        # Run ground truth for correctness comparison
        truth_result = execute_query(
            challenge.ground_truth_query, challenge.time_limit_ms
        )
        is_correct = check_correctness(user_result, truth_result)

        submission = Submission.objects.create(
            user=request.user,
            challenge=challenge,
            query=query,
            is_correct=is_correct,
            execution_time_ms=user_result.execution_time_ms,
            planning_time_ms=user_result.planning_time_ms,
            total_cost=user_result.total_cost,
            explain_output=json.dumps(user_result.explain_json, indent=2),
        )
        return Response(_submission_response(submission))

    except ExecutionError as e:
        submission = Submission.objects.create(
            user=request.user,
            challenge=challenge,
            query=query,
            error_message=str(e),
        )
        return Response(_submission_response(submission))

    finally:
        try:
            teardown_sandbox(challenge.schema_sql)
        except Exception:
            logger.exception("Failed to tear down sandbox")


def _submission_response(submission: Submission) -> dict:
    return {
        "id": submission.id,
        "is_correct": submission.is_correct,
        "execution_time_ms": submission.execution_time_ms,
        "planning_time_ms": submission.planning_time_ms,
        "total_cost": submission.total_cost,
        "explain_output": submission.explain_output,
        "error_message": submission.error_message,
        "instances": [],
    }
