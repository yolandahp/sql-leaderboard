import type { PlanNode, MatchPair } from "./types";
import PlanTreeNode from "./PlanTreeNode";

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
  return (
    <div className="bg-white rounded-xl shadow p-5 min-w-0 overflow-hidden">
      <div className="mb-4">
        <h5 className="text-sm font-semibold text-gray-900">{title}</h5>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <div
        className="space-y-3 min-w-0"
        data-testid={`${title.toLowerCase().replace(" ", "-")}-tree`}
      >
        <PlanTreeNode
          node={root}
          depth={0}
          selectedPair={selectedPair}
          matchByNodeId={matchByNodeId}
          onSelectPair={onSelectPair}
        />
      </div>
    </div>
  );
}

export default PlanTreeCard;
