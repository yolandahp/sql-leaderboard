from __future__ import annotations

from collections import defaultdict
from typing import Any


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
        "has_plan": bool(_available_instance_ids(submission)),
        "instance_ids": _available_instance_ids(submission),
        "instance_count": len(instances),
    }


def list_comparison_targets(current_submission, submissions) -> dict[str, Any]:
    current_summary = summarize_submission(current_submission)
    instances = _instance_options(current_submission)

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
    instance_id = instance_id or _default_instance_id(submission_a)
    artifact_a = _get_instance_artifact(submission_a, instance_id)
    artifact_b = _get_instance_artifact(submission_b, instance_id)
    response = {
        "current_submission": summarize_submission(submission_a),
        "target_submission": summarize_submission(submission_b),
        "instance": _resolve_instance_option(submission_a, instance_id),
        "current_submission_incorrect": not submission_a.is_correct,
    }

    if artifact_a is None or artifact_b is None:
        response["status"] = "missing_plan"
        response["message"] = "Analysis is unavailable for this comparison target because one submission is missing a usable execution plan for the selected instance."
        return response

    plan_a = (artifact_a.get("explain_json") or [{}])[0].get("Plan")
    plan_b = (artifact_b.get("explain_json") or [{}])[0].get("Plan")
    if not plan_a or not plan_b:
        response["status"] = "missing_plan"
        response["message"] = "Analysis is unavailable for this comparison target because one submission is missing a usable execution plan for the selected instance."
        return response

    tree_a = _normalize_plan(plan_a, "a", "a-root")
    tree_b = _normalize_plan(plan_b, "b", "b-root")
    matches: list[dict[str, str]] = []
    _match_nodes(tree_a, tree_b, matches)

    node_map_a = _flatten_tree(tree_a)
    node_map_b = _flatten_tree(tree_b)
    matched_pairs = []
    for pair in matches:
        node_a = node_map_a[pair["a_node_id"]]
        node_b = node_map_b[pair["b_node_id"]]
        pair_summary = _summarize_pair(node_a, node_b)
        pair["delta"] = pair_summary["delta"]
        pair["explanation"] = pair_summary["explanation"]
        matched_pairs.append(pair)

    summary = _build_summary(submission_a, submission_b, matched_pairs)
    insights = _build_insights(submission_a, submission_b, matched_pairs)

    response["status"] = "ready"
    response["summary"] = summary
    response["insights"] = insights
    response["tree_a"] = tree_a
    response["tree_b"] = tree_b
    response["matches"] = matched_pairs
    response["default_selected"] = matched_pairs[0] if matched_pairs else None
    return response


def _available_instance_ids(submission) -> list[str]:
    artifacts = submission.plan_artifacts or {}
    instances = artifacts.get("instances") or []
    return [
        inst["instance_id"]
        for inst in instances
        if (inst.get("explain_json") or [{}])[0].get("Plan")
    ]


def _instance_options(submission) -> list[dict[str, Any]]:
    artifacts = submission.plan_artifacts or {}
    instances = artifacts.get("instances") or []
    return [
        {
            "id": inst["instance_id"],
            "label": inst["label"],
            "has_plan": bool((inst.get("explain_json") or [{}])[0].get("Plan")),
        }
        for inst in instances
    ]


def _default_instance_id(submission) -> str | None:
    artifacts = submission.plan_artifacts or {}
    return artifacts.get("primary_instance_id") or next(iter(_available_instance_ids(submission)), None)


def _resolve_instance_option(submission, instance_id: str | None) -> dict[str, Any] | None:
    if not instance_id:
        return None
    for option in _instance_options(submission):
        if option["id"] == instance_id:
            return option
    return {"id": instance_id, "label": instance_id, "has_plan": False}


def _get_instance_artifact(submission, instance_id: str | None) -> dict[str, Any] | None:
    if not instance_id:
        return None
    artifacts = submission.plan_artifacts or {}
    for inst in artifacts.get("instances") or []:
        if inst["instance_id"] == instance_id:
            return inst
    return None


def _normalize_plan(plan: dict[str, Any], side: str, node_id: str) -> dict[str, Any]:
    relation_name = plan.get("Relation Name")
    index_name = plan.get("Index Name")
    node_type = plan.get("Node Type", "Unknown")
    loops = _safe_number(plan.get("Actual Loops"))
    total_time = _safe_number(plan.get("Actual Total Time"))
    shared_hits = _safe_int(plan.get("Shared Hit Blocks"))
    shared_reads = _safe_int(plan.get("Shared Read Blocks"))
    total_buffers = shared_hits + shared_reads
    hit_ratio = round((shared_hits / total_buffers) * 100, 1) if total_buffers else None

    children = [
        _normalize_plan(child, side, f"{node_id}.{index}")
        for index, child in enumerate(plan.get("Plans", []))
    ]

    return {
        "id": node_id,
        "side": side,
        "node_type": node_type,
        "relation_name": relation_name,
        "index_name": index_name,
        "join_type": plan.get("Join Type"),
        "strategy": plan.get("Strategy"),
        "actual_total_time": total_time,
        "actual_rows": _safe_number(plan.get("Actual Rows")),
        "plan_rows": _safe_number(plan.get("Plan Rows")),
        "loops": loops,
        "shared_hit_blocks": shared_hits,
        "shared_read_blocks": shared_reads,
        "hit_ratio": hit_ratio,
        "children": children,
    }


def _flatten_tree(root: dict[str, Any]) -> dict[str, dict[str, Any]]:
    nodes = {}

    def visit(node: dict[str, Any]) -> None:
        nodes[node["id"]] = node
        for child in node["children"]:
            visit(child)

    visit(root)
    return nodes


def _node_signature(node: dict[str, Any]) -> tuple[Any, ...]:
    return (
        node.get("node_type"),
        node.get("relation_name"),
        node.get("index_name"),
        node.get("join_type"),
        node.get("strategy"),
    )


def _match_nodes(node_a: dict[str, Any], node_b: dict[str, Any], matches: list[dict[str, str]]) -> None:
    matches.append({"a_node_id": node_a["id"], "b_node_id": node_b["id"]})

    children_a = node_a.get("children", [])
    children_b = node_b.get("children", [])

    by_signature_a: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    by_signature_b: dict[tuple[Any, ...], list[dict[str, Any]]] = defaultdict(list)
    for child in children_a:
        by_signature_a[_node_signature(child)].append(child)
    for child in children_b:
        by_signature_b[_node_signature(child)].append(child)

    matched_a_ids: set[str] = set()
    matched_b_ids: set[str] = set()

    # Stable MVP heuristic:
    # 1. match siblings with the same local signature in sibling order
    # 2. then match any remaining siblings by index position
    # This keeps matches anchored to the parent subtree without requiring
    # a heavier global tree-edit-distance implementation.
    for signature, group_a in by_signature_a.items():
        group_b = by_signature_b.get(signature, [])
        for child_a, child_b in zip(group_a, group_b):
            matched_a_ids.add(child_a["id"])
            matched_b_ids.add(child_b["id"])
            _match_nodes(child_a, child_b, matches)

    unmatched_a = [child for child in children_a if child["id"] not in matched_a_ids]
    unmatched_b = [child for child in children_b if child["id"] not in matched_b_ids]
    for child_a, child_b in zip(unmatched_a, unmatched_b):
        _match_nodes(child_a, child_b, matches)


def _safe_number(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


def _safe_int(value: Any) -> int:
    if value is None:
        return 0
    return int(value)


def _summarize_pair(node_a: dict[str, Any], node_b: dict[str, Any]) -> dict[str, Any]:
    time_a = node_a.get("actual_total_time") or 0.0
    time_b = node_b.get("actual_total_time") or 0.0
    reads_a = node_a.get("shared_read_blocks") or 0
    reads_b = node_b.get("shared_read_blocks") or 0
    rows_a = node_a.get("actual_rows") or 0.0
    rows_b = node_b.get("actual_rows") or 0.0

    delta = {
        "time_ms": round(time_b - time_a, 3),
        "rows": round(rows_b - rows_a, 3),
        "loops": round((node_b.get("loops") or 0.0) - (node_a.get("loops") or 0.0), 3),
        "shared_hits": (node_b.get("shared_hit_blocks") or 0) - (node_a.get("shared_hit_blocks") or 0),
        "shared_reads": reads_b - reads_a,
        "hit_ratio": _round_nullable((node_b.get("hit_ratio") or 0) - (node_a.get("hit_ratio") or 0)),
    }

    fragments = []
    if node_a.get("node_type") != node_b.get("node_type"):
        fragments.append(f"{node_a.get('node_type')} was replaced by {node_b.get('node_type')}")
    if reads_a != reads_b:
        direction = "fewer" if reads_b < reads_a else "more"
        fragments.append(f"{abs(reads_b - reads_a)} {direction} shared reads")
    if time_a != time_b:
        faster = "faster" if time_b < time_a else "slower"
        fragments.append(f"{abs(time_b - time_a):.2f} ms {faster}")
    if rows_a != rows_b:
        fragments.append(f"rows changed from {int(rows_a)} to {int(rows_b)}")

    if not fragments:
        fragments.append("node metrics are broadly similar")

    return {"delta": delta, "explanation": ", ".join(fragments)}


def _build_summary(submission_a, submission_b, matches: list[dict[str, Any]]) -> dict[str, Any]:
    time_a = submission_a.execution_time_ms or 0.0
    time_b = submission_b.execution_time_ms or 0.0
    ratio = None
    verdict = "Both submissions have comparable runtime characteristics."

    if time_a and time_b:
        if time_b < time_a:
            ratio = round(time_a / time_b, 2)
            verdict = f"Submission B is {ratio}x faster than your current query."
        elif time_b > time_a:
            ratio = round(time_b / time_a, 2)
            verdict = f"Submission B is {ratio}x slower than your current query."

    structural_change = next(
        (
            pair["explanation"]
            for pair in matches
            if "replaced by" in pair["explanation"]
        ),
        "Main difference: runtime and buffer usage changed without a major node-type swap.",
    )

    return {
        "submission_a": summarize_submission(submission_a),
        "submission_b": summarize_submission(submission_b),
        "verdict": verdict,
        "main_difference": structural_change[0].upper() + structural_change[1:],
    }


def _build_insights(submission_a, submission_b, matches: list[dict[str, Any]]) -> dict[str, Any]:
    structural_changes = [
        pair["explanation"]
        for pair in matches
        if "replaced by" in pair["explanation"]
    ][:3]

    biggest_time_saving = max(
        matches,
        key=lambda pair: ((pair["delta"].get("time_ms") or 0) * -1),
        default=None,
    )
    biggest_buffer_gain = max(
        matches,
        key=lambda pair: ((pair["delta"].get("shared_reads") or 0) * -1),
        default=None,
    )
    row_shift = max(
        matches,
        key=lambda pair: abs(pair["delta"].get("rows") or 0),
        default=None,
    )

    top_insights = []
    if biggest_time_saving:
        top_insights.append(
            f"Largest timing change: {biggest_time_saving['explanation']}."
        )
    if biggest_buffer_gain:
        top_insights.append(
            f"Biggest buffer shift: {biggest_buffer_gain['explanation']}."
        )
    if row_shift:
        top_insights.append(
            f"Most visible row-volume change: {row_shift['explanation']}."
        )

    while len(top_insights) < 3:
        top_insights.append("No additional large plan deltas were detected for this comparison.")

    return {
        "top_insights": top_insights[:3],
        "structural_changes": structural_changes or ["No major node-type changes were detected."],
        "biggest_time_saving_node": biggest_time_saving["a_node_id"] if biggest_time_saving else None,
        "biggest_buffer_improvement_node": biggest_buffer_gain["a_node_id"] if biggest_buffer_gain else None,
        "row_reduction_summary": (
            row_shift["explanation"] if row_shift else "No significant row-count change detected."
        ),
        "current_execution_time_ms": submission_a.execution_time_ms,
        "target_execution_time_ms": submission_b.execution_time_ms,
    }


def _round_nullable(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value, 3)
