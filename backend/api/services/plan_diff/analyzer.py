from __future__ import annotations

import logging
from typing import Any

from .artifacts import (
    default_instance_id,
    extract_plan,
    get_instance_artifact,
    instance_options,
    resolve_instance_option,
    summarize_submission,
)
from .insights import build_insights, build_summary, summarize_pair
from .matcher import match_nodes
from .normalizer import flatten_tree, normalize_plan

logger = logging.getLogger(__name__)


def list_comparison_targets(current_submission, submissions) -> dict[str, Any]:
    current_summary = summarize_submission(current_submission)
    instances = instance_options(current_submission)

    targets = []
    previous_id = None
    fastest_correct_id = None
    fastest_correct_time = None

    for index, submission in enumerate(submissions):
        target_kind = "earlier"
        if index == 0:
            target_kind = "previous"
            previous_id = submission.id

        if submission.is_correct and submission.execution_time_ms is not None:
            if fastest_correct_time is None or submission.execution_time_ms < fastest_correct_time:
                fastest_correct_time = submission.execution_time_ms
                fastest_correct_id = submission.id

        target = summarize_submission(submission)
        target["kind"] = target_kind
        targets.append(target)

    if fastest_correct_id:
        for target in targets:
            if target["id"] == fastest_correct_id:
                target["kind"] = "fastest_correct"
                break

    default_target_id = fastest_correct_id or previous_id
    return {
        "current_submission": current_summary,
        "targets": targets,
        "default_target_id": default_target_id,
        "instance_options": instances,
        "default_instance_id": instances[0]["id"] if instances else None,
    }


def generate_plan_diff(submission_a, submission_b, instance_id: str | None = None) -> dict[str, Any]:
    instance_id = instance_id or default_instance_id(submission_a)
    artifact_a = get_instance_artifact(submission_a, instance_id)
    artifact_b = get_instance_artifact(submission_b, instance_id)
    response = {
        "current_submission": summarize_submission(submission_a, instance_id),
        "target_submission": summarize_submission(submission_b, instance_id),
        "instance": resolve_instance_option(submission_a, instance_id),
        "current_submission_incorrect": not submission_a.is_correct,
    }

    if artifact_a is None or artifact_b is None:
        logger.debug(
            "Missing artifact for submissions %s/%s on instance %s",
            submission_a.id, submission_b.id, instance_id,
        )
        response["status"] = "missing_plan"
        response["message"] = "Analysis is unavailable for this comparison target because one submission is missing a usable execution plan for the selected instance."
        return response

    plan_a = extract_plan(artifact_a.get("explain_json"))
    plan_b = extract_plan(artifact_b.get("explain_json"))
    if not plan_a or not plan_b:
        response["status"] = "missing_plan"
        response["message"] = "Analysis is unavailable for this comparison target because one submission is missing a usable execution plan for the selected instance."
        return response

    tree_a = normalize_plan(plan_a, "a", "a-root")
    tree_b = normalize_plan(plan_b, "b", "b-root")
    matches: list[dict[str, str]] = []
    match_nodes(tree_a, tree_b, matches)

    node_map_a = flatten_tree(tree_a)
    node_map_b = flatten_tree(tree_b)
    matched_pairs = []
    for pair in matches:
        node_a = node_map_a[pair["a_node_id"]]
        node_b = node_map_b[pair["b_node_id"]]
        pair_summary = summarize_pair(node_a, node_b)
        pair["delta"] = pair_summary["delta"]
        pair["explanation"] = pair_summary["explanation"]
        matched_pairs.append(pair)

    summary = build_summary(submission_a, submission_b, matched_pairs, instance_id)
    insights = build_insights(submission_a, submission_b, matched_pairs, instance_id)

    response["status"] = "ready"
    response["summary"] = summary
    response["insights"] = insights
    response["tree_a"] = tree_a
    response["tree_b"] = tree_b
    response["matches"] = matched_pairs
    response["default_selected"] = matched_pairs[0] if matched_pairs else None
    return response
