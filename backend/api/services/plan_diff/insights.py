from __future__ import annotations

from typing import Any

from .artifacts import summarize_submission


def summarize_pair(node_a: dict[str, Any], node_b: dict[str, Any]) -> dict[str, Any]:
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


def build_summary(
    submission_a, submission_b, matches: list[dict[str, Any]], instance_id: str | None = None,
) -> dict[str, Any]:
    summary_a = summarize_submission(submission_a, instance_id)
    summary_b = summarize_submission(submission_b, instance_id)
    time_a = summary_a["execution_time_ms"]
    time_b = summary_b["execution_time_ms"]
    verdict = "Both submissions have comparable runtime characteristics."

    if time_a is not None and time_b is not None and time_a != time_b:
        if time_b < time_a and time_b > 0:
            ratio = round(time_a / time_b, 2)
            verdict = f"Submission B is {ratio}x faster than your current query."
        elif time_b > time_a and time_a > 0:
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
        "submission_a": summary_a,
        "submission_b": summary_b,
        "verdict": verdict,
        "main_difference": structural_change[0].upper() + structural_change[1:],
    }


def build_insights(
    submission_a, submission_b, matches: list[dict[str, Any]], instance_id: str | None = None,
) -> dict[str, Any]:
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
        "current_execution_time_ms": summarize_submission(submission_a, instance_id)["execution_time_ms"],
        "target_execution_time_ms": summarize_submission(submission_b, instance_id)["execution_time_ms"],
    }


def _round_nullable(value: float | None) -> float | None:
    if value is None:
        return None
    return round(value, 3)
