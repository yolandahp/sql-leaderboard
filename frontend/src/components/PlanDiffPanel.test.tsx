import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import PlanDiffPanel from "./PlanDiffPanel";
import { apiFetch } from "../api/client";

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

const baseResult = {
  id: 101,
  is_correct: true,
  execution_time_ms: 42.5,
};

const optionsResponse = {
  current_submission: {
    id: 101,
    submitted_at: "2026-04-04T12:00:00Z",
    label: "Submission #101",
    is_correct: true,
    execution_time_ms: 42.5,
    planning_time_ms: 2.1,
    has_plan: true,
    instance_ids: ["default"],
    instance_count: 1,
  },
  targets: [
    {
      id: 88,
      submitted_at: "2026-04-04T11:00:00Z",
      label: "Submission #88",
      is_correct: true,
      execution_time_ms: 18.2,
      planning_time_ms: 1.3,
      has_plan: true,
      instance_ids: ["default"],
      instance_count: 1,
      kind: "fastest_correct" as const,
    },
    {
      id: 95,
      submitted_at: "2026-04-04T11:30:00Z",
      label: "Submission #95",
      is_correct: false,
      execution_time_ms: 50.2,
      planning_time_ms: 2.9,
      has_plan: false,
      instance_ids: [],
      instance_count: 0,
      kind: "previous" as const,
    },
  ],
  default_target_id: 88,
  instance_options: [{ id: "default", label: "Default", has_plan: true }],
  default_instance_id: "default",
};

const readyDiff = {
  status: "ready" as const,
  current_submission: optionsResponse.current_submission,
  target_submission: optionsResponse.targets[0],
  instance: { id: "default", label: "Default", has_plan: true },
  current_submission_incorrect: false,
  summary: {
    submission_a: optionsResponse.current_submission,
    submission_b: optionsResponse.targets[0],
    verdict: "Submission B is 2.34x faster than your current query.",
    main_difference: "Seq Scan was replaced by Index Scan.",
  },
  insights: {
    top_insights: [
      "Largest timing change: Seq Scan was replaced by Index Scan.",
      "Biggest buffer shift: 10 fewer shared reads.",
      "Most visible row-volume change: rows changed from 100 to 10.",
    ],
    structural_changes: ["Seq Scan was replaced by Index Scan"],
    biggest_time_saving_node: "a-root.0",
    biggest_buffer_improvement_node: "a-root.0",
    row_reduction_summary: "rows changed from 100 to 10",
  },
  tree_a: {
    id: "a-root",
    side: "a" as const,
    node_type: "Aggregate",
    relation_name: null,
    index_name: null,
    join_type: null,
    strategy: null,
    actual_total_time: 42.5,
    actual_rows: 5,
    plan_rows: 5,
    loops: 1,
    shared_hit_blocks: 120,
    shared_read_blocks: 45,
    hit_ratio: 72.7,
    children: [
      {
        id: "a-root.0",
        side: "a" as const,
        node_type: "Seq Scan",
        relation_name: "orders",
        index_name: null,
        join_type: null,
        strategy: null,
        actual_total_time: 35,
        actual_rows: 100,
        plan_rows: 120,
        loops: 1,
        shared_hit_blocks: 80,
        shared_read_blocks: 30,
        hit_ratio: 72.7,
        children: [],
      },
    ],
  },
  tree_b: {
    id: "b-root",
    side: "b" as const,
    node_type: "Aggregate",
    relation_name: null,
    index_name: null,
    join_type: null,
    strategy: null,
    actual_total_time: 18.2,
    actual_rows: 5,
    plan_rows: 5,
    loops: 1,
    shared_hit_blocks: 130,
    shared_read_blocks: 12,
    hit_ratio: 91.5,
    children: [
      {
        id: "b-root.0",
        side: "b" as const,
        node_type: "Index Scan",
        relation_name: "orders",
        index_name: "idx_orders_customer",
        join_type: null,
        strategy: null,
        actual_total_time: 12,
        actual_rows: 10,
        plan_rows: 12,
        loops: 1,
        shared_hit_blocks: 90,
        shared_read_blocks: 5,
        hit_ratio: 94.7,
        children: [],
      },
    ],
  },
  matches: [
    {
      a_node_id: "a-root",
      b_node_id: "b-root",
      delta: {
        time_ms: -24.3,
        rows: 0,
        loops: 0,
        shared_hits: 10,
        shared_reads: -33,
        hit_ratio: 18.8,
      },
      explanation: "Aggregate became cheaper overall",
    },
    {
      a_node_id: "a-root.0",
      b_node_id: "b-root.0",
      delta: {
        time_ms: -23,
        rows: -90,
        loops: 0,
        shared_hits: 10,
        shared_reads: -25,
        hit_ratio: 22,
      },
      explanation: "Seq Scan was replaced by Index Scan, 25 fewer shared reads, 23.00 ms faster",
    },
  ],
  default_selected: {
    a_node_id: "a-root",
    b_node_id: "b-root",
    delta: {
      time_ms: -24.3,
      rows: 0,
      loops: 0,
      shared_hits: 10,
      shared_reads: -33,
      hit_ratio: 18.8,
    },
    explanation: "Aggregate became cheaper overall",
  },
};

function renderPanel(resultOverrides?: Partial<typeof baseResult>) {
  return render(
    <PlanDiffPanel
      challengeId={1}
      result={{ ...baseResult, ...resultOverrides }}
    />
  );
}

describe("PlanDiffPanel", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("renders the empty state when no comparison targets exist", async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ...optionsResponse,
      targets: [],
      default_target_id: null,
    });

    renderPanel();

    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText(/Submit another query attempt/i)).toBeInTheDocument();
  });

  it("renders the comparison-ready control bar with default target", async () => {
    mockedApiFetch.mockResolvedValueOnce(optionsResponse);

    renderPanel();

    expect(await screen.findByTestId("target-selector")).toHaveValue("88");
    expect(screen.getByText(/^Current Submission$/i)).toBeInTheDocument();
    expect(screen.getByTestId("run-diff-button")).toBeEnabled();
  });

  it("shows the incorrect current submission note", async () => {
    mockedApiFetch.mockResolvedValueOnce(optionsResponse);

    renderPanel({ is_correct: false });

    expect(await screen.findByTestId("incorrect-submission-note")).toBeInTheDocument();
  });

  it("shows the loading state while diff analysis is running", async () => {
    let resolveDiff: (value: typeof readyDiff) => void = () => undefined;
    const diffPromise = new Promise<typeof readyDiff>((resolve) => {
      resolveDiff = resolve;
    });
    mockedApiFetch.mockResolvedValueOnce(optionsResponse).mockReturnValueOnce(diffPromise);

    renderPanel();
    await screen.findByTestId("target-selector");
    await userEvent.click(screen.getByTestId("run-diff-button"));

    expect(screen.getByTestId("loading-state")).toBeInTheDocument();

    resolveDiff(readyDiff);
    await screen.findByTestId("verdict-strip");
  });

  it("shows missing-plan fallback when the selected target has no usable plan", async () => {
    mockedApiFetch
      .mockResolvedValueOnce(optionsResponse)
      .mockResolvedValueOnce({
        status: "missing_plan",
        current_submission: optionsResponse.current_submission,
        target_submission: optionsResponse.targets[1],
        instance: { id: "default", label: "Default", has_plan: true },
        current_submission_incorrect: false,
        message: "Analysis is unavailable for this comparison target because one submission is missing a usable execution plan for the selected instance.",
      });

    renderPanel();
    await screen.findByTestId("target-selector");
    await userEvent.selectOptions(screen.getByTestId("target-selector"), "95");
    await userEvent.click(screen.getByTestId("run-diff-button"));

    expect(await screen.findByTestId("missing-plan-state")).toBeInTheDocument();
  });

  it("uses the selected target when running the diff", async () => {
    mockedApiFetch
      .mockResolvedValueOnce(optionsResponse)
      .mockResolvedValueOnce(readyDiff);

    renderPanel();
    await screen.findByTestId("target-selector");
    await userEvent.selectOptions(screen.getByTestId("target-selector"), "95");
    await userEvent.click(screen.getByTestId("run-diff-button"));

    await waitFor(() =>
      expect(mockedApiFetch).toHaveBeenLastCalledWith(
        "/api/submissions/101/plan-diff",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            target_submission_id: 95,
            instance_id: "default",
          }),
        })
      )
    );
  });

  it("renders the diff result summary and insights", async () => {
    mockedApiFetch
      .mockResolvedValueOnce(optionsResponse)
      .mockResolvedValueOnce(readyDiff);

    renderPanel();
    await screen.findByTestId("target-selector");
    await userEvent.click(screen.getByTestId("run-diff-button"));

    expect(await screen.findByTestId("verdict-strip")).toBeInTheDocument();
    expect(screen.getByText(/Submission B is 2.34x faster/i)).toBeInTheDocument();
    expect(screen.getByText(/Biggest buffer improvement/i)).toBeInTheDocument();
  });

  it("updates the node inspector when a matched node is clicked", async () => {
    mockedApiFetch
      .mockResolvedValueOnce(optionsResponse)
      .mockResolvedValueOnce(readyDiff);

    renderPanel();
    await screen.findByTestId("target-selector");
    await userEvent.click(screen.getByTestId("run-diff-button"));
    await screen.findByTestId("node-inspector");

    expect(screen.getByText(/Aggregate became cheaper overall/i)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("plan-node-a-root.0"));

    expect(screen.getByTestId("node-inspector")).toHaveTextContent(
      /Seq Scan was replaced by Index Scan/i
    );
  });
});
