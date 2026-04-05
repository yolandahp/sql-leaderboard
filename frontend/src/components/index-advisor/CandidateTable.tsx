import { useState } from "react";
import type { IndexRecommendation, IndexAdviceResult } from "./types";

function Tooltip({ children, tip }: { children: React.ReactNode; tip: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="underline decoration-dotted decoration-gray-400 underline-offset-2">
        {children}
      </span>
      {show && (
        <span className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-72 px-3 py-2 text-xs font-normal normal-case text-left leading-relaxed text-white bg-gray-900 rounded-lg shadow-lg pointer-events-none">
          {tip}
          <span className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-x-[6px] border-x-transparent border-b-[6px] border-b-gray-900" />
        </span>
      )}
    </span>
  );
}

function Th({
  children,
  tip,
  align = "left",
}: {
  children: React.ReactNode;
  tip?: string;
  align?: "left" | "right";
}) {
  return (
    <th className={`px-4 py-3 text-${align} text-xs font-medium text-gray-500 uppercase`}>
      {tip ? <Tooltip tip={tip}>{children}</Tooltip> : children}
    </th>
  );
}

function Tip({ children, tip }: { children: React.ReactNode; tip: string }) {
  return <Tooltip tip={tip}>{children}</Tooltip>;
}

function CandidateRow({
  rec,
  baseline,
  expanded,
  onToggle,
}: {
  rec: IndexRecommendation;
  baseline: IndexAdviceResult["baseline"];
  expanded: boolean;
  onToggle: () => void;
}) {
  const isValidated = rec.validated !== null;
  const strengthColors: Record<string, string> = {
    strong: "text-green-700 bg-green-50",
    moderate: "text-yellow-700 bg-yellow-50",
    weak: "text-red-700 bg-red-50",
    unknown: "text-gray-500 bg-gray-50",
  };
  const strengthClass = strengthColors[rec.selectivity?.recommendation_strength ?? "unknown"];

  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer hover:bg-gray-50 ${isValidated ? "" : "opacity-60"}`}>
        <td className="px-4 py-3 font-medium text-gray-900">{rec.rank}</td>
        <td className="px-4 py-3">
          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{rec.index_ddl}</code>
        </td>
        <td className="px-4 py-3 text-gray-600">{rec.source_clause}</td>
        <td className="px-4 py-3 text-right">
          {rec.selectivity ? (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${strengthClass}`}>
              {rec.selectivity.predicate_selectivity.toFixed(4)}
            </span>
          ) : "\u2014"}
        </td>
        <td className="px-4 py-3 text-right font-mono text-gray-600">
          {rec.selectivity?.n_distinct?.toLocaleString() ?? "\u2014"}
        </td>
        <td className="px-4 py-3 text-right font-mono">{rec.hypothetical.estimated_cost.toLocaleString()}</td>
        <td className="px-4 py-3 text-right font-mono">{rec.validated?.actual_cost?.toLocaleString() ?? "\u2014"}</td>
        <td className="px-4 py-3 text-right font-mono">{rec.validated ? `${rec.validated.actual_time_ms.toFixed(2)} ms` : "\u2014"}</td>
        <td className="px-4 py-3 text-right font-semibold text-green-600">
          {rec.hypothetical.cost_reduction_pct > 0 ? "-" : ""}{rec.hypothetical.cost_reduction_pct.toFixed(1)}%
        </td>
        <td className="px-4 py-3 text-right font-semibold">
          {rec.validated ? (
            <span className="text-green-600">
              {rec.validated.cost_reduction_pct > 0 ? "-" : ""}{rec.validated.cost_reduction_pct.toFixed(1)}%
            </span>
          ) : "\u2014"}
        </td>
        <td className="px-4 py-3 text-right font-mono text-gray-500">
          {rec.validated ? `${rec.validated.estimation_error_pct > 0 ? "+" : ""}${rec.validated.estimation_error_pct.toFixed(1)}%` : "\u2014"}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={11} className="px-4 py-4 bg-gray-50">
            <CandidateDetail rec={rec} baseline={baseline} />
          </td>
        </tr>
      )}
    </>
  );
}

function CandidateDetail({
  rec,
  baseline,
}: {
  rec: IndexRecommendation;
  baseline: IndexAdviceResult["baseline"];
}) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: Selectivity Info */}
      <div>
        <h6 className="text-xs font-semibold text-gray-500 uppercase mb-2">Column Statistics (pg_stats)</h6>
        {rec.selectivity ? (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <Tip tip="Number of unique values for this column in the table. From PostgreSQL's pg_stats catalog. Higher values relative to table size mean better index selectivity.">Distinct values</Tip>
              <span className="font-mono">{rec.selectivity.n_distinct.toLocaleString()} of {rec.selectivity.table_rows.toLocaleString()} rows</span>
            </div>
            <div className="flex justify-between">
              <Tip tip="Estimated fraction of rows a single equality predicate would match (1/n_distinct). Values below 0.05 (5%) are strong index candidates. Above 0.20 (20%) means the optimizer will likely ignore the index.">Predicate selectivity</Tip>
              <span className="font-mono">{rec.selectivity.predicate_selectivity.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <Tip tip="Physical ordering correlation (-1 to 1) from pg_stats. Values near +/-1 mean data is physically sorted on disk by this column, making range scans cheaper. Near 0 means random I/O — indexes are more beneficial here.">Correlation</Tip>
              <span className="font-mono">{rec.selectivity.correlation.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <Tip tip="Overall recommendation: Strong (selectivity < 5%), Moderate (5-20%), Weak (> 20%). Weak candidates rarely benefit from B-tree indexes because the optimizer prefers sequential scans when too many rows match.">Strength</Tip>
              <span className="font-medium capitalize">{rec.selectivity.recommendation_strength}</span>
            </div>
            {rec.selectivity.recommendation_strength === "weak" && (
              <p className="text-xs text-red-600 mt-2">
                Low selectivity &mdash; {rec.selectivity.n_distinct} distinct values across {rec.selectivity.table_rows.toLocaleString()} rows. The planner will likely prefer a sequential scan.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No statistics available</p>
        )}
      </div>

      {/* Right: Cost Decomposition */}
      <div>
        <h6 className="text-xs font-semibold text-gray-500 uppercase mb-2">Cost Decomposition</h6>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="text-left py-1">Metric</th>
              <th className="text-right py-1">Without Index</th>
              <th className="text-right py-1">{rec.validated ? "With Index (actual)" : "With Index (est.)"}</th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            <tr>
              <td className="py-1"><Tip tip="Estimated disk I/O cost: the dominant cost component, driven by sequential and random page reads. Indexes reduce this by replacing full table scans with targeted page fetches.">I/O Cost</Tip></td>
              <td className="text-right font-mono">{baseline.cost_breakdown.io_cost.toLocaleString()}</td>
              <td className="text-right font-mono">{(rec.validated?.cost_breakdown?.io_cost ?? rec.hypothetical.cost_breakdown.io_cost).toLocaleString()}</td>
            </tr>
            <tr>
              <td className="py-1"><Tip tip="Estimated CPU cost: processing tuples in memory. Typically much smaller than I/O cost. Computed as rows x cpu_tuple_cost (default 0.01).">CPU Cost</Tip></td>
              <td className="text-right font-mono">{baseline.cost_breakdown.cpu_cost.toLocaleString()}</td>
              <td className="text-right font-mono">{(rec.validated?.cost_breakdown?.cpu_cost ?? rec.hypothetical.cost_breakdown.cpu_cost).toLocaleString()}</td>
            </tr>
            <tr className="border-t border-gray-200 font-semibold">
              <td className="py-1">Total Cost</td>
              <td className="text-right font-mono">{baseline.estimated_cost.toLocaleString()}</td>
              <td className="text-right font-mono">{(rec.validated?.actual_cost ?? rec.hypothetical.estimated_cost).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        {rec.hypothetical.plan_node_change && (
          <p className="text-xs text-indigo-600 mt-2">Plan change: {rec.hypothetical.plan_node_change}</p>
        )}
        {rec.validated && (
          <div className="mt-2 text-xs text-gray-500">
            <span>Buffers: {rec.validated.buffer_hits} hits / {rec.validated.buffer_reads} reads</span>
            {rec.validated.buffer_hits + rec.validated.buffer_reads > 0 && (
              <span className="ml-2">
                ({Math.round((rec.validated.buffer_hits / (rec.validated.buffer_hits + rec.validated.buffer_reads)) * 100)}% hit ratio)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateTable({
  recommendations,
  baseline,
}: {
  recommendations: IndexRecommendation[];
  baseline: IndexAdviceResult["baseline"];
}) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h5 className="text-sm font-semibold text-gray-700">
          Index Candidates ({recommendations.length})
        </h5>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th align="left">#</Th>
              <Th align="left" tip="The CREATE INDEX statement that would be recommended">Index</Th>
              <Th align="left" tip="Which SQL clause the column was extracted from (WHERE, JOIN, ORDER BY, GROUP BY)">Source</Th>
              <Th align="right" tip="Predicate selectivity: fraction of rows matching a typical equality predicate on this column. Lower is better for indexing (fewer rows to scan). Computed as 1/n_distinct from pg_stats.">Selectivity</Th>
              <Th align="right" tip="Number of distinct values in the column (from pg_stats). High n_distinct relative to table size means the column is selective — good for B-tree indexes.">n_distinct</Th>
              <Th align="right" tip="Estimated query cost with this hypothetical index, as reported by PostgreSQL's EXPLAIN via HypoPG (no actual execution).">Est. Cost</Th>
              <Th align="right" tip="Actual query cost measured by EXPLAIN ANALYZE after creating a real index. Only computed for top candidates above the cost reduction threshold.">Act. Cost</Th>
              <Th align="right" tip="Actual execution time measured by EXPLAIN ANALYZE after creating a real index. Only computed for top candidates above the cost reduction threshold.">Act. Time</Th>
              <Th align="right" tip="Estimated cost reduction vs baseline (no indexes). Computed from HypoPG's hypothetical index estimate.">Est. Delta</Th>
              <Th align="right" tip="Actual cost reduction vs baseline, measured with a real index via EXPLAIN ANALYZE. Compares to how much HypoPG predicted.">Act. Delta</Th>
              <Th align="right" tip="HypoPG estimation error: (estimated - actual) / actual. Positive means HypoPG overestimated the cost, negative means it underestimated. Measures how trustworthy HypoPG's predictions are.">Est. Error</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recommendations.map((rec) => (
              <CandidateRow
                key={rec.rank}
                rec={rec}
                baseline={baseline}
                expanded={expandedRow === rec.rank}
                onToggle={() => setExpandedRow(expandedRow === rec.rank ? null : rec.rank)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CandidateTable;
