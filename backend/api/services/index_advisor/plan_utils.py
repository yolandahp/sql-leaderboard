from ..executor import _extract_buffer_stats, run_explain_averaged  # noqa: F401



def _find_scan_nodes(plan: dict) -> list[dict]:
    """Recursively find scan-type nodes in a plan tree."""
    results = []
    node_type = plan.get("Node Type", "")
    if "Scan" in node_type or "Index" in node_type:
        results.append(plan)
    for child in plan.get("Plans", []):
        results.extend(_find_scan_nodes(child))
    return results


def _detect_plan_node_change(baseline_plan: dict, new_plan: dict) -> str | None:
    """Compare baseline and new plan to describe scan type changes.

    Returns e.g. "Seq Scan -> Index Scan on orders" or None if no change.
    """
    baseline_scans = _find_scan_nodes(baseline_plan)
    new_scans = _find_scan_nodes(new_plan)

    # Build a map of table -> scan type for baseline
    baseline_by_table: dict[str, str] = {}
    for s in baseline_scans:
        table = s.get("Relation Name", "")
        if table:
            baseline_by_table[table] = s.get("Node Type", "")

    # Find the first scan type change
    for s in new_scans:
        nt = s.get("Node Type", "")
        table = s.get("Relation Name", "")
        if table and "Index" in nt:
            old_type = baseline_by_table.get(table, "Seq Scan")
            if old_type != nt:
                return f"{old_type} -> {nt} on {table}"

    return None
