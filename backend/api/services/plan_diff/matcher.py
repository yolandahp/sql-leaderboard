from __future__ import annotations

from collections import defaultdict
from typing import Any


def match_nodes(node_a: dict[str, Any], node_b: dict[str, Any], matches: list[dict[str, str]]) -> None:
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

    for signature, group_a in by_signature_a.items():
        group_b = by_signature_b.get(signature, [])
        for child_a, child_b in zip(group_a, group_b):
            matched_a_ids.add(child_a["id"])
            matched_b_ids.add(child_b["id"])
            match_nodes(child_a, child_b, matches)

    unmatched_a = [child for child in children_a if child["id"] not in matched_a_ids]
    unmatched_b = [child for child in children_b if child["id"] not in matched_b_ids]
    for child_a, child_b in zip(unmatched_a, unmatched_b):
        match_nodes(child_a, child_b, matches)


def _node_signature(node: dict[str, Any]) -> tuple[Any, ...]:
    return (
        node.get("node_type"),
        node.get("relation_name"),
        node.get("index_name"),
        node.get("join_type"),
        node.get("strategy"),
    )
