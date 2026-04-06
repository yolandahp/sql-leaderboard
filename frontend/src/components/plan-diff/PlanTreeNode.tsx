import type { PlanNode, MatchPair } from "./types";
import Metric from "./Metric";
import { formatMs, formatNumber, formatInt } from "./utils";

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

export default PlanTreeNode;
