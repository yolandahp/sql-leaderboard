import type { ComparisonSubmission } from "./types";
import { formatMs } from "./utils";

function SummaryStrip({
  summary,
}: {
  summary: {
    submission_a: ComparisonSubmission;
    submission_b: ComparisonSubmission;
    verdict: string;
    main_difference: string;
  };
}) {
  return (
    <div
      className="bg-white rounded-xl shadow p-5 border border-gray-100"
      data-testid="verdict-strip"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <SummarySubmissionCard title="Submission A" submission={summary.submission_a} />
        <SummarySubmissionCard title="Submission B" submission={summary.submission_b} />
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-2">
            Verdict
          </p>
          <p className="text-sm font-semibold text-indigo-900 mb-2">
            {summary.verdict}
          </p>
          <p className="text-sm text-indigo-800">
            {summary.main_difference}
          </p>
        </div>
      </div>
    </div>
  );
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

export default SummaryStrip;
