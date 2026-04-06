import logging
import time

from django.conf import settings

from ..executor import _connect, setup_sandbox, teardown_sandbox
from .types import (
    BaselineResult,
    SelectivityInfo,
    COST_THRESHOLD_PCT,
)
from .ast_extractor import extract_columns_and_candidates
from .plan_utils import run_explain_averaged
from .selectivity import analyze_selectivity
from .screening import screen_with_hypopg
from .validation import validate_candidates
from .combinations import test_combinations

logger = logging.getLogger(__name__)


def _get_baseline(query: str, conn) -> BaselineResult:
    """Run the query without any advisory indexes to get baseline metrics."""
    explain = run_explain_averaged(query, conn)
    plan = explain[0]["Plan"]
    estimated_cost = plan.get("Total Cost", 0.0)
    actual_time = explain[0].get("Execution Time", 0.0)
    top_node_type = plan.get("Node Type", "")

    rows = plan.get("Plan Rows", 0)
    cpu_cost = rows * 0.01
    io_cost = max(estimated_cost - cpu_cost, 0.0)

    return BaselineResult(
        estimated_cost=estimated_cost,
        actual_time_ms=actual_time,
        plan_json=plan,
        cost_breakdown={"io_cost": round(io_cost, 2), "cpu_cost": round(cpu_cost, 2)},
        top_node_type=top_node_type,
    )


def analyze_indexes(query: str, challenge, baseline_time_ms: float = 0.0) -> dict:
    """Main orchestrator: run the full index recommendation pipeline.

    Args:
        query: The SQL query to analyze.
        challenge: Challenge model instance with schema/seed SQL.
        baseline_time_ms: Optional pre-measured baseline time.

    Returns:
        JSON-serializable dict with recommendations.
    """
    start = time.time()
    schema_sql = challenge.materialized_schema_sql or challenge.schema_sql
    seed_sql = challenge.materialized_seed_sql or challenge.seed_sql
    large_seed_sql = getattr(challenge, "seed_sql_large", "") or ""

    # Use the "large" (no-index) sandbox instance for meaningful baseline analysis.
    # Fall back to the first instance if no "large" instance is configured.
    instance = next(
        (i for i in settings.SANDBOX_INSTANCES if i["id"] == "large"),
        settings.SANDBOX_INSTANCES[0],
    )
    url = instance["url"]

    metadata = {
        "candidates_generated": 0,
        "filtered_by_selectivity": 0,
        "above_cost_threshold": 0,
        "candidates_validated": 0,
        "combinations_tested": 0,
        "cost_threshold_pct": COST_THRESHOLD_PCT,
        "analysis_time_ms": 0.0,
    }

    try:
        # Setup sandbox — use large seed as baseline (no indexes) when available
        teardown_sandbox(schema_sql, url=url)
        if large_seed_sql:
            setup_sandbox(schema_sql, large_seed_sql, url=url)
        else:
            setup_sandbox(schema_sql, seed_sql, url=url)

        conn = _connect(url)
        conn.autocommit = True

        try:
            # Set statement timeout to prevent runaway queries (6x the challenge limit)
            timeout_ms = challenge.time_limit_ms * 6
            with conn.cursor() as cur:
                cur.execute("SET statement_timeout = %s", [timeout_ms])

            # Run ANALYZE on all tables so pg_stats is populated
            with conn.cursor() as cur:
                cur.execute("ANALYZE")

            # Stage 1: AST Column Extraction
            col_refs, candidates = extract_columns_and_candidates(query)
            metadata["candidates_generated"] = len(candidates)

            # Stage 2: Selectivity Analysis
            selectivity_map: dict[str, SelectivityInfo | None] = {}
            for cand in candidates:
                sel = analyze_selectivity(cand, conn)
                selectivity_map[cand.ddl] = sel

            weak_count = sum(
                1 for s in selectivity_map.values()
                if s and s.recommendation_strength == "weak"
            )
            metadata["filtered_by_selectivity"] = weak_count

            # Baseline
            baseline = _get_baseline(query, conn)

            # Stage 3: HypoPG Screening
            baseline_plan = baseline.plan_json if baseline.plan_json else {}
            screened = screen_with_hypopg(candidates, query, baseline.estimated_cost, baseline_plan, conn)

            # Attach selectivity info
            for sc in screened:
                sc.selectivity = selectivity_map.get(sc.candidate.ddl)

            above_threshold = [s for s in screened if s.cost_reduction_pct > COST_THRESHOLD_PCT]
            metadata["above_cost_threshold"] = len(above_threshold)

            # Stage 4: Real Index Validation
            validated = validate_candidates(screened, query, conn)
            metadata["candidates_validated"] = len(validated)

            # Stage 5: Combination Testing
            combo_results = test_combinations(validated, query, conn)
            metadata["combinations_tested"] = len(combo_results)

        finally:
            conn.close()

        # Build response
        recommendations = []
        for rank, sc in enumerate(screened, start=1):
            rec: dict = {
                "rank": rank,
                "index_ddl": sc.candidate.ddl,
                "table": sc.candidate.table,
                "columns": sc.candidate.columns,
                "source_clause": sc.candidate.source_clause,
                "selectivity": None,
                "hypothetical": {
                    "estimated_cost": round(sc.estimated_cost, 2),
                    "cost_breakdown": {
                        "io_cost": round(max(sc.estimated_cost - (sc.plan_json or {}).get("Plan Rows", 0) * 0.01, 0), 2),
                        "cpu_cost": round((sc.plan_json or {}).get("Plan Rows", 0) * 0.01, 2),
                    },
                    "cost_reduction_pct": round(sc.cost_reduction_pct, 2),
                    "plan_node_change": sc.plan_node_change,
                },
                "validated": None,
            }
            if sc.selectivity:
                rec["selectivity"] = {
                    "n_distinct": sc.selectivity.n_distinct,
                    "table_rows": sc.selectivity.table_rows,
                    "predicate_selectivity": round(sc.selectivity.predicate_selectivity, 6),
                    "correlation": round(sc.selectivity.correlation, 4),
                    "recommendation_strength": sc.selectivity.recommendation_strength,
                }

            # Attach validation data if available
            for vc in validated:
                if vc.screened.candidate.ddl == sc.candidate.ddl:
                    time_reduction = (
                        (baseline.actual_time_ms - vc.actual_time_ms) / baseline.actual_time_ms * 100
                    ) if baseline.actual_time_ms > 0 else 0.0
                    cost_reduction = (
                        (baseline.estimated_cost - vc.actual_cost) / baseline.estimated_cost * 100
                    ) if baseline.estimated_cost > 0 else 0.0
                    rec["validated"] = {
                        "actual_cost": round(vc.actual_cost, 2),
                        "actual_time_ms": round(vc.actual_time_ms, 3),
                        "cost_breakdown": vc.cost_breakdown,
                        "cost_reduction_pct": round(cost_reduction, 2),
                        "time_reduction_pct": round(time_reduction, 2),
                        "estimation_error_pct": vc.estimation_error_pct,
                        "buffer_hits": vc.buffer_hits,
                        "buffer_reads": vc.buffer_reads,
                    }
                    break

            recommendations.append(rec)

        combos_out = []
        for cr in combo_results:
            combos_out.append({
                "indexes": cr.indexes,
                "combined_cost": round(cr.combined_cost, 2),
                "combined_time_ms": round(cr.combined_time_ms, 3),
                "plan_strategy": cr.plan_strategy,
                "vs_best_individual_pct": cr.vs_best_individual_pct,
            })

        elapsed = (time.time() - start) * 1000
        metadata["analysis_time_ms"] = round(elapsed, 1)

        return {
            "query": query,
            "baseline": {
                "estimated_cost": round(baseline.estimated_cost, 2),
                "actual_time_ms": round(baseline.actual_time_ms, 3),
                "cost_breakdown": baseline.cost_breakdown,
            },
            "recommendations": recommendations,
            "combinations": combos_out,
            "metadata": metadata,
        }

    except Exception:
        logger.exception("Index advisor analysis failed")
        elapsed = (time.time() - start) * 1000
        metadata["analysis_time_ms"] = round(elapsed, 1)
        return {
            "query": query,
            "baseline": {"estimated_cost": 0, "actual_time_ms": baseline_time_ms, "cost_breakdown": {"io_cost": 0, "cpu_cost": 0}},
            "recommendations": [],
            "combinations": [],
            "metadata": metadata,
        }
    finally:
        try:
            teardown_sandbox(schema_sql, url=url)
        except Exception:
            logger.exception("Failed to tear down sandbox after index analysis")
