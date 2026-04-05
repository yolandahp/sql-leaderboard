import logging

from .types import IndexCandidate, SelectivityInfo

logger = logging.getLogger(__name__)


def analyze_selectivity(candidate: IndexCandidate, conn) -> SelectivityInfo | None:
    """Query pg_stats for the lead column of a candidate index."""
    table = candidate.table
    lead_col = candidate.columns[0]
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT n_distinct, correlation, null_frac, most_common_vals, most_common_freqs "
                "FROM pg_stats WHERE tablename = %s AND attname = %s",
                [table, lead_col],
            )
            row = cur.fetchone()
            if not row:
                return None
            n_distinct, correlation, null_frac, mcv, mcf = row

            cur.execute(
                "SELECT reltuples::bigint FROM pg_class WHERE relname = %s",
                [table],
            )
            rrow = cur.fetchone()
            table_rows = int(rrow[0]) if rrow and rrow[0] and rrow[0] > 0 else 0

            # Compute predicate selectivity
            if n_distinct is None or n_distinct == 0:
                predicate_selectivity = 1.0
            elif n_distinct < 0:
                # Negative means fraction of rows that are distinct
                predicate_selectivity = -n_distinct  # e.g., -0.5 means ~50% distinct
                if predicate_selectivity > 0:
                    predicate_selectivity = 1.0 / (predicate_selectivity * max(table_rows, 1))
            else:
                predicate_selectivity = 1.0 / n_distinct

            # Classify
            if predicate_selectivity < 0.05:
                strength = "strong"
            elif predicate_selectivity < 0.20:
                strength = "moderate"
            else:
                strength = "weak"

            return SelectivityInfo(
                n_distinct=float(n_distinct) if n_distinct is not None else 0.0,
                table_rows=table_rows,
                predicate_selectivity=predicate_selectivity,
                correlation=float(correlation) if correlation is not None else 0.0,
                recommendation_strength=strength,
            )
    except Exception:
        logger.exception("Selectivity analysis failed for %s(%s)", table, lead_col)
        return None
