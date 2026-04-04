export interface CostBreakdown {
  io_cost: number;
  cpu_cost: number;
}

export interface SelectivityInfo {
  n_distinct: number;
  table_rows: number;
  predicate_selectivity: number;
  correlation: number;
  recommendation_strength: "strong" | "moderate" | "weak" | "unknown";
}

export interface HypotheticalResult {
  estimated_cost: number;
  cost_breakdown: CostBreakdown;
  cost_reduction_pct: number;
  plan_node_change: string | null;
}

export interface ValidatedResult {
  actual_cost: number;
  actual_time_ms: number;
  cost_breakdown: CostBreakdown;
  cost_reduction_pct: number;
  time_reduction_pct: number;
  estimation_error_pct: number;
  buffer_hits: number;
  buffer_reads: number;
}

export interface IndexRecommendation {
  rank: number;
  index_ddl: string;
  table: string;
  columns: string[];
  source_clause: string;
  selectivity: SelectivityInfo | null;
  hypothetical: HypotheticalResult;
  validated: ValidatedResult | null;
}

export interface IndexCombinationResult {
  indexes: string[];
  combined_cost: number;
  combined_time_ms: number;
  plan_strategy: string;
  vs_best_individual_pct: number;
}

export interface AnalysisMetadata {
  candidates_generated: number;
  filtered_by_selectivity: number;
  above_cost_threshold: number;
  candidates_validated: number;
  combinations_tested: number;
  cost_threshold_pct: number;
  analysis_time_ms: number;
}

export interface IndexAdviceResult {
  query: string;
  baseline: {
    estimated_cost: number;
    actual_time_ms: number;
    cost_breakdown: CostBreakdown;
  };
  recommendations: IndexRecommendation[];
  combinations: IndexCombinationResult[];
  metadata: AnalysisMetadata;
}
