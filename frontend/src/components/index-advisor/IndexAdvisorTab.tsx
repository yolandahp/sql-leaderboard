import type { IndexAdviceResult } from "./types";
import MetricBox from "./MetricBox";
import CandidateTable from "./CandidateTable";
import CostBarChart from "./CostBarChart";
import CombinationTable from "./CombinationTable";

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function IndexAdvisorTab({
  advice,
  loading,
  error,
  onAnalyze,
}: {
  advice: IndexAdviceResult | null;
  loading: boolean;
  error: string;
  onAnalyze: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header + Analyze Button */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="font-semibold text-gray-900">HypoPG Index Advisor</h4>
            <p className="text-sm text-gray-500">
              Analyzes your query to recommend indexes, validates with real execution, and tests multi-index combinations.
            </p>
          </div>
          <button
            onClick={onAnalyze}
            disabled={loading}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "Analyzing..." : "Analyze Indexes"}
          </button>
        </div>
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {!advice && !loading && (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          Click &quot;Analyze Indexes&quot; to run the recommendation pipeline.
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-xl shadow p-8 flex items-center justify-center gap-3 text-gray-500">
          <Spinner className="h-6 w-6 text-indigo-600" />
          <span>Running five-stage pipeline: AST extraction, selectivity analysis, HypoPG screening, real validation, combination testing...</span>
        </div>
      )}

      {advice && (
        <>
          {/* Baseline Banner */}
          <div className="bg-white rounded-xl shadow p-5">
            <h5 className="text-sm font-semibold text-gray-700 mb-3">Baseline (No Indexes)</h5>
            <div className="grid grid-cols-4 gap-4">
              <MetricBox label="Estimated Cost" value={advice.baseline.estimated_cost.toLocaleString()} />
              <MetricBox label="Actual Time" value={`${advice.baseline.actual_time_ms.toFixed(2)} ms`} />
              <MetricBox label="I/O Cost" value={advice.baseline.cost_breakdown.io_cost.toLocaleString()} />
              <MetricBox label="CPU Cost" value={advice.baseline.cost_breakdown.cpu_cost.toLocaleString()} />
            </div>
          </div>

          {/* Candidate Table */}
          <CandidateTable recommendations={advice.recommendations} baseline={advice.baseline} />

          {/* Cost Comparison Chart */}
          {advice.recommendations.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6">
              <h5 className="text-sm font-semibold text-gray-700 mb-4">Cost Comparison (I/O vs CPU)</h5>
              <CostBarChart recommendations={advice.recommendations} baselineCost={advice.baseline.estimated_cost} />
            </div>
          )}

          {/* Combination Results */}
          {advice.combinations.length > 0 && (
            <CombinationTable combinations={advice.combinations} />
          )}

          {/* Pipeline Metadata */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 flex items-center justify-between">
            <span>
              Pipeline: {advice.metadata.candidates_generated} generated
              {advice.metadata.filtered_by_selectivity > 0 && ` \u2192 ${advice.metadata.filtered_by_selectivity} filtered by selectivity`}
              {" \u2192 "}{advice.metadata.above_cost_threshold} above {advice.metadata.cost_threshold_pct}% threshold
              {" \u2192 "}{advice.metadata.candidates_validated} validated
            </span>
            <span className="font-mono">{advice.metadata.analysis_time_ms.toFixed(0)} ms</span>
          </div>
        </>
      )}
    </div>
  );
}

export default IndexAdvisorTab;
