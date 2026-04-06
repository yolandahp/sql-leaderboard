import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import IndexAdvisorTab from "../components/index-advisor/IndexAdvisorTab";
import type { IndexAdviceResult } from "../components/index-advisor/types";
import PlanDiffTab from "../components/plan-diff/PlanDiffTab";

interface ChallengeInfo {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  schema_sql: string;
  seed_sql: string;
  time_limit_ms: number;
  schema_tables: string[];
}

interface ResultTable {
  columns: string[];
  rows: (string | number | null)[][];
  total_count: number;
}

interface SubmissionResult {
  id: number;
  is_correct: boolean;
  execution_time_ms: number | null;
  planning_time_ms: number | null;
  total_cost: number | null;
  explain_output: string | null;
  error_message: string | null;
  result_table: ResultTable | null;
  expected_table: ResultTable | null;
  instances: InstanceResult[];
}

interface InstanceResult {
  label: string;
  config: string;
  execution_time_ms: number;
  planning_time_ms: number;
  total_cost: number;
  rows_returned: number;
  buffer_hits: number;
  buffer_reads: number;
}

interface LeaderboardRow {
  rank: number;
  username: string;
  avg_execution_time_ms: number;
  planning_time_ms: number;
  submission_count: number;
  last_submitted: string;
}

type TabId = "execution" | "plan-diff" | "index-advisor" | "cost-explorer";

function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("execution");
  const [expectedTable, setExpectedTable] = useState<ResultTable | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexAdvice, setIndexAdvice] = useState<IndexAdviceResult | null>(null);
  const [analyzingIndexes, setAnalyzingIndexes] = useState(false);
  const [indexError, setIndexError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch<ChallengeInfo>(`/api/challenges/${id}`)
      .then(setChallenge)
      .catch(() => {})
      .finally(() => setLoading(false));

    apiFetch<ResultTable>(`/api/challenges/${id}/expected-output`)
      .then(setExpectedTable)
      .catch(() => {});

    apiFetch<LeaderboardRow[]>(`/api/leaderboard/challenge/${id}`)
      .then(setLeaderboard)
      .catch(() => {});
  }, [id]);

  const handleSubmit = async () => {
    if (!query.trim() || !id) return;
    setSubmitting(true);
    setError("");
    setResult(null);
    setIndexAdvice(null);
    setIndexError("");
    try {
      const res = await apiFetch<SubmissionResult>("/api/submissions", {
        method: "POST",
        body: JSON.stringify({ challenge_id: Number(id), query }),
      });
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnalyzeIndexes = async () => {
    if (!result) return;
    setAnalyzingIndexes(true);
    setIndexError("");
    setIndexAdvice(null);
    try {
      const res = await apiFetch<IndexAdviceResult>(
        `/api/submissions/${result.id}/index-advice`,
        { method: "POST" },
      );
      setIndexAdvice(res);
    } catch (err: unknown) {
      setIndexError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzingIndexes(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!challenge) return <p className="text-gray-500">Challenge not found.</p>;

  const cacheRatio = (hits: number, reads: number) => {
    const total = hits + reads;
    return total === 0 ? 0 : Math.round((hits / total) * 100);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "execution", label: "Execution Details" },
    { id: "plan-diff", label: "Plan Diff" },
    { id: "index-advisor", label: "Index Advisor" },
    { id: "cost-explorer", label: "Cost Explorer" },
  ];

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/challenges"
          className="text-sm text-indigo-600 hover:underline"
        >
          &larr; Back to Challenges
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-2xl font-bold text-gray-900">{challenge.title}</h2>
        {challenge.difficulty && (
          <DifficultyBadge difficulty={challenge.difficulty} />
        )}
      </div>
      <p className="text-gray-600 mb-6">{challenge.description}</p>

      {/* Schema info + Expected Output */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {challenge.schema_sql && (
          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Schema</h3>
            {challenge.schema_tables.length > 0 && (
              <p className="text-xs text-gray-500 mb-2">
                Tables: {challenge.schema_tables.join(", ")}
              </p>
            )}
            <pre className="bg-gray-50 rounded p-3 font-mono text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
              {challenge.schema_sql}
            </pre>
          </div>
        )}
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Expected Output</h3>
          {expectedTable ? (
            <QueryResultTable table={expectedTable} />
          ) : (
            <p className="text-sm text-gray-400">
              Loading expected output...
            </p>
          )}
        </div>
      </div>

      {/* SQL Editor + Results */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <SqlEditor
          query={query}
          onQueryChange={setQuery}
          onSubmit={handleSubmit}
          submitting={submitting}
          isLoggedIn={!!user}
          timeLimitMs={challenge.time_limit_ms}
        />
        <ResultsPanel result={result} error={error} />
      </div>

      {/* Tabs for advanced features */}
      {result && !result.error_message && (
        <div>
          <div className="border-b border-gray-200 mb-6">
            <div className="flex gap-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 text-sm ${
                    activeTab === tab.id
                      ? "border-b-2 border-indigo-600 text-indigo-600 font-semibold"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "execution" && (
            <ExecutionTab result={result} cacheRatio={cacheRatio} />
          )}
          {activeTab === "plan-diff" && (
            <PlanDiffTab challengeId={challenge.id} result={result} />
          )}
          {activeTab === "index-advisor" && (
            <IndexAdvisorTab
              advice={indexAdvice}
              loading={analyzingIndexes}
              error={indexError}
              onAnalyze={handleAnalyzeIndexes}
            />
          )}
          {activeTab === "cost-explorer" && (
            <CostExplorerTab explainOutput={result.explain_output} />
          )}
        </div>
      )}

      {/* Challenge Leaderboard */}
      {leaderboard.length > 0 && (
        <ChallengeLeaderboard entries={leaderboard} />
      )}
    </div>
  );
}

// ---- Sub-components ----

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    easy: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    hard: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[difficulty] ?? "bg-gray-100 text-gray-800"}`}
    >
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </span>
  );
}

function SqlEditor({
  query,
  onQueryChange,
  onSubmit,
  submitting,
  isLoggedIn,
  timeLimitMs,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  isLoggedIn: boolean;
  timeLimitMs: number;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">SQL Query</h3>
      <textarea
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="w-full h-40 bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
        spellCheck={false}
        placeholder="SELECT ..."
      />
      <div className="flex gap-3 mt-3">
        <button
          onClick={onSubmit}
          disabled={submitting || !isLoggedIn}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {submitting ? "Running..." : "Submit Query"}
        </button>
      </div>
      {!isLoggedIn && (
        <p className="text-xs text-gray-400 mt-2">
          <Link to="/login" className="text-indigo-600 hover:underline">
            Login
          </Link>{" "}
          to submit queries.
        </p>
      )}
      <p className="text-xs text-gray-400 mt-2">
        Timeout: {timeLimitMs / 1000}s | Read-only
      </p>
    </div>
  );
}

function ResultsPanel({
  result,
  error,
}: {
  result: SubmissionResult | null;
  error: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Results</h3>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}
      {!result && !error && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400 h-40 flex items-center justify-center">
          Submit a query to see results
        </div>
      )}
      {result && <ResultBadge result={result} />}
      {result && result.result_table && (
        <div className="mt-3">
          <QueryResultTable title="Your Output" table={result.result_table} />
        </div>
      )}
    </div>
  );
}

function QueryResultTable({ title, table }: { title?: string; table: ResultTable }) {
  const truncated = table.total_count > table.rows.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        {title && (
          <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          {truncated
            ? `Showing ${table.rows.length} of ${table.total_count} rows`
            : `${table.total_count} row${table.total_count !== 1 ? "s" : ""}`}
        </span>
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto max-h-64 overflow-y-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {table.columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {table.rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {row.map((val, j) => (
                  <td key={j} className="px-3 py-1.5 text-gray-700 font-mono whitespace-nowrap">
                    {val === null ? (
                      <span className="text-gray-300 italic">NULL</span>
                    ) : (
                      String(val)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultBadge({ result }: { result: SubmissionResult }) {
  const isError = !!result.error_message;
  const variant = isError ? "red" : result.is_correct ? "green" : "yellow";
  const label = isError ? "Error" : result.is_correct ? "Correct" : "Incorrect";

  const colors = {
    red: { bg: "bg-red-50 border-red-200", dot: "bg-red-500", text: "text-red-800" },
    green: { bg: "bg-green-50 border-green-200", dot: "bg-green-500", text: "text-green-800" },
    yellow: { bg: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-500", text: "text-yellow-800" },
  }[variant];

  return (
    <div>
      <div className={`${colors.bg} border rounded-lg p-3 mb-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
          <span className={`font-semibold text-sm ${colors.text}`}>{label}</span>
        </div>
        {result.execution_time_ms != null && (
          <span className="text-sm text-gray-600">
            {result.execution_time_ms.toFixed(2)} ms
          </span>
        )}
      </div>
      {result.error_message && (
        <div className="bg-white rounded-lg shadow p-4 text-sm text-red-600 font-mono whitespace-pre-wrap">
          {result.error_message}
        </div>
      )}
    </div>
  );
}

function ExecutionTab({
  result,
  cacheRatio,
}: {
  result: SubmissionResult;
  cacheRatio: (hits: number, reads: number) => number;
}) {
  return (
    <div>
      {result.instances && result.instances.length > 0 ? (
        <div className="grid grid-cols-3 gap-6 mb-6">
          {result.instances.map((inst, i) => (
            <InstanceCard key={i} instance={inst} cacheRatio={cacheRatio} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm mb-6">
          Detailed per-instance results will appear here once multi-instance
          testing is configured.
        </p>
      )}
      {result.explain_output && (
        <div className="bg-white rounded-xl shadow p-5">
          <h4 className="font-semibold text-gray-900 text-sm mb-4">
            Execution Plan
          </h4>
          <pre className="font-mono text-xs whitespace-pre-wrap text-gray-700 bg-gray-50 rounded-lg p-4 overflow-x-auto">
            {result.explain_output}
          </pre>
        </div>
      )}
    </div>
  );
}

function InstanceCard({
  instance,
  cacheRatio,
}: {
  instance: InstanceResult;
  cacheRatio: (hits: number, reads: number) => number;
}) {
  const ratio = cacheRatio(instance.buffer_hits, instance.buffer_reads);
  const timeColor =
    instance.execution_time_ms < 5
      ? "text-green-600"
      : instance.execution_time_ms < 50
        ? "text-yellow-600"
        : "text-red-600";

  const metrics = [
    { label: "Execution Time", value: `${instance.execution_time_ms.toFixed(2)} ms`, color: timeColor },
    { label: "Planning Time", value: `${instance.planning_time_ms.toFixed(2)} ms` },
    { label: "Total Cost", value: instance.total_cost.toLocaleString() },
    { label: "Rows Returned", value: instance.rows_returned.toLocaleString() },
    { label: "Buffer Hits", value: instance.buffer_hits.toLocaleString() },
    { label: "Buffer Reads", value: instance.buffer_reads.toLocaleString() },
  ];

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-gray-900 text-sm">{instance.label}</h4>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
          {instance.config}
        </span>
      </div>
      <div className="space-y-2 text-sm">
        {metrics.map((m) => (
          <div key={m.label} className="flex justify-between">
            <span className="text-gray-500">{m.label}</span>
            <span className={`font-medium ${m.color ?? ""}`}>{m.value}</span>
          </div>
        ))}
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Cache Hit Ratio</span>
            <span>{ratio}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${ratio >= 70 ? "bg-green-500" : "bg-yellow-500"}`}
              style={{ width: `${ratio}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CostExplorerTab({ explainOutput }: { explainOutput: string | null }) {
  const sliders = [
    { name: "seq_page_cost", min: 0.1, max: 4.0, step: 0.1, defaultVal: 1.0, desc: "Cost of sequential disk page fetch (default: 1.0)" },
    { name: "random_page_cost", min: 1.0, max: 10.0, step: 0.1, defaultVal: 4.0, desc: "Cost of random disk page fetch (default: 4.0, SSD: ~1.1)" },
    { name: "cpu_tuple_cost", min: 0.001, max: 0.1, step: 0.001, defaultVal: 0.01, desc: "Cost of processing each row (default: 0.01)" },
    { name: "effective_cache_size", min: 0.25, max: 16, step: 0.25, defaultVal: 4, desc: "Planner's assumption of available cache (default: 4 GB)" },
  ];

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h4 className="font-semibold text-gray-900 mb-1">Cost Model Explorer</h4>
      <p className="text-sm text-gray-500 mb-6">
        Adjust PostgreSQL optimizer cost parameters and see how the query plan
        changes.
      </p>
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-5">
          {sliders.map((s) => (
            <CostSlider key={s.name} {...s} />
          ))}
          <button
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition mt-2"
            disabled
          >
            Re-run EXPLAIN
          </button>
        </div>
        <div>
          <h5 className="font-semibold text-gray-700 text-sm mb-3">
            Estimated Plan (with current settings)
          </h5>
          {explainOutput ? (
            <pre className="bg-gray-50 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap text-gray-700 mb-4">
              {explainOutput}
            </pre>
          ) : (
            <p className="text-sm text-gray-400">
              Plan will appear here after re-running EXPLAIN with adjusted
              parameters.
            </p>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <h5 className="font-semibold text-amber-800 text-sm mb-1">
              Try This
            </h5>
            <p className="text-sm text-amber-700">
              Set{" "}
              <code className="bg-amber-100 px-1 rounded">
                random_page_cost = 1.1
              </code>{" "}
              (simulating SSD) -- the planner may switch from Seq Scan to Index
              Scan if a suitable index exists.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CostSlider({
  name,
  min,
  max,
  step,
  defaultVal,
  desc,
}: {
  name: string;
  min: number;
  max: number;
  step: number;
  defaultVal: number;
  desc: string;
}) {
  const [value, setValue] = useState(defaultVal);
  const precision = step < 0.01 ? 3 : step < 1 ? 1 : 0;
  const display =
    name === "effective_cache_size" ? `${value} GB` : value.toFixed(precision);

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700 font-medium" style={{ minWidth: 160 }}>
          {name}
        </span>
        <span className="font-mono text-indigo-600">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(parseFloat(e.target.value))}
        className="w-full accent-indigo-600"
      />
      <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
    </div>
  );
}

function ChallengeLeaderboard({ entries }: { entries: LeaderboardRow[] }) {
  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Challenge Leaderboard
      </h3>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Exec Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submissions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Submit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {entries.map((row) => (
              <tr key={row.rank} className={row.rank === 1 ? "bg-yellow-50" : ""}>
                <td className="px-6 py-3 font-semibold text-indigo-600">#{row.rank}</td>
                <td className="px-6 py-3">{row.username}</td>
                <td className="px-6 py-3 font-medium text-green-600">
                  {row.avg_execution_time_ms.toFixed(2)} ms
                </td>
                <td className="px-6 py-3">{row.submission_count}</td>
                <td className="px-6 py-3 text-gray-500">{row.last_submitted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ChallengeDetail;
