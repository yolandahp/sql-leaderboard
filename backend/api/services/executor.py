import logging
from dataclasses import dataclass
from urllib.parse import urlparse

import psycopg2
from django.conf import settings

logger = logging.getLogger(__name__)


class ExecutionError(Exception):
    pass


@dataclass
class ExecutionResult:
    rows: list[tuple]
    columns: list[str]
    execution_time_ms: float
    planning_time_ms: float
    total_cost: float
    explain_json: list


def _parse_sandbox_url() -> dict:
    url = settings.SANDBOX_DATABASE_URL
    if not url:
        raise ExecutionError("Sandbox database is not configured.")
    parsed = urlparse(url)
    return {
        "dbname": parsed.path.lstrip("/"),
        "user": parsed.username,
        "password": parsed.password,
        "host": parsed.hostname,
        "port": parsed.port or 5432,
    }


def _get_connection():
    return psycopg2.connect(**_parse_sandbox_url())


def _has_sql_content(sql: str) -> bool:
    """Check if a SQL string contains executable statements (not just comments)."""
    import re

    stripped = re.sub(r"--[^\n]*", "", sql)  # remove line comments
    stripped = re.sub(r"/\*.*?\*/", "", stripped, flags=re.DOTALL)  # block comments
    return bool(stripped.strip())


def setup_sandbox(schema_sql: str, seed_sql: str) -> None:
    """Create schema and seed data in the sandbox database."""
    conn = _get_connection()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            if _has_sql_content(schema_sql):
                cur.execute(schema_sql)
            if _has_sql_content(seed_sql):
                cur.execute(seed_sql)
    finally:
        conn.close()


def teardown_sandbox(schema_sql: str) -> None:
    """Drop all tables created by the challenge schema."""
    import re

    tables = re.findall(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)",
        schema_sql,
        re.IGNORECASE,
    )
    if not tables:
        return

    conn = _get_connection()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for table in reversed(tables):
                cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    finally:
        conn.close()


def execute_query(query: str, time_limit_ms: int) -> ExecutionResult:
    """Execute a user query in the sandbox inside a read-only transaction."""
    conn = _get_connection()
    try:
        conn.set_session(readonly=True, autocommit=False)
        with conn.cursor() as cur:
            cur.execute(f"SET LOCAL statement_timeout = {time_limit_ms}")

            # Run EXPLAIN ANALYZE to get plan + timing
            explain_sql = (
                "EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT JSON) " + query
            )
            cur.execute(explain_sql)
            explain_json = cur.fetchone()[0]

            plan = explain_json[0]["Plan"]
            planning_time = explain_json[0].get("Planning Time", 0.0)
            execution_time = explain_json[0].get("Execution Time", 0.0)
            total_cost = plan.get("Total Cost", 0.0)

            # Run the actual query to get result rows
            cur.execute(query)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

        conn.rollback()
        return ExecutionResult(
            rows=rows,
            columns=columns,
            execution_time_ms=execution_time,
            planning_time_ms=planning_time,
            total_cost=total_cost,
            explain_json=explain_json,
        )
    except psycopg2.extensions.QueryCanceledError:
        conn.rollback()
        raise ExecutionError(
            f"Query exceeded the time limit of {time_limit_ms}ms."
        )
    except psycopg2.Error as e:
        conn.rollback()
        msg = str(e).strip()
        # Strip internal EXPLAIN details from error messages
        lines = msg.splitlines()
        cleaned = [
            line for line in lines
            if "ANALYZE, COSTS, BUFFERS, FORMAT JSON" not in line
        ]
        raise ExecutionError("\n".join(cleaned))
    finally:
        conn.close()
