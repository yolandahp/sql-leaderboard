import type { PlanNode } from "./types";

export function formatMs(value: number | null) {
  return value == null ? "n/a" : `${value.toFixed(2)} ms`;
}

export function formatNumber(value: number | null) {
  if (value == null) return "n/a";
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
}

export function formatInt(value: number | null) {
  return value == null ? "n/a" : Math.round(value).toLocaleString();
}

export function flattenTree(root?: PlanNode): Map<string, PlanNode> {
  const nodes = new Map<string, PlanNode>();
  if (!root) return nodes;

  const visit = (node: PlanNode) => {
    nodes.set(node.id, node);
    for (const child of node.children) visit(child);
  };

  visit(root);
  return nodes;
}
