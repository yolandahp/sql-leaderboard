import logging

from .types import ValidatedCandidate, CombinationResult
from .plan_utils import run_explain_averaged

logger = logging.getLogger(__name__)


def _detect_bitmap_strategy(plan: dict) -> str:
    """Detect BitmapAnd/BitmapOr in a plan tree."""
    node_type = plan.get("Node Type", "")
    if "BitmapAnd" in node_type:
        return "BitmapAnd"
    if "BitmapOr" in node_type:
        return "BitmapOr"
    for child in plan.get("Plans", []):
        result = _detect_bitmap_strategy(child)
        if result:
            return result
    return ""


def test_combinations(
    validated: list[ValidatedCandidate],
    query: str,
    conn,
) -> list[CombinationResult]:
    """Stage 5: Create all validated indexes simultaneously and measure combined performance."""
    if len(validated) < 2:
        return []

    results: list[CombinationResult] = []
    idx_names: list[str] = []
    tables_to_analyze: set[str] = set()

    try:
        with conn.cursor() as cur:
            # Create all indexes
            for i, vc in enumerate(validated):
                idx_name = f"idx_advisor_combo_{i}"
                idx_names.append(idx_name)
                cols = ", ".join(vc.screened.candidate.columns)
                cur.execute(f"CREATE INDEX {idx_name} ON {vc.screened.candidate.table} ({cols})")
                tables_to_analyze.add(vc.screened.candidate.table)

            # ANALYZE affected tables
            for table in tables_to_analyze:
                cur.execute(f"ANALYZE {table}")

        explain = run_explain_averaged(query, conn)
        plan = explain[0]["Plan"]

        combined_cost = plan.get("Total Cost", 0.0)
        combined_time = explain[0].get("Execution Time", 0.0)

        strategy = _detect_bitmap_strategy(plan) or plan.get("Node Type", "unknown")

        # Compare to best individual
        best_individual_cost = min(vc.actual_cost for vc in validated) if validated else combined_cost
        # Negative = combination is better than best individual
        vs_best = (
            (combined_cost - best_individual_cost) / best_individual_cost * 100
        ) if best_individual_cost > 0 else 0.0

        index_ddls = [vc.screened.candidate.ddl for vc in validated]

        results.append(CombinationResult(
            indexes=index_ddls,
            combined_cost=combined_cost,
            combined_time_ms=combined_time,
            plan_strategy=strategy,
            vs_best_individual_pct=round(vs_best, 2),
            plan_json=plan,
        ))

    except Exception:
        logger.exception("Combination testing failed")
    finally:
        # Drop all combo indexes
        try:
            with conn.cursor() as cur:
                for idx_name in idx_names:
                    cur.execute(f"DROP INDEX IF EXISTS {idx_name}")
        except Exception:
            pass

    return results
