import logging

from .types import IndexCandidate, ScreenedCandidate
from .plan_utils import _detect_plan_node_change

logger = logging.getLogger(__name__)


def screen_with_hypopg(
    candidates: list[IndexCandidate],
    query: str,
    baseline_cost: float,
    baseline_plan: dict,
    conn,
) -> list[ScreenedCandidate]:
    """Stage 3: Use HypoPG to estimate cost with hypothetical indexes."""
    screened: list[ScreenedCandidate] = []
    for candidate in candidates:
        try:
            with conn.cursor() as cur:
                # Create hypothetical index
                cur.execute("SELECT * FROM hypopg_create_index(%s)", [candidate.ddl])

                # Get estimated cost
                cur.execute(f"EXPLAIN (COSTS, FORMAT JSON) {query}")
                explain = cur.fetchone()[0]
                plan = explain[0]["Plan"]
                est_cost = plan.get("Total Cost", 0.0)

                # Detect plan change vs baseline
                node_change = _detect_plan_node_change(baseline_plan, plan)

                # Clean up
                cur.execute("SELECT hypopg_reset()")

            reduction = ((baseline_cost - est_cost) / baseline_cost * 100) if baseline_cost > 0 else 0.0

            screened.append(ScreenedCandidate(
                candidate=candidate,
                selectivity=None,  # filled in later
                estimated_cost=est_cost,
                cost_reduction_pct=reduction,
                plan_node_change=node_change,
                plan_json=plan,
            ))
        except Exception:
            logger.exception("HypoPG screening failed for %s", candidate.ddl)
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT hypopg_reset()")
            except Exception:
                pass

    screened.sort(key=lambda s: s.cost_reduction_pct, reverse=True)
    return screened
