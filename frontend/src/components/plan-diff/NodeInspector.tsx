import type { PlanNode, MatchPair } from "./types";
import Metric from "./Metric";
import { formatMs, formatNumber, formatInt } from "./utils";

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

export default NodeInspector;
