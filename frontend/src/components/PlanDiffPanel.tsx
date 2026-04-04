import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client";

interface SubmissionResult {
  id: number;
  is_correct: boolean;
  execution_time_ms: number | null;
}

interface ComparisonSubmission {
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

interface InstanceOption {
  id: string;
  label: string;
  has_plan: boolean;
}

interface ComparisonOptionsResponse {
  current_submission: ComparisonSubmission;
  targets: ComparisonSubmission[];
  default_target_id: number | null;
  instance_options: InstanceOption[];
  default_instance_id: string | null;
}

interface PlanNode {
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

interface MatchPair {
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

interface PlanDiffResponse {
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

const LOADING_STEPS = [
  "Loading plan artifacts",
  "Matching plan nodes",
  "Computing metric deltas",
  "Generating summary insights",
];

function PlanDiffPanel({
  challengeId,
  result,
}: {
  challengeId: number;
  result: SubmissionResult;
}) {
  const [options, setOptions] = useState<ComparisonOptionsResponse | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [diff, setDiff] = useState<PlanDiffResponse | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [runningDiff, setRunningDiff] = useState(false);
  const [error, setError] = useState("");
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [selectedPair, setSelectedPair] = useState<MatchPair | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingOptions(true);
    setError("");
    setDiff(null);
    setSelectedPair(null);

    apiFetch<ComparisonOptionsResponse>(
      `/api/submissions/${result.id}/comparison-targets?challenge_id=${challengeId}`
    )
      .then((data) => {
        if (cancelled) return;
        setOptions(data);
        setSelectedTargetId(data.default_target_id);
        setSelectedInstanceId(data.default_instance_id);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load comparison targets.");
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [challengeId, result.id]);

  useEffect(() => {
    if (!runningDiff) return;
    setLoadingStepIndex(0);
    const timer = window.setInterval(() => {
      setLoadingStepIndex((current) =>
        current === LOADING_STEPS.length - 1 ? current : current + 1
      );
    }, 500);
    return () => window.clearInterval(timer);
  }, [runningDiff]);

  const matchByNodeId = useMemo(() => {
    const mapping = new Map<string, MatchPair>();
    for (const match of diff?.matches ?? []) {
      mapping.set(match.a_node_id, match);
      mapping.set(match.b_node_id, match);
    }
    return mapping;
  }, [diff]);

  const nodeMapA = useMemo(() => flattenTree(diff?.tree_a), [diff?.tree_a]);
  const nodeMapB = useMemo(() => flattenTree(diff?.tree_b), [diff?.tree_b]);
  const selectedTarget = options?.targets.find((target) => target.id === selectedTargetId) ?? null;
  const showInstanceSelector = (options?.instance_options.length ?? 0) > 1;

  const runDiffAnalysis = async () => {
    if (!selectedTargetId) return;
    setRunningDiff(true);
    setError("");
    setDiff(null);
    setSelectedPair(null);

    try {
      const response = await apiFetch<PlanDiffResponse>(
        `/api/submissions/${result.id}/plan-diff`,
        {
          method: "POST",
          body: JSON.stringify({
            target_submission_id: selectedTargetId,
            instance_id: selectedInstanceId,
          }),
        }
      );
      setDiff(response);
      setSelectedPair(response.default_selected ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to run plan diff.");
    } finally {
      setRunningDiff(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="plan-diff-panel">
      {result.is_correct === false && (
        <div
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800"
          data-testid="incorrect-submission-note"
        >
          Comparison is available for execution behavior only. Leaderboard relevance does not apply until this submission is correct.
        </div>
      )}

      {loadingOptions ? (
        <StateCard
          title="Plan Diff: Compare Submissions"
          message="Loading comparison candidates for this challenge."
          helper={LOADING_STEPS[0]}
        />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      ) : options && options.targets.length === 0 ? (
        <StateCard
          title="Plan Diff: Compare Submissions"
          message="Plan diff analysis will be available once you have multiple submissions for this challenge."
          helper="Submit another query attempt to compare execution strategies."
          testId="empty-state"
        />
      ) : (
        <>
          {options && (
            <div className="bg-white rounded-xl shadow p-5 space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Current Submission
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <SubmissionPill
                      label={options.current_submission.label}
                      tone="gray"
                    />
                    <SubmissionPill
                      label={options.current_submission.is_correct ? "Correct" : "Incorrect"}
                      tone={options.current_submission.is_correct ? "green" : "yellow"}
                    />
                    <SubmissionPill
                      label={formatMs(options.current_submission.execution_time_ms)}
                      tone="indigo"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <label className="flex flex-col gap-1 text-sm text-gray-600">
                    Comparison Target
                    <select
                      value={selectedTargetId ?? ""}
                      onChange={(e) => setSelectedTargetId(Number(e.target.value))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-64"
                      data-testid="target-selector"
                    >
                      {options.targets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.label}
                          {target.kind === "fastest_correct"
                            ? " • fastest correct"
                            : target.kind === "previous"
                              ? " • previous"
                              : ""}
                          {target.has_plan ? "" : " • no plan"}
                        </option>
                      ))}
                    </select>
                  </label>

                  {showInstanceSelector && (
                    <label className="flex flex-col gap-1 text-sm text-gray-600">
                      Instance
                      <select
                        value={selectedInstanceId ?? ""}
                        onChange={(e) => setSelectedInstanceId(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        data-testid="instance-selector"
                      >
                        {options.instance_options.map((instance) => (
                          <option key={instance.id} value={instance.id}>
                            {instance.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={runDiffAnalysis}
                    disabled={!selectedTargetId || runningDiff}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
                    data-testid="run-diff-button"
                  >
                    {runningDiff ? "Analyzing..." : "Run Diff Analysis"}
                  </button>
                </div>
              </div>

              {selectedTarget && (
                <p className="text-xs text-gray-500" data-testid="target-helper">
                  Comparing your current submission against {selectedTarget.label.toLowerCase()} for this challenge.
                </p>
              )}
            </div>
          )}

          {runningDiff && (
            <StateCard
              title="Plan Diff: Compare Submissions"
              message={LOADING_STEPS[loadingStepIndex]}
              helper="The SQL editor and result panel stay unchanged while the diff is computed."
              testId="loading-state"
            />
          )}

          {diff?.status === "missing_plan" && !runningDiff && (
            <StateCard
              title="Plan Diff: Compare Submissions"
              message={diff.message ?? "Analysis is unavailable for this comparison target."}
              helper="Select another earlier submission or a different instance and try again."
              testId="missing-plan-state"
            />
          )}

          {diff?.status === "ready" && diff.summary && diff.insights && diff.tree_a && diff.tree_b && !runningDiff && (
            <>
              <div
                className="bg-white rounded-xl shadow p-5 border border-gray-100"
                data-testid="verdict-strip"
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  <SummarySubmissionCard title="Submission A" submission={diff.summary.submission_a} />
                  <SummarySubmissionCard title="Submission B" submission={diff.summary.submission_b} />
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-2">
                      Verdict
                    </p>
                    <p className="text-sm font-semibold text-indigo-900 mb-2">
                      {diff.summary.verdict}
                    </p>
                    <p className="text-sm text-indigo-800">
                      {diff.summary.main_difference}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr_1fr]" data-testid="diff-layout">
                <div className="bg-white rounded-xl shadow p-5 space-y-5">
                  <InsightSection title="Top 3 insights" items={diff.insights.top_insights} />
                  <InsightSection title="Structural changes" items={diff.insights.structural_changes} />
                  <MetricCallout
                    label="Biggest time-saving node"
                    value={findNodeLabel(nodeMapA, diff.insights.biggest_time_saving_node)}
                  />
                  <MetricCallout
                    label="Biggest buffer improvement"
                    value={findNodeLabel(nodeMapA, diff.insights.biggest_buffer_improvement_node)}
                  />
                  <MetricCallout
                    label="Row reduction summary"
                    value={diff.insights.row_reduction_summary}
                  />
                </div>

                <PlanTreeCard
                  title="Plan A"
                  subtitle="Current submission"
                  root={diff.tree_a}
                  selectedPair={selectedPair}
                  matchByNodeId={matchByNodeId}
                  onSelectPair={setSelectedPair}
                />

                <PlanTreeCard
                  title="Plan B"
                  subtitle="Comparison target"
                  root={diff.tree_b}
                  selectedPair={selectedPair}
                  matchByNodeId={matchByNodeId}
                  onSelectPair={setSelectedPair}
                />
              </div>

              <NodeInspector
                pair={selectedPair}
                nodeMapA={nodeMapA}
                nodeMapB={nodeMapB}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

function StateCard({
  title,
  message,
  helper,
  testId,
}: {
  title: string;
  message: string;
  helper: string;
  testId?: string;
}) {
  return (
    <div
      className="bg-white rounded-xl shadow p-6 border border-gray-100"
      data-testid={testId}
    >
      <h4 className="font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-sm text-gray-600 mb-2">{message}</p>
      <p className="text-sm text-gray-400">{helper}</p>
    </div>
  );
}

function SubmissionPill({
  label,
  tone,
}: {
  label: string;
  tone: "gray" | "green" | "yellow" | "indigo";
}) {
  const classes = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-800",
    yellow: "bg-yellow-100 text-yellow-800",
    indigo: "bg-indigo-100 text-indigo-700",
  }[tone];
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${classes}`}>{label}</span>;
}

function SummarySubmissionCard({
  title,
  submission,
}: {
  title: string;
  submission: ComparisonSubmission;
}) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{title}</p>
      <div className="space-y-1 text-sm">
        <p className="font-semibold text-gray-900">{submission.label}</p>
        <p className="text-gray-600">
          Runtime: <span className="font-medium text-gray-900">{formatMs(submission.execution_time_ms)}</span>
        </p>
        <p className="text-gray-600">
          Correctness:{" "}
          <span className={submission.is_correct ? "text-green-700 font-medium" : "text-yellow-700 font-medium"}>
            {submission.is_correct ? "Correct" : "Incorrect"}
          </span>
        </p>
      </div>
    </div>
  );
}

function InsightSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h5 className="text-sm font-semibold text-gray-900 mb-2">{title}</h5>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCallout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}

function PlanTreeCard({
  title,
  subtitle,
  root,
  selectedPair,
  matchByNodeId,
  onSelectPair,
}: {
  title: string;
  subtitle: string;
  root: PlanNode;
  selectedPair: MatchPair | null;
  matchByNodeId: Map<string, MatchPair>;
  onSelectPair: (pair: MatchPair | null) => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-5 min-w-0 overflow-hidden">
      <div className="mb-4">
        <h5 className="text-sm font-semibold text-gray-900">{title}</h5>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <div
        className="space-y-3 min-w-0"
        data-testid={`${title.toLowerCase().replace(" ", "-")}-tree`}
      >
        <PlanTreeNode
          node={root}
          depth={0}
          selectedPair={selectedPair}
          matchByNodeId={matchByNodeId}
          onSelectPair={onSelectPair}
        />
      </div>
    </div>
  );
}

function PlanTreeNode({
  node,
  depth,
  selectedPair,
  matchByNodeId,
  onSelectPair,
}: {
  node: PlanNode;
  depth: number;
  selectedPair: MatchPair | null;
  matchByNodeId: Map<string, MatchPair>;
  onSelectPair: (pair: MatchPair | null) => void;
}) {
  const match = matchByNodeId.get(node.id) ?? null;
  const isSelected = selectedPair
    ? selectedPair.a_node_id === node.id || selectedPair.b_node_id === node.id
    : false;
  const isMatched = match != null;
  const indent = Math.min(depth, 4) * 12;

  return (
    <div className="min-w-0" style={{ paddingLeft: `${indent}px` }}>
      <button
        type="button"
        onClick={() => onSelectPair(match)}
        className={`w-full min-w-0 box-border text-left rounded-xl border p-3 transition ${
          isSelected
            ? "border-indigo-500 bg-indigo-50"
            : isMatched
              ? "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
              : "border-dashed border-gray-200 hover:bg-gray-50"
        }`}
        data-testid={`plan-node-${node.id}`}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2 mb-2">
          <span className="max-w-full px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-900 text-white break-words">
            {node.node_type}
          </span>
          {node.relation_name && (
            <span className="min-w-0 text-xs text-gray-500 break-all">
              {node.relation_name}
            </span>
          )}
          {node.index_name && (
            <span className="min-w-0 text-xs text-indigo-600 break-all">
              {node.index_name}
            </span>
          )}
          {!isMatched && (
            <span className="text-xs text-yellow-700 bg-yellow-100 rounded-full px-2 py-0.5">
              unmatched
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-xs text-gray-600">
          <Metric label="Time" value={formatMs(node.actual_total_time)} />
          <Metric label="Rows" value={formatNumber(node.actual_rows)} />
          <Metric label="Hits" value={formatInt(node.shared_hit_blocks)} />
          <Metric label="Reads" value={formatInt(node.shared_read_blocks)} />
        </div>
      </button>

      {node.children.length > 0 && (
        <div className="space-y-3 mt-3 min-w-0">
          {node.children.map((child) => (
            <PlanTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedPair={selectedPair}
              matchByNodeId={matchByNodeId}
              onSelectPair={onSelectPair}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeInspector({
  pair,
  nodeMapA,
  nodeMapB,
}: {
  pair: MatchPair | null;
  nodeMapA: Map<string, PlanNode>;
  nodeMapB: Map<string, PlanNode>;
}) {
  if (!pair) {
    return (
      <div className="bg-white rounded-xl shadow p-5 text-sm text-gray-500" data-testid="node-inspector-empty">
        Select a plan node to inspect side-by-side metrics and deltas.
      </div>
    );
  }

  const nodeA = nodeMapA.get(pair.a_node_id);
  const nodeB = nodeMapB.get(pair.b_node_id);

  if (!nodeA || !nodeB) {
    return (
      <div className="bg-white rounded-xl shadow p-5 text-sm text-gray-500">
        This node does not have a matched counterpart in the selected comparison.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4" data-testid="node-inspector">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h5 className="text-sm font-semibold text-gray-900">Node Inspector</h5>
          <p className="text-sm text-gray-500">
            {nodeA.node_type} vs {nodeB.node_type}
          </p>
        </div>
        <p className="text-sm text-indigo-700">{pair.explanation}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InspectorSide title="Node A" node={nodeA} />
        <InspectorSide title="Node B" node={nodeB} />
      </div>

      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Delta explanation</p>
        <p className="text-sm text-gray-700">{buildDeltaExplanation(nodeA, nodeB)}</p>
      </div>
    </div>
  );
}

function InspectorSide({ title, node }: { title: string; node: PlanNode }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <h6 className="text-sm font-semibold text-gray-900 mb-3">{title}</h6>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Metric label="Node type" value={node.node_type} />
        <Metric label="Relation / index" value={node.relation_name ?? node.index_name ?? "n/a"} />
        <Metric label="Actual total time" value={formatMs(node.actual_total_time)} />
        <Metric label="Actual rows" value={formatNumber(node.actual_rows)} />
        <Metric label="Loops" value={formatNumber(node.loops)} />
        <Metric label="Shared hits" value={formatInt(node.shared_hit_blocks)} />
        <Metric label="Shared reads" value={formatInt(node.shared_read_blocks)} />
        <Metric label="Hit ratio" value={node.hit_ratio == null ? "n/a" : `${node.hit_ratio}%`} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm text-gray-800 break-words">{value}</p>
    </div>
  );
}

function flattenTree(root?: PlanNode): Map<string, PlanNode> {
  const nodes = new Map<string, PlanNode>();
  if (!root) return nodes;

  const visit = (node: PlanNode) => {
    nodes.set(node.id, node);
    for (const child of node.children) visit(child);
  };

  visit(root);
  return nodes;
}

function findNodeLabel(nodes: Map<string, PlanNode>, nodeId: string | null) {
  if (!nodeId) return "No significant node detected.";
  const node = nodes.get(nodeId);
  if (!node) return "No significant node detected.";
  return `${node.node_type}${node.relation_name ? ` on ${node.relation_name}` : ""}`;
}

function buildDeltaExplanation(nodeA: PlanNode, nodeB: PlanNode) {
  const parts = [];
  if (nodeA.node_type !== nodeB.node_type) {
    parts.push(`${nodeA.node_type} changed to ${nodeB.node_type}`);
  }

  if ((nodeA.actual_total_time ?? 0) !== (nodeB.actual_total_time ?? 0)) {
    const delta = (nodeB.actual_total_time ?? 0) - (nodeA.actual_total_time ?? 0);
    parts.push(
      `${Math.abs(delta).toFixed(2)} ms ${delta < 0 ? "faster" : "slower"} at this node`
    );
  }

  if (nodeA.shared_read_blocks !== nodeB.shared_read_blocks) {
    const delta = nodeB.shared_read_blocks - nodeA.shared_read_blocks;
    parts.push(
      `${Math.abs(delta).toLocaleString()} ${delta < 0 ? "fewer" : "more"} shared reads`
    );
  }

  if ((nodeA.actual_rows ?? 0) !== (nodeB.actual_rows ?? 0)) {
    parts.push(
      `actual rows moved from ${formatNumber(nodeA.actual_rows)} to ${formatNumber(nodeB.actual_rows)}`
    );
  }

  return parts.length > 0
    ? `${parts.join(", ")}.`
    : "The matched nodes are structurally similar and expose only minor metric differences.";
}

function formatMs(value: number | null) {
  return value == null ? "n/a" : `${value.toFixed(2)} ms`;
}

function formatNumber(value: number | null) {
  if (value == null) return "n/a";
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

function formatInt(value: number | null) {
  return value == null ? "n/a" : Math.round(value).toLocaleString();
}

export default PlanDiffPanel;
