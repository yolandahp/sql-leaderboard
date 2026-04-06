import type { PlanNode } from "./types";

function InsightPanel({
  insights,
  nodeMapA,
}: {
  insights: {
    top_insights: string[];
    structural_changes: string[];
    biggest_time_saving_node: string | null;
    biggest_buffer_improvement_node: string | null;
    row_reduction_summary: string;
  };
  nodeMapA: Map<string, PlanNode>;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-5 space-y-5">
      <InsightSection title="Top 3 insights" items={insights.top_insights} />
      <InsightSection title="Structural changes" items={insights.structural_changes} />
      <MetricCallout
        label="Biggest time-saving node"
        value={findNodeLabel(nodeMapA, insights.biggest_time_saving_node)}
      />
      <MetricCallout
        label="Biggest buffer improvement"
        value={findNodeLabel(nodeMapA, insights.biggest_buffer_improvement_node)}
      />
      <MetricCallout
        label="Row reduction summary"
        value={insights.row_reduction_summary}
      />
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

function findNodeLabel(nodes: Map<string, PlanNode>, nodeId: string | null) {
  if (!nodeId) return "No significant node detected.";
  const node = nodes.get(nodeId);
  if (!node) return "No significant node detected.";
  return `${node.node_type}${node.relation_name ? ` on ${node.relation_name}` : ""}`;
}

export default InsightPanel;
