from datetime import date, datetime
from decimal import Decimal

from .executor import ExecutionResult


def check_correctness(
    user_result: ExecutionResult,
    truth_columns: list[str],
    truth_rows: list,
) -> bool:
    """Compare user query output to ground truth.

    - Order-insensitive (row sets, not sequences)
    - Column-order-insensitive (matches by name)
    - Case-insensitive column names
    - Decimal/float normalization

    truth_columns/truth_rows can come from an ExecutionResult or a stored
    JSON snapshot.
    """
    user_cols = [c.lower() for c in user_result.columns]
    truth_cols = [c.lower() for c in truth_columns]

    if sorted(user_cols) != sorted(truth_cols):
        return False

    # Reorder user rows to match truth column order if needed
    if user_cols == truth_cols:
        user_rows = user_result.rows
    else:
        col_mapping = [user_cols.index(tc) for tc in truth_cols]
        user_rows = [
            tuple(row[i] for i in col_mapping) for row in user_result.rows
        ]

    normalized_user = sorted(_normalize_rows(user_rows), key=_sort_key)
    normalized_truth = sorted(_normalize_rows(truth_rows), key=_sort_key)
    return normalized_user == normalized_truth


def _sort_key(row: tuple):
    """Sort key that handles None values by placing them before non-None."""
    return tuple(
        (0, "") if v is None else (1, str(v)) for v in row
    )


def _normalize_rows(rows: list[tuple]) -> list[tuple]:
    return [tuple(_normalize_value(v) for v in row) for row in rows]


def _normalize_value(value):
    if value is None:
        return None
    if isinstance(value, (Decimal, float, int)):
        return round(Decimal(str(value)), 6).normalize()
    if isinstance(value, (date, datetime)):
        return str(value)
    return value
