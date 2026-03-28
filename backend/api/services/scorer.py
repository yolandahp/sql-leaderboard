from .executor import ExecutionResult


def check_correctness(
    user_result: ExecutionResult,
    truth_result: ExecutionResult,
) -> bool:
    """Compare user query output to ground truth as unordered row sets."""
    if user_result.columns != truth_result.columns:
        # Try case-insensitive column name match
        if [c.lower() for c in user_result.columns] != [
            c.lower() for c in truth_result.columns
        ]:
            return False

    return sorted(user_result.rows) == sorted(truth_result.rows)
