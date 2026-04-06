import type { PlanNode, MatchPair } from "./types";
import { formatMs } from "./utils";

interface FlatRow {
  node: PlanNode;
  depth: number;
  label: string;
  relation: string;
  time: string;
  rowsActual: number | null;
  rowsPlanned: number | null;
  buffers: string;
  extra: string[];
}

function getNodeLabel(node: PlanNode): string {
  let label = node.node_type;
  if (node.strategy && node.strategy !== "Plain") {
    label += ` (${node.strategy})`;
  }
  return label;
}

function getRelation(node: PlanNode): string {
  const parts: string[] = [];
  if (node.relation_name) {
    parts.push(`on ${node.relation_name}`);
  }
  if (node.index_name) {
    parts.push(`using ${node.index_name}`);
  }
  return parts.join(" ");
}

function formatBuffers(node: PlanNode): string {
  const parts: string[] = [];
  if (node.shared_hit_blocks) parts.push(`hit=${node.shared_hit_blocks}`);
  if (node.shared_read_blocks) parts.push(`read=${node.shared_read_blocks}`);
  return parts.join(" ") || "-";
}

function flattenTree(node: PlanNode, depth: number, rows: FlatRow[]): void {
  rows.push({
    node,
    depth,
    label: getNodeLabel(node),
    relation: getRelation(node),
    time: formatMs(node.actual_total_time),
    rowsActual: node.actual_rows,
    rowsPlanned: node.plan_rows,
    buffers: formatBuffers(node),
    extra: [],
  });
  for (const child of node.children) {
    flattenTree(child, depth + 1, rows);
  }
}

function PlanTreeCard({
  title,
  subtitle,
  root,
  selectedPair,
  matchByNodeId,
  onSelectPair,
}: {
  title: string;
  subtitle: string;
  root: PlanNode;
  selectedPair: MatchPair | null;
  matchByNodeId: Map<string, MatchPair>;
  onSelectPair: (pair: MatchPair | null) => void;
}) {
  const rows: FlatRow[] = [];
  flattenTree(root, 0, rows);

  return (
    <div className="bg-white rounded-xl shadow p-5 min-w-0 overflow-hidden">
      <div className="mb-4">
        <h5 className="text-sm font-semibold text-gray-900">{title}</h5>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full font-mono text-xs">
          <thead className="bg-indigo-50 sticky top-0 border-b border-indigo-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-indigo-900 uppercase tracking-wider">
                Query Plan
              </th>
              <th className="px-3 py-2 text-left font-medium text-indigo-900 uppercase tracking-wider">
                Time
              </th>
              <th className="px-3 py-2 text-left font-medium text-indigo-900 uppercase tracking-wider">
                Rows
              </th>
              <th className="px-3 py-2 text-left font-medium text-indigo-900 uppercase tracking-wider">
                Buffers
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const match = matchByNodeId.get(row.node.id) ?? null;
              const isSelected = selectedPair
                ? selectedPair.a_node_id === row.node.id ||
                  selectedPair.b_node_id === row.node.id
                : false;

              return (
                <PlanTableRow
                  key={row.node.id}
                  row={row}
                  isMatched={match != null}
                  isSelected={isSelected}
                  onClick={() => onSelectPair(match)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlanTableRow({
  row,
  isMatched,
  isSelected,
  onClick,
}: {
  row: FlatRow;
  isMatched: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const indent = "\u2003".repeat(Math.max(0, row.depth - 1));
  const arrow = row.depth > 0 ? "\u2192 " : "";

  const rowClass = isSelected
    ? "bg-indigo-50 ring-1 ring-indigo-300"
    : isMatched
      ? "cursor-pointer hover:bg-indigo-50"
      : "hover:bg-gray-50";

  return (
    <tr className={rowClass} onClick={isMatched ? onClick : undefined}>
      <td className="px-3 py-1.5 text-gray-900 whitespace-pre">
        {indent}
        {arrow && <span className="text-gray-400">{arrow}</span>}
        <span className="font-semibold">{row.label}</span>
        {row.relation && (
          <span className="text-gray-500 font-normal"> {row.relation}</span>
        )}
      </td>
      <td className="px-3 py-1.5 text-gray-900 font-medium whitespace-nowrap">
        {row.time}
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap">
        <span className="text-gray-900 font-medium">
          {row.rowsActual != null ? row.rowsActual.toLocaleString() : "n/a"}
        </span>
        {row.rowsActual != null &&
          row.rowsPlanned != null &&
          row.rowsActual !== row.rowsPlanned && (
            <span className="text-gray-400 text-[11px] ml-1">
              (est. {row.rowsPlanned.toLocaleString()})
            </span>
          )}
      </td>
      <td className="px-3 py-1.5 text-gray-900 whitespace-nowrap">
        {row.buffers}
      </td>
    </tr>
  );
}

export default PlanTreeCard;
