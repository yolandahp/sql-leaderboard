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
    InstanceResult,
    execute_on_all_instances,
)
from api.services.index_advisor import analyze_indexes
from api.services.plan_diff import (
    build_plan_artifacts,
    generate_plan_diff,
    list_comparison_targets,
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

    is_admin = request.user.is_staff

    # Validate SQL
    try:
        query = validate_query(raw_query)
    except QueryValidationError as e:
        if is_admin:
            return Response(_submission_response(
                _ephemeral_submission(request.user, challenge, raw_query, error_message=str(e)),
            ))
        submission = Submission.objects.create(
            user=request.user,
            challenge=challenge,
            query=raw_query,
            error_message=str(e),
        )
        return Response(_submission_response(submission))

    # Execute on all instances and score
    try:
        user_result, instance_results = execute_on_all_instances(
            query, challenge
        )

        # Compare against stored snapshot
        snapshot = challenge.expected_output or {}
        truth_columns = snapshot.get("columns", [])
        truth_rows = snapshot.get("rows", [])
        is_correct = check_correctness(user_result, truth_columns, truth_rows)

        # Aggregate: average execution time across instances
        avg_execution_ms = sum(
            ir.execution_time_ms for ir in instance_results
        ) / len(instance_results)
        avg_planning_ms = sum(
            ir.planning_time_ms for ir in instance_results
        ) / len(instance_results)

        if is_admin:
            submission = _ephemeral_submission(
                request.user, challenge, query,
                is_correct=is_correct,
                execution_time_ms=avg_execution_ms,
                planning_time_ms=avg_planning_ms,
                total_cost=user_result.total_cost,
                explain_output=json.dumps(user_result.explain_json, indent=2),
            )
        else:
            submission = Submission.objects.create(
                user=request.user,
                challenge=challenge,
                query=query,
                is_correct=is_correct,
                execution_time_ms=avg_execution_ms,
                planning_time_ms=avg_planning_ms,
                total_cost=user_result.total_cost,
                explain_output=json.dumps(user_result.explain_json, indent=2),
                plan_artifacts=build_plan_artifacts(user_result, instance_results),
            )
        return Response(_submission_response(
            submission,
            columns=user_result.columns,
            rows=user_result.rows,
            expected_columns=truth_columns,
            expected_rows=truth_rows,
            instance_results=instance_results,
        ))

    except ExecutionError as e:
        if is_admin:
            return Response(_submission_response(
                _ephemeral_submission(request.user, challenge, query, error_message=str(e)),
            ))
        submission = Submission.objects.create(
            user=request.user,
            challenge=challenge,
            query=query,
            error_message=str(e),
        )
        return Response(_submission_response(submission))


def _ephemeral_submission(user, challenge, query, **kwargs):
    """Build an unsaved Submission instance for admin test runs."""
    return Submission(
        id=0,
        user=user,
        challenge=challenge,
        query=query,
        **kwargs,
    )


def _serialize_value(value):
    """Convert DB values to JSON-safe types."""
    from decimal import Decimal
    from datetime import date, datetime

    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return str(value)
    return value


def _build_table(columns: list[str], rows: list[tuple]) -> dict:
    return {
        "columns": columns,
        "rows": [
            [_serialize_value(v) for v in row]
            for row in rows[:100]
        ],
        "total_count": len(rows),
    }


def _submission_response(
    submission: Submission,
    columns: list[str] | None = None,
    rows: list[tuple] | None = None,
    expected_columns: list[str] | None = None,
    expected_rows: list[tuple] | None = None,
    instance_results: list[InstanceResult] | None = None,
) -> dict:
    result_table = None
    if columns is not None and rows is not None:
        result_table = _build_table(columns, rows)

    expected_table = None
    if expected_columns is not None and expected_rows is not None:
        expected_table = _build_table(expected_columns, expected_rows)

    instances = []
    if instance_results:
        instances = [
            {
                "label": ir.label,
                "config": ir.instance_id,
                "execution_time_ms": ir.execution_time_ms,
                "planning_time_ms": ir.planning_time_ms,
                "total_cost": ir.total_cost,
                "rows_returned": ir.rows_returned,
                "buffer_hits": ir.buffer_hits,
                "buffer_reads": ir.buffer_reads,
                "explain_output": json.dumps(ir.explain_json, indent=2),
            }
            for ir in instance_results
        ]

    total_time_ms = None
    if instance_results:
        total_time_ms = sum(
            ir.execution_time_ms + ir.planning_time_ms for ir in instance_results
        ) / len(instance_results)
    elif submission.execution_time_ms is not None and submission.planning_time_ms is not None:
        total_time_ms = submission.execution_time_ms + submission.planning_time_ms

    return {
        "id": submission.id,
        "is_correct": submission.is_correct,
        "execution_time_ms": submission.execution_time_ms,
        "planning_time_ms": submission.planning_time_ms,
        "total_time_ms": total_time_ms,
        "total_cost": submission.total_cost,
        "explain_output": submission.explain_output,
        "error_message": submission.error_message,
        "result_table": result_table,
        "expected_table": expected_table,
        "instances": instances,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def submission_detail(request, pk):
    """GET /api/submissions/<id> — full submission detail with instance data."""
    submission = Submission.objects.filter(
        pk=pk, user=request.user,
    ).first()
    if submission is None:
        return Response(
            {"detail": "Submission not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    # Reconstruct instances from plan_artifacts
    instances = []
    artifacts = submission.plan_artifacts or {}
    for inst in artifacts.get("instances", []):
        instances.append({
            "label": inst.get("label", ""),
            "config": inst.get("instance_id", ""),
            "execution_time_ms": inst.get("execution_time_ms", 0),
            "planning_time_ms": inst.get("planning_time_ms", 0),
            "total_cost": inst.get("total_cost", 0),
            "rows_returned": inst.get("rows_returned", 0),
            "buffer_hits": inst.get("buffer_hits", 0),
            "buffer_reads": inst.get("buffer_reads", 0),
            "explain_output": json.dumps(inst.get("explain_json", []), indent=2),
        })

    total_time_ms = None
    if instances:
        total_time_ms = sum(
            i["execution_time_ms"] + i["planning_time_ms"] for i in instances
        ) / len(instances)
    elif submission.execution_time_ms is not None and submission.planning_time_ms is not None:
        total_time_ms = submission.execution_time_ms + submission.planning_time_ms

    return Response({
        "id": submission.id,
        "challenge_id": submission.challenge_id,
        "query": submission.query,
        "is_correct": submission.is_correct,
        "execution_time_ms": submission.execution_time_ms,
        "planning_time_ms": submission.planning_time_ms,
        "total_time_ms": total_time_ms,
        "total_cost": submission.total_cost,
        "explain_output": submission.explain_output,
        "error_message": submission.error_message,
        "submitted_at": submission.submitted_at.isoformat(),
        "instances": instances,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def submission_comparison_targets(request, pk):
    current_submission = Submission.objects.filter(
        pk=pk,
        user=request.user,
    ).select_related("challenge").first()
    if current_submission is None:
        return Response({"detail": "Submission not found."}, status=status.HTTP_404_NOT_FOUND)

    candidates = list(
        Submission.objects.filter(
            user=request.user,
            challenge=current_submission.challenge,
            submitted_at__lt=current_submission.submitted_at,
        ).order_by("-submitted_at", "-id")
    )

    return Response(list_comparison_targets(current_submission, candidates))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submission_plan_diff(request, pk):
    current_submission = Submission.objects.filter(
        pk=pk,
        user=request.user,
    ).select_related("challenge").first()
    if current_submission is None:
        return Response({"detail": "Submission not found."}, status=status.HTTP_404_NOT_FOUND)

    target_submission_id = request.data.get("target_submission_id")
    if not target_submission_id:
        return Response(
            {"detail": "target_submission_id is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    target_submission = Submission.objects.filter(
        pk=target_submission_id,
        user=request.user,
        challenge=current_submission.challenge,
    ).first()
    if target_submission is None or target_submission.pk == current_submission.pk:
        return Response(
            {"detail": "Comparison target is invalid for this challenge."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        generate_plan_diff(
            current_submission,
            target_submission,
            request.data.get("instance_id"),
        )
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def index_advice(request, submission_id):
    """POST /api/submissions/<id>/index-advice — run the index advisor pipeline."""
    try:
        submission = Submission.objects.select_related("challenge").get(
            pk=submission_id, user=request.user,
        )
    except Submission.DoesNotExist:
        return Response(
            {"detail": "Submission not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    if submission.error_message:
        return Response(
            {"detail": "Cannot analyze a failed submission."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        result = analyze_indexes(
            submission.query,
            submission.challenge,
            submission.execution_time_ms or 0.0,
        )
        return Response(result)
    except Exception as e:
        logger.exception("Index advisor failed for submission %s", submission_id)
        return Response(
            {"detail": f"Index analysis failed: {e}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
