from __future__ import annotations

from typing import Any


def extract_plan(explain_json) -> dict[str, Any] | None:
    """Safely extract the Plan dict from an explain_json field."""
    if not explain_json or not isinstance(explain_json, list):
        return None
    return explain_json[0].get("Plan") if explain_json[0] else None


def build_plan_artifacts(primary_result, instance_results: list) -> dict[str, Any]:
    return {
        "primary_instance_id": instance_results[0].instance_id if instance_results else None,
        "instances": [
            {
                "instance_id": inst.instance_id,
                "label": inst.label,
                "execution_time_ms": inst.execution_time_ms,
                "planning_time_ms": inst.planning_time_ms,
                "total_cost": inst.total_cost,
                "rows_returned": inst.rows_returned,
                "buffer_hits": inst.buffer_hits,
                "buffer_reads": inst.buffer_reads,
                "explain_json": inst.explain_json,
            }
            for inst in instance_results
        ],
        "primary_plan": primary_result.explain_json,
    }


def summarize_submission(submission) -> dict[str, Any]:
    artifacts = submission.plan_artifacts or {}
    instances = artifacts.get("instances") or []
    return {
        "id": submission.id,
        "submitted_at": submission.submitted_at.isoformat(),
        "label": f"Submission #{submission.id}",
        "is_correct": submission.is_correct,
        "execution_time_ms": submission.execution_time_ms,
        "planning_time_ms": submission.planning_time_ms,
        "has_plan": bool(available_instance_ids(submission)),
        "instance_ids": available_instance_ids(submission),
        "instance_count": len(instances),
    }


def available_instance_ids(submission) -> list[str]:
    artifacts = submission.plan_artifacts or {}
    instances = artifacts.get("instances") or []
    return [
        inst["instance_id"]
        for inst in instances
        if extract_plan(inst.get("explain_json"))
    ]


def instance_options(submission) -> list[dict[str, Any]]:
    artifacts = submission.plan_artifacts or {}
    instances = artifacts.get("instances") or []
    return [
        {
            "id": inst["instance_id"],
            "label": inst["label"],
            "has_plan": bool(extract_plan(inst.get("explain_json"))),
        }
        for inst in instances
    ]


def default_instance_id(submission) -> str | None:
    artifacts = submission.plan_artifacts or {}
    return artifacts.get("primary_instance_id") or next(iter(available_instance_ids(submission)), None)


def resolve_instance_option(submission, instance_id: str | None) -> dict[str, Any] | None:
    if not instance_id:
        return None
    for option in instance_options(submission):
        if option["id"] == instance_id:
            return option
    return {"id": instance_id, "label": instance_id, "has_plan": False}


def get_instance_artifact(submission, instance_id: str | None) -> dict[str, Any] | None:
    if not instance_id:
        return None
    artifacts = submission.plan_artifacts or {}
    for inst in artifacts.get("instances") or []:
        if inst["instance_id"] == instance_id:
            return inst
    return None
