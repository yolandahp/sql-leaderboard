export interface ComparisonSubmission {
  id: number;
  submitted_at: string;
  label: string;
  is_correct: boolean;
  execution_time_ms: number | null;
  planning_time_ms: number | null;
  has_plan: boolean;
  instance_ids: string[];
  instance_count: number;
  kind?: "previous" | "fastest_correct" | "earlier";
}

export interface InstanceOption {
  id: string;
  label: string;
  has_plan: boolean;
}

export interface ComparisonOptionsResponse {
  current_submission: ComparisonSubmission;
  targets: ComparisonSubmission[];
  default_target_id: number | null;
  instance_options: InstanceOption[];
  default_instance_id: string | null;
}

export interface PlanNode {
  id: string;
  side: "a" | "b";
  node_type: string;
  relation_name: string | null;
  index_name: string | null;
  join_type: string | null;
  strategy: string | null;
  actual_total_time: number | null;
  actual_rows: number | null;
  plan_rows: number | null;
  loops: number | null;
  shared_hit_blocks: number;
  shared_read_blocks: number;
  hit_ratio: number | null;
  children: PlanNode[];
}

export interface MatchPair {
  a_node_id: string;
  b_node_id: string;
  delta: {
    time_ms: number | null;
    rows: number | null;
    loops: number | null;
    shared_hits: number | null;
    shared_reads: number | null;
    hit_ratio: number | null;
  };
  explanation: string;
}

export interface PlanDiffResponse {
  status: "ready" | "missing_plan";
  message?: string;
  current_submission: ComparisonSubmission;
  target_submission: ComparisonSubmission;
  instance: InstanceOption | null;
  current_submission_incorrect: boolean;
  summary?: {
    submission_a: ComparisonSubmission;
    submission_b: ComparisonSubmission;
    verdict: string;
    main_difference: string;
  };
  insights?: {
    top_insights: string[];
    structural_changes: string[];
    biggest_time_saving_node: string | null;
    biggest_buffer_improvement_node: string | null;
    row_reduction_summary: string;
  };
  tree_a?: PlanNode;
  tree_b?: PlanNode;
  matches?: MatchPair[];
  default_selected?: MatchPair | null;
}

export interface SubmissionResult {
  id: number;
  is_correct: boolean;
  execution_time_ms: number | null;
}
