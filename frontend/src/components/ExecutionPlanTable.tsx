import { useState } from "react";

interface InstancePlan {
  label: string;
  config: string;
  explain_output: string | null;
}

interface PlanJsonNode {
  "Node Type": string;
  "Strategy"?: string;
  "Scan Direction"?: string;
  "Relation Name"?: string;
  "Alias"?: string;
  "Index Name"?: string;
  "Join Type"?: string;
  "Hash Cond"?: string;
  "Index Cond"?: string;
  "Merge Cond"?: string;
  "Filter"?: string;
  "Rows Removed by Filter"?: number;
  "Hash Buckets"?: number;
  "Hash Batches"?: number;
  "Peak Memory Usage"?: number;
  "Sort Key"?: string[];
  "Sort Method"?: string;
  "Sort Space Used"?: number;
  "Startup Cost": number;
  "Total Cost": number;
  "Plan Rows": number;
  "Actual Startup Time": number;
  "Actual Total Time": number;
  "Actual Rows": number;
  "Actual Loops": number;
  "Shared Hit Blocks"?: number;
  "Shared Read Blocks"?: number;
  Plans?: PlanJsonNode[];
}

interface PlanJson {
  Plan: PlanJsonNode;
  "Planning Time": number;
  "Execution Time": number;
}

interface FlatRow {
  depth: number;
  label: string;
  relation: string;
  cost: string;
  time: string;
  rowsActual: number;
  rowsPlanned: number;
  loops: number;
  buffers: string;
  extra: string[];
}

function getNodeLabel(node: PlanJsonNode): string {
  let label = node["Node Type"];
  if (node["Strategy"] && node["Strategy"] !== "Plain") {
    label += ` (${node["Strategy"]})`;
  }
  if (node["Scan Direction"] && node["Scan Direction"] !== "Forward") {
    label += " Backward";
  }
  return label;
}

function getNodeRelation(node: PlanJsonNode): string {
  const parts: string[] = [];
  if (node["Relation Name"]) {
    parts.push(`on ${node["Relation Name"]}`);
    if (node["Alias"] && node["Alias"] !== node["Relation Name"]) {
      parts.push(node["Alias"]);
    }
  }
  if (node["Index Name"]) {
    parts.push(`using ${node["Index Name"]}`);
  }
  return parts.join(" ");
}

function getExtraInfo(node: PlanJsonNode): string[] {
  const lines: string[] = [];
  if (node["Hash Cond"]) lines.push(`Hash Cond: ${node["Hash Cond"]}`);
  if (node["Index Cond"]) lines.push(`Index Cond: ${node["Index Cond"]}`);
  if (node["Merge Cond"]) lines.push(`Merge Cond: ${node["Merge Cond"]}`);
  if (node["Filter"]) {
    let line = `Filter: ${node["Filter"]}`;
    if (node["Rows Removed by Filter"] != null) {
      line += `  (removed ${node["Rows Removed by Filter"].toLocaleString()} rows)`;
    }
    lines.push(line);
  }
  if (node["Hash Buckets"] != null) {
    lines.push(
      `Buckets: ${node["Hash Buckets"].toLocaleString()}  Batches: ${node["Hash Batches"]}  Memory Usage: ${node["Peak Memory Usage"]}kB`,
    );
  }
  if (node["Sort Key"]) {
    lines.push(`Sort Key: ${node["Sort Key"].join(", ")}`);
  }
  if (node["Sort Method"]) {
    lines.push(
      `Sort Method: ${node["Sort Method"]}  Memory: ${node["Sort Space Used"]}kB`,
    );
  }
  return lines;
}

function formatBuffers(node: PlanJsonNode): string {
  const parts: string[] = [];
  const hits = node["Shared Hit Blocks"] ?? 0;
  const reads = node["Shared Read Blocks"] ?? 0;
  if (hits) parts.push(`hit=${hits}`);
  if (reads) parts.push(`read=${reads}`);
  return parts.join(" ") || "-";
}

function flattenPlan(
  node: PlanJsonNode,
  depth: number,
  rows: FlatRow[],
): void {
  rows.push({
    depth,
    label: getNodeLabel(node),
    relation: getNodeRelation(node),
    cost: `${node["Startup Cost"].toFixed(2)}..${node["Total Cost"].toFixed(2)}`,
    time: `${node["Actual Startup Time"].toFixed(3)}..${node["Actual Total Time"].toFixed(3)} ms`,
    rowsActual: node["Actual Rows"],
    rowsPlanned: node["Plan Rows"],
    loops: node["Actual Loops"],
    buffers: formatBuffers(node),
    extra: getExtraInfo(node),
  });

  if (node.Plans) {
    for (const child of node.Plans) {
      flattenPlan(child, depth + 1, rows);
    }
  }
}

function parsePlan(json: string): PlanJson[] | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function PlanTableBody({ plan }: { plan: PlanJson }) {
  const rows: FlatRow[] = [];
  flattenPlan(plan.Plan, 0, rows);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full font-mono text-xs">
        <thead className="bg-indigo-50 sticky top-0 border-b border-indigo-200">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-indigo-900 uppercase tracking-wider min-w-[380px]">
              Query Plan
            </th>
            <th className="px-3 py-2 text-left font-medium text-indigo-900 uppercase tracking-wider">
              Cost
            </th>
            <th className="px-3 py-2 text-left font-medium text-indigo-900 uppercase tracking-wider">
              Time
            </th>
            <th className="px-3 py-2 text-left font-medium text-indigo-900 uppercase tracking-wider">
              Rows
            </th>
            <th className="px-3 py-2 text-left font-medium text-indigo-900 uppercase tracking-wider">
              Loops
            </th>
            <th className="px-3 py-2 text-left font-medium text-indigo-900 uppercase tracking-wider">
              Buffers
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <PlanRow key={i} row={row} />
          ))}
          <tr className="bg-indigo-50 border-t border-indigo-200">
            <td
              colSpan={6}
              className="px-3 py-2 font-semibold text-indigo-900 border-b border-indigo-100"
            >
              Planning Time: {plan["Planning Time"].toFixed(3)} ms
            </td>
          </tr>
          <tr className="bg-indigo-50">
            <td
              colSpan={6}
              className="px-3 py-2 font-semibold text-indigo-900"
            >
              Execution Time: {plan["Execution Time"].toFixed(3)} ms
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ExecutionPlanTable({
  explainOutput,
  instances,
}: {
  explainOutput: string;
  instances?: InstancePlan[];
}) {
  const options = buildOptions(explainOutput, instances);
  const [selected, setSelected] = useState(options[0]?.key ?? "");

  const active = options.find((o) => o.key === selected) ?? options[0];
  if (!active?.plan) {
    return (
      <div className="bg-white rounded-xl shadow p-5">
        <h4 className="font-semibold text-gray-900 text-sm mb-4">
          Execution Plan
        </h4>
        <pre className="font-mono text-xs whitespace-pre-wrap text-gray-700 bg-gray-50 rounded-lg p-4 overflow-x-auto">
          {explainOutput}
        </pre>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900 text-sm">
          Execution Plan
        </h4>
        {options.length > 1 && (
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {options.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <PlanTableBody plan={active.plan} />
    </div>
  );
}

interface PlanOption {
  key: string;
  label: string;
  plan: PlanJson | null;
}

function buildOptions(
  explainOutput: string,
  instances?: InstancePlan[],
): PlanOption[] {
  if (!instances || instances.length === 0) {
    const plan = parsePlan(explainOutput);
    return plan ? [{ key: "default", label: "Default", plan: plan[0] }] : [];
  }

  return instances
    .filter((inst) => inst.explain_output)
    .map((inst) => {
      const plan = parsePlan(inst.explain_output!);
      return {
        key: inst.config,
        label: inst.label,
        plan: plan ? plan[0] : null,
      };
    });
}

function PlanRow({ row }: { row: FlatRow }) {
  const indent = "\u2003".repeat(Math.max(0, row.depth - 1));
  const arrow = row.depth > 0 ? "\u2192 " : "";

  return (
    <>
      <tr className="hover:bg-indigo-50">
        <td className="px-3 py-1.5 text-gray-900 whitespace-pre">
          {indent}
          {arrow && (
            <span className="text-gray-400">{arrow}</span>
          )}
          <span className="font-semibold">{row.label}</span>
          {row.relation && (
            <span className="text-gray-500 font-normal">
              {" "}
              {row.relation}
            </span>
          )}
        </td>
        <td className="px-3 py-1.5 text-gray-900 whitespace-nowrap">
          {row.cost}
        </td>
        <td className="px-3 py-1.5 text-gray-900 font-medium whitespace-nowrap">
          {row.time}
        </td>
        <td className="px-3 py-1.5 whitespace-nowrap">
          <span className="text-gray-900 font-medium">
            {row.rowsActual.toLocaleString()}
          </span>
          {row.rowsActual !== row.rowsPlanned && (
            <span className="text-gray-400 text-[11px] ml-1">
              (est. {row.rowsPlanned.toLocaleString()})
            </span>
          )}
        </td>
        <td className="px-3 py-1.5 text-gray-900 whitespace-nowrap">
          {row.loops}
        </td>
        <td className="px-3 py-1.5 text-gray-900 whitespace-nowrap">
          {row.buffers}
        </td>
      </tr>
      {row.extra.map((line, j) => (
        <tr key={`extra-${j}`}>
          <td
            colSpan={6}
            className="px-3 pb-1.5 text-gray-500 text-[11px] italic"
            style={{ paddingLeft: `${12 + row.depth * 16}px` }}
          >
            {line}
          </td>
        </tr>
      ))}
    </>
  );
}

export default ExecutionPlanTable;
