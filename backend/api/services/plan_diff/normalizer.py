from __future__ import annotations

from typing import Any


def normalize_plan(plan: dict[str, Any], side: str, node_id: str) -> dict[str, Any]:
    relation_name = plan.get("Relation Name")
    index_name = plan.get("Index Name")
    node_type = plan.get("Node Type", "Unknown")
    loops = safe_number(plan.get("Actual Loops"))
    total_time = safe_number(plan.get("Actual Total Time"))
    shared_hits = safe_int(plan.get("Shared Hit Blocks"))
    shared_reads = safe_int(plan.get("Shared Read Blocks"))
    total_buffers = shared_hits + shared_reads
    hit_ratio = round((shared_hits / total_buffers) * 100, 1) if total_buffers else None

    children = [
        normalize_plan(child, side, f"{node_id}.{index}")
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
        "actual_rows": safe_number(plan.get("Actual Rows")),
        "plan_rows": safe_number(plan.get("Plan Rows")),
        "loops": loops,
        "shared_hit_blocks": shared_hits,
        "shared_read_blocks": shared_reads,
        "hit_ratio": hit_ratio,
        "children": children,
    }


def flatten_tree(root: dict[str, Any]) -> dict[str, dict[str, Any]]:
    nodes = {}

    def visit(node: dict[str, Any]) -> None:
        nodes[node["id"]] = node
        for child in node["children"]:
            visit(child)

    visit(root)
    return nodes


def safe_number(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


def safe_int(value: Any) -> int:
    if value is None:
        return 0
    return int(value)
