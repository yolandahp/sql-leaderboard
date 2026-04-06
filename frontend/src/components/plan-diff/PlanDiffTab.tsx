import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../api/client";
import type {
  SubmissionResult,
  ComparisonOptionsResponse,
  PlanDiffResponse,
  MatchPair,
} from "./types";
import { flattenTree, formatMs } from "./utils";
import StateCard from "./StateCard";
import SummaryStrip from "./SummaryStrip";
import InsightPanel from "./InsightPanel";
import PlanTreeCard from "./PlanTreeCard";
import NodeInspector from "./NodeInspector";

const LOADING_STEPS = [
  "Loading plan artifacts",
  "Matching plan nodes",
  "Computing metric deltas",
  "Generating summary insights",
];

function PlanDiffTab({
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
            <TargetSelector
              options={options}
              selectedTargetId={selectedTargetId}
              selectedInstanceId={selectedInstanceId}
              showInstanceSelector={showInstanceSelector}
              runningDiff={runningDiff}
              selectedTarget={selectedTarget}
              onSelectTarget={setSelectedTargetId}
              onSelectInstance={setSelectedInstanceId}
              onRunDiff={runDiffAnalysis}
            />
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
              <SummaryStrip summary={diff.summary} />

              <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr_1fr]" data-testid="diff-layout">
                <InsightPanel insights={diff.insights} nodeMapA={nodeMapA} />

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

function TargetSelector({
  options,
  selectedTargetId,
  selectedInstanceId,
  showInstanceSelector,
  runningDiff,
  selectedTarget,
  onSelectTarget,
  onSelectInstance,
  onRunDiff,
}: {
  options: ComparisonOptionsResponse;
  selectedTargetId: number | null;
  selectedInstanceId: string | null;
  showInstanceSelector: boolean;
  runningDiff: boolean;
  selectedTarget: ComparisonOptionsResponse["targets"][number] | null;
  onSelectTarget: (id: number) => void;
  onSelectInstance: (id: string) => void;
  onRunDiff: () => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Current Submission
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <SubmissionPill label={options.current_submission.label} tone="gray" />
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
              onChange={(e) => onSelectTarget(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-64"
              data-testid="target-selector"
            >
              {options.targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                  {target.kind === "fastest_correct"
                    ? " \u2022 fastest correct"
                    : target.kind === "previous"
                      ? " \u2022 previous"
                      : ""}
                  {target.has_plan ? "" : " \u2022 no plan"}
                </option>
              ))}
            </select>
          </label>

          {showInstanceSelector && (
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Instance
              <select
                value={selectedInstanceId ?? ""}
                onChange={(e) => onSelectInstance(e.target.value)}
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
            onClick={onRunDiff}
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

export default PlanDiffTab;
