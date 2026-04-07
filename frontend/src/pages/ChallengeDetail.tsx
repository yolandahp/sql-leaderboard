import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import IndexAdvisorTab from "../components/index-advisor/IndexAdvisorTab";
import type { IndexAdviceResult } from "../components/index-advisor/types";
import PlanDiffTab from "../components/plan-diff/PlanDiffTab";
import ExecutionPlanTable from "../components/ExecutionPlanTable";

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
  total_time_ms: number | null;
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
  explain_output: string | null;
}

interface LeaderboardRow {
  rank: number;
  username: string;
  best_total_time_ms: number;
  best_execution_time_ms: number;
  best_planning_time_ms: number;
  submission_count: number;
  last_submitted: string;
}

interface MySubmission {
  id: number;
  challenge_id: number;
  is_correct: boolean;
  execution_time_ms: number | null;
  planning_time_ms: number | null;
  error_message: string | null;
  submitted_at: string;
}

type TabId = "execution" | "plan-diff" | "index-advisor" | "leaderboard";

function ChallengeDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("leaderboard");
  const [expectedTable, setExpectedTable] = useState<ResultTable | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mySubmissions, setMySubmissions] = useState<MySubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
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

    if (user) {
      apiFetch<MySubmission[]>("/api/auth/me/submissions")
        .then((all) => setMySubmissions(all.filter((s) => s.challenge_id === Number(id))))
        .catch(() => {});
    }
  }, [id, user]);

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
      setSelectedSubmissionId(res.id);
      apiFetch<MySubmission[]>("/api/auth/me/submissions")
        .then((all) => setMySubmissions(all.filter((s) => s.challenge_id === Number(id))))
        .catch(() => {});
      apiFetch<LeaderboardRow[]>(`/api/leaderboard/challenge/${id}`)
        .then(setLeaderboard)
        .catch(() => {});
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

  const handleSelectSubmission = async (submissionId: number) => {
    setSelectedSubmissionId(submissionId);
    setIndexAdvice(null);
    setIndexError("");
    try {
      const res = await apiFetch<SubmissionResult & { query: string }>(
        `/api/submissions/${submissionId}`,
      );
      setResult(res);
      if (res.query) setQuery(res.query);
      setActiveTab("execution");
    } catch {
      setError("Failed to load submission details.");
    }
  };

  // Auto-load submission from URL query param
  useEffect(() => {
    const submissionId = searchParams.get("submission");
    if (submissionId) {
      handleSelectSubmission(Number(submissionId));
    }
  }, []);

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
    { id: "leaderboard", label: "Standings" },
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

      {/* Tabs */}
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

        {activeTab === "leaderboard" && (
          <LeaderboardPanel
            leaderboard={leaderboard}
            mySubmissions={mySubmissions}
            isLoggedIn={!!user}
            selectedSubmissionId={selectedSubmissionId}
            onSelectSubmission={handleSelectSubmission}
          />
        )}
        {activeTab === "execution" && (
          result && !result.error_message ? (
            <ExecutionTab result={result} cacheRatio={cacheRatio} />
          ) : (
            <p className="text-gray-500 text-sm">Submit a query to see execution details.</p>
          )
        )}
        {activeTab === "plan-diff" && (
          result && !result.error_message ? (
            <PlanDiffTab challengeId={challenge.id} result={result} />
          ) : (
            <p className="text-gray-500 text-sm">Submit a query to see plan diff.</p>
          )
        )}
        {activeTab === "index-advisor" && (
          result && !result.error_message ? (
            <IndexAdvisorTab
              advice={indexAdvice}
              loading={analyzingIndexes}
              error={indexError}
              onAnalyze={handleAnalyzeIndexes}
            />
          ) : (
            <p className="text-gray-500 text-sm">Submit a query to see index advice.</p>
          )
        )}
      </div>
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

function ElapsedTimer({ running }: { running: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    startRef.current = Date.now();
    const interval = setInterval(() => {
      setElapsed(((Date.now() - startRef.current) / 1000));
    }, 100);
    return () => clearInterval(interval);
  }, [running]);

  if (!running) return null;
  return <span className="ml-2 text-sm text-gray-300">{elapsed.toFixed(1)}s</span>;
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
      <div className="flex gap-3 mt-3 items-center">
        <button
          onClick={onSubmit}
          disabled={submitting || !isLoggedIn}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
        >
          {submitting && (
            <svg
              className="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {submitting ? "Running..." : "Submit Query"}
        </button>
        <ElapsedTimer running={submitting} />
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
          <thead className="bg-indigo-50 sticky top-0 border-b border-indigo-200">
            <tr>
              {table.columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-medium text-indigo-900 uppercase tracking-wider"
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
        {result.total_time_ms != null && (
          <span className="text-sm text-gray-600">
            Total: {result.total_time_ms.toFixed(2)} ms
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

function AverageTotalTime({ instances }: { instances: InstanceResult[] }) {
  const n = instances.length;
  const totalTimes = instances.map((i) => i.execution_time_ms + i.planning_time_ms);
  const avgTotal = totalTimes.reduce((a, b) => a + b, 0) / n;
  const formula = totalTimes.map((v) => v.toFixed(2)).join(" + ");

  return (
    <div className="text-sm font-mono text-gray-600 mb-6">
      <span className="text-gray-500">Average Total Time</span>{" "}
      = ({formula}) / {n} ={" "}
      <span className="font-semibold text-gray-900">{avgTotal.toFixed(2)} ms</span>
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
        <>
          <InstanceGrid instances={result.instances} cacheRatio={cacheRatio} />
          <AverageTotalTime instances={result.instances} />
        </>
      ) : (
        <p className="text-gray-500 text-sm mb-6">
          Detailed per-instance results will appear here once multi-instance
          testing is configured.
        </p>
      )}
      {result.explain_output && (
        <ExecutionPlanTable
          explainOutput={result.explain_output}
          instances={result.instances}
        />
      )}
    </div>
  );
}

const ALL_INSTANCE_SLOTS = [
  { id: "default", label: "Default (Small Data)" },
  { id: "large", label: "Large Dataset" },
  { id: "large-indexed", label: "Large Dataset with Index" },
];

function InstanceGrid({
  instances,
  cacheRatio,
}: {
  instances: InstanceResult[];
  cacheRatio: (hits: number, reads: number) => number;
}) {
  const instanceMap = new Map(instances.map((i) => [i.config, i]));

  return (
    <div className="grid grid-cols-3 gap-6 mb-4">
      {ALL_INSTANCE_SLOTS.map((slot) => {
        const inst = instanceMap.get(slot.id);
        return inst ? (
          <InstanceCard key={slot.id} instance={inst} cacheRatio={cacheRatio} />
        ) : (
          <div key={slot.id} className="bg-white rounded-xl shadow p-5 flex flex-col items-center justify-center text-center">
            <h4 className="font-semibold text-gray-400 text-sm mb-3">{slot.label}</h4>
            <p className="text-gray-400 text-sm">
              Not available for this challenge.
            </p>
          </div>
        );
      })}
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
  const instanceTotalTime = instance.execution_time_ms + instance.planning_time_ms;
  const totalTimeColor =
    instanceTotalTime < 5
      ? "text-green-600"
      : instanceTotalTime < 50
        ? "text-yellow-600"
        : "text-red-600";

  const metrics = [
    { label: "Total Time", value: `${instanceTotalTime.toFixed(2)} ms`, color: totalTimeColor },
    { label: "Execution Time", value: `${instance.execution_time_ms.toFixed(2)} ms` },
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

function LeaderboardPanel({
  leaderboard,
  mySubmissions,
  isLoggedIn,
  selectedSubmissionId,
  onSelectSubmission,
}: {
  leaderboard: LeaderboardRow[];
  mySubmissions: MySubmission[];
  isLoggedIn: boolean;
  selectedSubmissionId: number | null;
  onSelectSubmission: (id: number) => void;
}) {
  const [subTab, setSubTab] = useState<"my-submissions" | "ranking">(
    isLoggedIn ? "my-submissions" : "ranking"
  );

  const subTabs = [
    ...(isLoggedIn ? [{ id: "my-submissions" as const, label: "My Submissions" }] : []),
    { id: "ranking" as const, label: "Ranking" },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${
              subTab === tab.id
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {subTab === "ranking" && <ChallengeLeaderboard entries={leaderboard} />}
      {subTab === "my-submissions" && (
        <MySubmissions
          entries={mySubmissions}
          selectedId={selectedSubmissionId}
          onSelect={onSelectSubmission}
        />
      )}
    </div>
  );
}

function ChallengeLeaderboard({ entries }: { entries: LeaderboardRow[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No correct submissions yet. Be the first to solve this challenge!
      </p>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Best Total Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exec Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planning Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted On</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {entries.map((row) => (
              <tr key={row.rank} className={row.rank === 1 ? "bg-yellow-50" : ""}>
                <td className="px-6 py-3 font-semibold text-indigo-600">#{row.rank}</td>
                <td className="px-6 py-3">{row.username}</td>
                <td className="px-6 py-3 font-medium text-green-600">
                  {row.best_total_time_ms.toFixed(2)} ms
                </td>
                <td className="px-6 py-3 text-gray-500">{row.best_execution_time_ms.toFixed(2)} ms</td>
                <td className="px-6 py-3 text-gray-500">{row.best_planning_time_ms.toFixed(2)} ms</td>
                <td className="px-6 py-3 text-gray-500">{row.last_submitted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MySubmissions({
  entries,
  selectedId,
  onSelect,
}: {
  entries: MySubmission[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">My Attempts</h3>
        <p className="text-gray-500 text-sm">No submissions yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">My Attempts</h3>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exec Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planning Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {entries.map((s) => {
              const totalTime =
                s.execution_time_ms != null && s.planning_time_ms != null
                  ? s.execution_time_ms + s.planning_time_ms
                  : null;
              return (
                <tr
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={`cursor-pointer ${
                    selectedId === s.id
                      ? "bg-indigo-50 border-l-4 border-indigo-600"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-6 py-3 text-gray-900">{s.id}</td>
                  <td className="px-6 py-3">
                    {s.error_message ? (
                      <span className="text-red-600">Error</span>
                    ) : s.is_correct ? (
                      <span className="text-green-600 font-medium">Correct</span>
                    ) : (
                      <span className="text-yellow-600">Incorrect</span>
                    )}
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {totalTime != null ? `${totalTime.toFixed(2)} ms` : "--"}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {s.execution_time_ms != null ? `${s.execution_time_ms.toFixed(2)} ms` : "--"}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {s.planning_time_ms != null ? `${s.planning_time_ms.toFixed(2)} ms` : "--"}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {new Date(s.submitted_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-6 py-3 text-indigo-600 text-sm font-medium">
                    {selectedId === s.id ? "Viewing" : "View →"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ChallengeDetail;
