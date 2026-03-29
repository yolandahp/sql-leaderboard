import logging
import re
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


@dataclass
class InstanceResult:
    instance_id: str
    label: str
    execution_time_ms: float
    planning_time_ms: float
    total_cost: float
    rows_returned: int
    buffer_hits: int
    buffer_reads: int


def _parse_url(url: str) -> dict:
    parsed = urlparse(url)
    return {
        "dbname": parsed.path.lstrip("/"),
        "user": parsed.username,
        "password": parsed.password,
        "host": parsed.hostname,
        "port": parsed.port or 5432,
    }


def _connect(url: str):
    return psycopg2.connect(**_parse_url(url))


def _has_sql_content(sql: str) -> bool:
    """Check if a SQL string contains executable statements (not just comments)."""
    stripped = re.sub(r"--[^\n]*", "", sql)
    stripped = re.sub(r"/\*.*?\*/", "", stripped, flags=re.DOTALL)
    return bool(stripped.strip())


def _extract_tables(schema_sql: str) -> list[str]:
    return re.findall(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)",
        schema_sql,
        re.IGNORECASE,
    )


def extract_create_tables(schema_sql: str) -> str:
    """Extract only CREATE TABLE statements from schema SQL (no functions, etc.)."""
    pattern = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?\w+\s*\([^)]*\)\s*;",
        re.IGNORECASE | re.DOTALL,
    )
    return "\n".join(m.group() for m in pattern.finditer(schema_sql))


def dump_table_data(schema_sql: str, url: str | None = None) -> str:
    """Read all rows from tables in schema_sql and return deterministic INSERT statements."""
    url = url or settings.SANDBOX_DATABASE_URL
    tables = _extract_tables(schema_sql)
    if not tables:
        return ""

    conn = _connect(url)
    try:
        parts = []
        with conn.cursor() as cur:
            for table in tables:
                cur.execute(f"SELECT * FROM {table}")
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                if not rows:
                    continue
                col_list = ", ".join(columns)
                for row in rows:
                    values = ", ".join(_sql_literal(v) for v in row)
                    parts.append(f"INSERT INTO {table} ({col_list}) VALUES ({values});")
        return "\n".join(parts)
    finally:
        conn.close()


def _sql_literal(value) -> str:
    """Convert a Python value to a SQL literal."""
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        escaped = value.replace("'", "''")
        return f"'{escaped}'"
    return f"'{value}'"


def setup_sandbox(schema_sql: str, seed_sql: str, url: str | None = None) -> None:
    """Create schema and seed data in a sandbox instance."""
    url = url or settings.SANDBOX_DATABASE_URL
    conn = _connect(url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            if _has_sql_content(schema_sql):
                cur.execute(schema_sql)
            if _has_sql_content(seed_sql):
                cur.execute(seed_sql)
    finally:
        conn.close()


def teardown_sandbox(schema_sql: str, url: str | None = None) -> None:
    """Drop all tables created by the challenge schema."""
    url = url or settings.SANDBOX_DATABASE_URL
    tables = _extract_tables(schema_sql)
    if not tables:
        return

    conn = _connect(url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for table in reversed(tables):
                cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    finally:
        conn.close()


def execute_query(query: str, time_limit_ms: int, url: str | None = None) -> ExecutionResult:
    """Execute a user query in a sandbox instance inside a read-only transaction."""
    url = url or settings.SANDBOX_DATABASE_URL
    conn = _connect(url)
    try:
        conn.set_session(readonly=True, autocommit=False)
        with conn.cursor() as cur:
            cur.execute(f"SET LOCAL statement_timeout = {time_limit_ms}")

            explain_sql = (
                "EXPLAIN (ANALYZE, COSTS, BUFFERS, FORMAT JSON) " + query
            )
            cur.execute(explain_sql)
            explain_json = cur.fetchone()[0]

            plan = explain_json[0]["Plan"]
            planning_time = explain_json[0].get("Planning Time", 0.0)
            execution_time = explain_json[0].get("Execution Time", 0.0)
            total_cost = plan.get("Total Cost", 0.0)

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
        lines = msg.splitlines()
        cleaned = [
            line for line in lines
            if "ANALYZE, COSTS, BUFFERS, FORMAT JSON" not in line
        ]
        raise ExecutionError("\n".join(cleaned))
    finally:
        conn.close()


def _extract_buffer_stats(plan: dict) -> tuple[int, int]:
    """Recursively sum buffer hits and reads from a plan tree."""
    hits = plan.get("Shared Hit Blocks", 0)
    reads = plan.get("Shared Read Blocks", 0)
    for child in plan.get("Plans", []):
        child_hits, child_reads = _extract_buffer_stats(child)
        hits += child_hits
        reads += child_reads
    return hits, reads


def _get_extra_sql(instance_id: str, challenge) -> tuple[str, str]:
    """Return (extra_seed_sql, extra_setup_sql) for a specific instance."""
    index_sql = getattr(challenge, "index_sql", "") or ""
    seed_sql_large = getattr(challenge, "seed_sql_large", "") or ""

    extra_seed = ""
    extra_setup = ""

    if instance_id == "indexed" and index_sql:
        extra_setup = index_sql
    elif instance_id == "large" and seed_sql_large:
        extra_seed = seed_sql_large

    return extra_seed, extra_setup


def execute_on_all_instances(
    query: str,
    challenge,
) -> tuple[ExecutionResult, list[InstanceResult]]:
    """Run a query on all sandbox instances. Returns primary result + per-instance metrics."""
    instances = settings.SANDBOX_INSTANCES
    primary_result = None
    instance_results = []

    for inst in instances:
        url = inst["url"]
        try:
            schema = challenge.materialized_schema_sql or challenge.schema_sql
            seed = challenge.materialized_seed_sql or challenge.seed_sql
            teardown_sandbox(schema, url=url)
            setup_sandbox(schema, seed, url=url)

            extra_seed, extra_setup = _get_extra_sql(inst["id"], challenge)
            if _has_sql_content(extra_seed):
                setup_sandbox("", extra_seed, url=url)
            if _has_sql_content(extra_setup):
                setup_sandbox("", extra_setup, url=url)

            result = execute_query(query, challenge.time_limit_ms, url=url)

            if primary_result is None:
                primary_result = result

            plan = result.explain_json[0]["Plan"]
            buffer_hits, buffer_reads = _extract_buffer_stats(plan)

            instance_results.append(InstanceResult(
                instance_id=inst["id"],
                label=inst["label"],
                execution_time_ms=result.execution_time_ms,
                planning_time_ms=result.planning_time_ms,
                total_cost=result.total_cost,
                rows_returned=len(result.rows),
                buffer_hits=buffer_hits,
                buffer_reads=buffer_reads,
            ))
        finally:
            try:
                teardown_sandbox(schema, url=url)
            except Exception:
                logger.exception("Failed to tear down sandbox on %s", inst["id"])

    if primary_result is None:
        raise ExecutionError("No sandbox instances available.")

    return primary_result, instance_results
