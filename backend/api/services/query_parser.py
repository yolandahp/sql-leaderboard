import pglast


class QueryValidationError(Exception):
    pass


def validate_query(sql: str) -> str:
    """Validate and normalize a user-submitted SQL query.

    Returns the normalized SQL string.
    Raises QueryValidationError if the query is invalid or disallowed.
    """
    sql = sql.strip().rstrip(";")
    if not sql:
        raise QueryValidationError("Query cannot be empty.")

    try:
        stmts = pglast.parse_sql(sql)
    except pglast.parser.ParseError as e:
        raise QueryValidationError(f"SQL syntax error: {e}")

    if len(stmts) != 1:
        raise QueryValidationError("Only a single SQL statement is allowed.")

    stmt = stmts[0].stmt
    stmt_type = type(stmt).__name__
    if stmt_type != "SelectStmt":
        raise QueryValidationError(
            "Only SELECT statements are allowed. "
            f"Got: {stmt_type.replace('Stmt', '').upper()}"
        )

    return sql
