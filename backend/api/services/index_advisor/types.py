from dataclasses import dataclass, field

MAX_CANDIDATES = 20
TOP_N_VALIDATE = 3
COST_THRESHOLD_PCT = 10.0  # minimum cost reduction % to consider


@dataclass
class ColumnRef:
    table: str
    column: str
    clause: str       # "WHERE", "JOIN", "ORDER_BY", "GROUP_BY"
    operator: str     # "eq", "range", "in", "other"


@dataclass
class IndexCandidate:
    table: str
    columns: list[str]
    source_clause: str
    ddl: str = ""

    def __post_init__(self):
        if not self.ddl:
            cols = ", ".join(self.columns)
            self.ddl = f"CREATE INDEX ON {self.table} ({cols})"

    def __eq__(self, other):
        return isinstance(other, IndexCandidate) and self.ddl == other.ddl

    def __hash__(self):
        return hash(self.ddl)


@dataclass
class SelectivityInfo:
    n_distinct: float
    table_rows: int
    predicate_selectivity: float
    correlation: float
    recommendation_strength: str


@dataclass
class ScreenedCandidate:
    candidate: IndexCandidate
    selectivity: SelectivityInfo | None
    estimated_cost: float
    cost_reduction_pct: float
    plan_node_change: str | None
    plan_json: dict | None


@dataclass
class ValidatedCandidate:
    screened: ScreenedCandidate
    actual_cost: float
    actual_time_ms: float
    cost_breakdown: dict
    estimation_error_pct: float
    buffer_hits: int
    buffer_reads: int
    plan_json: dict | None


@dataclass
class CombinationResult:
    indexes: list[str]
    combined_cost: float
    combined_time_ms: float
    plan_strategy: str
    vs_best_individual_pct: float
    plan_json: dict | None


@dataclass
class BaselineResult:
    estimated_cost: float
    actual_time_ms: float
    plan_json: dict | None
    cost_breakdown: dict
    top_node_type: str
