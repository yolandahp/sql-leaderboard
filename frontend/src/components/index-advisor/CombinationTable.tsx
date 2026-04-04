import { useState } from "react";
import type { IndexCombinationResult } from "./types";

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

function CombinationTable({
  combinations,
}: {
  combinations: IndexCombinationResult[];
}) {
  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h5 className="text-sm font-semibold text-gray-700">Multi-Index Combination Analysis</h5>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th align="left">Indexes</Th>
              <Th align="right" tip="Total query cost when all listed indexes exist simultaneously. Lower than individual indexes suggests the optimizer can combine access paths.">Combined Cost</Th>
              <Th align="right" tip="Actual execution time (EXPLAIN ANALYZE) with all indexes created together.">Combined Time</Th>
              <Th align="left" tip="How the optimizer combines multiple indexes. BitmapAnd: intersects two bitmap scans (both conditions must match). BitmapOr: unions bitmap scans. If a single index name appears, the optimizer ignored the others.">Strategy</Th>
              <Th align="right" tip="Cost difference vs the best single index. Negative (green) means the combination outperforms any individual index. Positive (red) means adding more indexes didn't help.">vs Best Individual</Th>
            </tr>
          </thead>
          <tbody>
            {combinations.map((combo, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {combo.indexes.map((idx, j) => (
                      <code key={j} className="block text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{idx}</code>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono">{combo.combined_cost.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">{combo.combined_time_ms.toFixed(2)} ms</td>
                <td className="px-4 py-3">
                  <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-medium">{combo.plan_strategy}</span>
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${combo.vs_best_individual_pct < 0 ? "text-green-600" : "text-red-600"}`}>
                  {combo.vs_best_individual_pct > 0 ? "+" : ""}{combo.vs_best_individual_pct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CombinationTable;
