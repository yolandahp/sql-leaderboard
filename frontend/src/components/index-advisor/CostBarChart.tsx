import type { IndexRecommendation } from "./types";

function CostBarChart({
  recommendations,
  baselineCost,
}: {
  recommendations: IndexRecommendation[];
  baselineCost: number;
}) {
  if (baselineCost <= 0) return null;
  const items = recommendations.slice(0, 8);

  return (
    <div className="space-y-3">
      {/* Baseline reference */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 w-48 truncate text-right">Baseline (no index)</span>
        <div className="flex-1 flex items-center gap-2">
          <div className="flex h-5 flex-1">
            <div className="bg-red-300 h-full rounded" style={{ width: "100%" }} />
          </div>
          <span className="text-xs font-mono text-gray-600 w-20 text-right">{baselineCost.toLocaleString()}</span>
        </div>
      </div>

      {/* Candidate bars */}
      {items.map((rec) => {
        const cost = rec.validated?.actual_cost ?? rec.hypothetical.estimated_cost;
        const ioCost = rec.validated?.cost_breakdown?.io_cost ?? rec.hypothetical.cost_breakdown.io_cost;
        const cpuCost = rec.validated?.cost_breakdown?.cpu_cost ?? rec.hypothetical.cost_breakdown.cpu_cost;
        const pct = baselineCost > 0 ? (cost / baselineCost) * 100 : 0;
        const ioPct = cost > 0 ? (ioCost / cost) * pct : 0;
        const cpuPct = pct - ioPct;
        const isValidated = rec.validated !== null;

        return (
          <div key={rec.rank} className="flex items-center gap-3">
            <span className={`text-xs w-48 truncate text-right ${isValidated ? "text-gray-700" : "text-gray-400"}`}>
              {rec.index_ddl.replace("CREATE INDEX ON ", "")}
            </span>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex h-5 flex-1">
                <div className="bg-blue-400 h-full rounded-l" style={{ width: `${Math.max(ioPct, 0.5)}%` }} title={`I/O: ${ioCost.toLocaleString()}`} />
                <div className="bg-blue-200 h-full rounded-r" style={{ width: `${Math.max(cpuPct, 0.5)}%` }} title={`CPU: ${cpuCost.toLocaleString()}`} />
              </div>
              <span className="text-xs font-mono text-gray-600 w-20 text-right">{cost.toLocaleString()}</span>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-300 rounded inline-block" /> Baseline
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-blue-400 rounded inline-block" /> I/O Cost
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-blue-200 rounded inline-block" /> CPU Cost
        </span>
      </div>
    </div>
  );
}

export default CostBarChart;
