from itertools import combinations

import pglast
from pglast import ast, enums

from .types import ColumnRef, IndexCandidate, MAX_CANDIDATES


def _build_alias_map(from_clause) -> dict[str, str]:
    """Build a mapping from alias -> real table name from the FROM clause."""
    alias_map: dict[str, str] = {}
    if not from_clause:
        return alias_map
    for item in from_clause:
        _walk_from_item(item, alias_map)
    return alias_map


def _walk_from_item(node, alias_map: dict[str, str]):
    """Recursively walk FROM items (RangeVar, JoinExpr, subselects)."""
    if isinstance(node, ast.RangeVar):
        table_name = node.relname
        if node.alias:
            alias_map[node.alias.aliasname] = table_name
        else:
            alias_map[table_name] = table_name
    elif isinstance(node, ast.JoinExpr):
        _walk_from_item(node.larg, alias_map)
        _walk_from_item(node.rarg, alias_map)
    # Ignore subselects for now


def _resolve_column_ref(node, alias_map: dict[str, str]) -> tuple[str, str] | None:
    """Resolve a ColumnRef AST node to (real_table, column).

    Returns None if the reference cannot be resolved.
    """
    if not isinstance(node, ast.ColumnRef):
        return None
    fields = node.fields
    if len(fields) == 2:
        qualifier = fields[0].sval
        col = fields[1].sval
        table = alias_map.get(qualifier)
        if table:
            return (table, col)
    elif len(fields) == 1:
        col = fields[0].sval
        # If there is only one table, assign to it
        tables = list(set(alias_map.values()))
        if len(tables) == 1:
            return (tables[0], col)
    return None


def _classify_operator(name_tuple) -> str:
    """Classify an A_Expr operator tuple into eq/range/in/other."""
    if not name_tuple:
        return "other"
    op = name_tuple[0].sval if hasattr(name_tuple[0], "sval") else str(name_tuple[0])
    if op == "=":
        return "eq"
    if op in ("<", ">", "<=", ">=", "<>", "!="):
        return "range"
    return "other"


def _extract_where_columns(node, alias_map: dict[str, str], refs: list[ColumnRef]):
    """Recursively extract column references from a WHERE clause."""
    if node is None:
        return
    if isinstance(node, ast.A_Expr):
        kind = node.kind
        op = "other"
        if kind == enums.A_Expr_Kind.AEXPR_OP:
            op = _classify_operator(node.name)
        elif kind == enums.A_Expr_Kind.AEXPR_IN:
            op = "in"
        elif kind in (
            enums.A_Expr_Kind.AEXPR_BETWEEN,
            enums.A_Expr_Kind.AEXPR_NOT_BETWEEN,
        ):
            op = "range"

        # left expression
        resolved = _resolve_column_ref(node.lexpr, alias_map)
        if resolved:
            refs.append(ColumnRef(table=resolved[0], column=resolved[1], clause="WHERE", operator=op))
        else:
            _extract_where_columns(node.lexpr, alias_map, refs)

        # right expression
        resolved = _resolve_column_ref(node.rexpr, alias_map)
        if resolved:
            refs.append(ColumnRef(table=resolved[0], column=resolved[1], clause="WHERE", operator=op))
        else:
            _extract_where_columns(node.rexpr, alias_map, refs)

    elif isinstance(node, ast.BoolExpr):
        for arg in node.args:
            _extract_where_columns(arg, alias_map, refs)

    elif isinstance(node, ast.NullTest):
        resolved = _resolve_column_ref(node.arg, alias_map)
        if resolved:
            refs.append(ColumnRef(table=resolved[0], column=resolved[1], clause="WHERE", operator="other"))

    elif isinstance(node, ast.SubLink):
        # IN (subquery) -- extract the test expression column
        resolved = _resolve_column_ref(node.testexpr, alias_map)
        if resolved:
            refs.append(ColumnRef(table=resolved[0], column=resolved[1], clause="WHERE", operator="in"))


def _extract_join_columns(node, alias_map: dict[str, str], refs: list[ColumnRef]):
    """Extract column references from JOIN ON clauses."""
    if not isinstance(node, ast.JoinExpr):
        return
    if node.quals:
        _extract_join_quals(node.quals, alias_map, refs)
    # Recurse into nested joins
    if isinstance(node.larg, ast.JoinExpr):
        _extract_join_columns(node.larg, alias_map, refs)
    if isinstance(node.rarg, ast.JoinExpr):
        _extract_join_columns(node.rarg, alias_map, refs)


def _extract_join_quals(node, alias_map: dict[str, str], refs: list[ColumnRef]):
    """Recursively extract columns from a JOIN ON expression."""
    if isinstance(node, ast.A_Expr):
        op = _classify_operator(node.name)
        for side in (node.lexpr, node.rexpr):
            resolved = _resolve_column_ref(side, alias_map)
            if resolved:
                refs.append(ColumnRef(table=resolved[0], column=resolved[1], clause="JOIN", operator=op))
    elif isinstance(node, ast.BoolExpr):
        for arg in node.args:
            _extract_join_quals(arg, alias_map, refs)


def _extract_sort_columns(sort_clause, alias_map: dict[str, str], refs: list[ColumnRef]):
    """Extract column references from ORDER BY."""
    if not sort_clause:
        return
    for item in sort_clause:
        if isinstance(item, ast.SortBy):
            resolved = _resolve_column_ref(item.node, alias_map)
            if resolved:
                refs.append(ColumnRef(table=resolved[0], column=resolved[1], clause="ORDER_BY", operator="other"))


def _extract_group_columns(group_clause, alias_map: dict[str, str], refs: list[ColumnRef]):
    """Extract column references from GROUP BY."""
    if not group_clause:
        return
    for item in group_clause:
        resolved = _resolve_column_ref(item, alias_map)
        if resolved:
            refs.append(ColumnRef(table=resolved[0], column=resolved[1], clause="GROUP_BY", operator="other"))


def _generate_candidates(col_refs: list[ColumnRef]) -> list[IndexCandidate]:
    """Generate single-column and composite index candidates from column refs."""
    candidates: set[IndexCandidate] = set()

    # Single-column candidates for each unique (table, column)
    seen_singles: set[tuple[str, str]] = set()
    for ref in col_refs:
        key = (ref.table, ref.column)
        if key not in seen_singles:
            seen_singles.add(key)
            candidates.add(IndexCandidate(
                table=ref.table,
                columns=[ref.column],
                source_clause=ref.clause,
            ))

    # Group refs by table for composite generation
    by_table: dict[str, list[ColumnRef]] = {}
    for ref in col_refs:
        by_table.setdefault(ref.table, []).append(ref)

    for table, trefs in by_table.items():
        eq_cols = list(dict.fromkeys(r.column for r in trefs if r.operator == "eq"))
        range_cols = list(dict.fromkeys(r.column for r in trefs if r.operator == "range"))
        where_cols = list(dict.fromkeys(r.column for r in trefs if r.clause == "WHERE"))
        sort_cols = list(dict.fromkeys(r.column for r in trefs if r.clause == "ORDER_BY"))
        group_cols = list(dict.fromkeys(r.column for r in trefs if r.clause == "GROUP_BY"))

        # eq + range (equality first for B-tree ordering)
        for ec in eq_cols:
            for rc in range_cols:
                if ec != rc:
                    candidates.add(IndexCandidate(table=table, columns=[ec, rc], source_clause="WHERE"))

        # eq + sort
        for ec in eq_cols:
            for sc in sort_cols:
                if ec != sc:
                    candidates.add(IndexCandidate(table=table, columns=[ec, sc], source_clause="WHERE+ORDER_BY"))

        # Multiple WHERE columns on same table (pairs)
        if len(where_cols) >= 2:
            for c1, c2 in combinations(where_cols, 2):
                candidates.add(IndexCandidate(table=table, columns=[c1, c2], source_clause="WHERE"))

        # Multi-column ORDER BY
        if len(sort_cols) >= 2:
            candidates.add(IndexCandidate(table=table, columns=sort_cols, source_clause="ORDER_BY"))

        # Multi-column GROUP BY
        if len(group_cols) >= 2:
            candidates.add(IndexCandidate(table=table, columns=group_cols, source_clause="GROUP_BY"))

    result = sorted(candidates, key=lambda c: c.ddl)
    return result[:MAX_CANDIDATES]


def extract_columns_and_candidates(query: str) -> tuple[list[ColumnRef], list[IndexCandidate]]:
    """Stage 1: Parse SQL and generate index candidates."""
    stmts = pglast.parse_sql(query)
    if not stmts:
        return [], []
    stmt = stmts[0].stmt
    if not isinstance(stmt, ast.SelectStmt):
        return [], []

    alias_map = _build_alias_map(stmt.fromClause)
    col_refs: list[ColumnRef] = []

    # WHERE clause
    _extract_where_columns(stmt.whereClause, alias_map, col_refs)

    # JOIN clauses
    if stmt.fromClause:
        for item in stmt.fromClause:
            if isinstance(item, ast.JoinExpr):
                _extract_join_columns(item, alias_map, col_refs)

    # ORDER BY
    _extract_sort_columns(stmt.sortClause, alias_map, col_refs)

    # GROUP BY
    _extract_group_columns(stmt.groupClause, alias_map, col_refs)

    candidates = _generate_candidates(col_refs)
    return col_refs, candidates
