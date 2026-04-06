import type { ComparisonOptionsResponse } from "./types";
import { formatMs } from "./utils";

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

export default TargetSelector;
