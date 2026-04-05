import logging

from .types import ScreenedCandidate, ValidatedCandidate, COST_THRESHOLD_PCT, TOP_N_VALIDATE
from .plan_utils import _extract_buffer_stats

logger = logging.getLogger(__name__)


def validate_candidates(
    screened: list[ScreenedCandidate],
    query: str,
    conn,
) -> list[ValidatedCandidate]:
    """Stage 4: Create real indexes for top candidates and measure actual performance."""
    # Filter to candidates with positive cost reduction
    viable = [s for s in screened if s.cost_reduction_pct > COST_THRESHOLD_PCT]
    top = viable[:TOP_N_VALIDATE]
    validated: list[ValidatedCandidate] = []

    for i, sc in enumerate(top):
        idx_name = f"idx_advisor_{i}"
        cols = ", ".join(sc.candidate.columns)
        create_ddl = f"CREATE INDEX {idx_name} ON {sc.candidate.table} ({cols})"
        try:
            with conn.cursor() as cur:
                cur.execute(create_ddl)
                cur.execute(f"ANALYZE {sc.candidate.table}")
                cur.execute(f"EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT JSON) {query}")
                explain = cur.fetchone()[0]
                plan = explain[0]["Plan"]

                actual_cost = plan.get("Total Cost", 0.0)
                actual_time = explain[0].get("Execution Time", 0.0)
                buf_hits, buf_reads = _extract_buffer_stats(plan)

                # Estimation error: (hypothetical - actual) / actual * 100
                # Positive = HypoPG overestimated, Negative = HypoPG underestimated
                est = sc.estimated_cost
                err_pct = ((est - actual_cost) / actual_cost * 100) if actual_cost > 0 else 0.0

                # Cost breakdown heuristic
                rows = plan.get("Plan Rows", 0)
                cpu_cost = rows * 0.01
                io_cost = max(actual_cost - cpu_cost, 0.0)

                cur.execute(f"DROP INDEX IF EXISTS {idx_name}")

            validated.append(ValidatedCandidate(
                screened=sc,
                actual_cost=actual_cost,
                actual_time_ms=actual_time,
                cost_breakdown={"io_cost": round(io_cost, 2), "cpu_cost": round(cpu_cost, 2)},
                estimation_error_pct=round(err_pct, 2),
                buffer_hits=buf_hits,
                buffer_reads=buf_reads,
                plan_json=plan,
            ))
        except Exception:
            logger.exception("Validation failed for %s", create_ddl)
            try:
                with conn.cursor() as cur:
                    cur.execute(f"DROP INDEX IF EXISTS {idx_name}")
            except Exception:
                pass

    return validated
