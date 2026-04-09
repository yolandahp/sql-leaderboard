import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Pagination, { paginate, totalPages } from "../components/Pagination";

interface OverallEntry {
  rank: number;
  username: string;
  solved: number;
  total: number;
  avg_execution_time_ms: number;
  submission_count: number;
  joined: string;
}

interface ChallengeEntry {
  rank: number;
  username: string;
  best_total_time_ms: number;
  best_execution_time_ms: number;
  best_planning_time_ms: number;
  submission_count: number;
  last_submitted: string;
}

interface ChallengeOption {
  id: number;
  title: string;
}

function Leaderboard() {
  const { user } = useAuth();
  const [view, setView] = useState<"overall" | "challenge">("overall");
  const [overallEntries, setOverallEntries] = useState<OverallEntry[]>([]);
  const [challengeEntries, setChallengeEntries] = useState<ChallengeEntry[]>([]);
  const [challenges, setChallenges] = useState<ChallengeOption[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<OverallEntry[]>("/api/leaderboard")
      .then(setOverallEntries)
      .catch(() => {})
      .finally(() => setLoading(false));

    apiFetch<ChallengeOption[]>("/api/challenges")
      .then(setChallenges)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedChallenge) {
      setChallengeEntries([]);
      return;
    }
    apiFetch<ChallengeEntry[]>(`/api/leaderboard/challenge/${selectedChallenge}`)
      .then(setChallengeEntries)
      .catch(() => {});
  }, [selectedChallenge]);

  const filteredChallenges = challenges.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  // Auto-select when search narrows to exactly one match
  useEffect(() => {
    if (view !== "challenge") return;
    if (filteredChallenges.length === 1) {
      setSelectedChallenge(filteredChallenges[0].id);
    } else if (search && !filteredChallenges.some((c) => c.id === selectedChallenge)) {
      setSelectedChallenge(null);
    }
  }, [search, filteredChallenges.length]);

  const rankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-600";
    if (rank === 2) return "text-gray-400";
    if (rank === 3) return "text-amber-700";
    return "text-gray-400";
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Leaderboard</h2>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-2">
          {(["overall", "challenge"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                view === v
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {v === "overall" ? "Overall" : "By Challenge"}
            </button>
          ))}
        </div>

        {view === "challenge" && (
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search challenge..."
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading leaderboard...</p>
      ) : view === "overall" ? (
        <OverallTable entries={overallEntries} rankColor={rankColor} currentUsername={user?.username} />
      ) : (
        <div>
          <div className="flex flex-wrap gap-2 mb-6">
            {filteredChallenges.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedChallenge(c.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  selectedChallenge === c.id
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {c.title}
              </button>
            ))}
            {filteredChallenges.length === 0 && (
              <p className="text-gray-500 text-sm">No challenges match your search.</p>
            )}
          </div>
          {selectedChallenge && (
            <ChallengeTable entries={challengeEntries} rankColor={rankColor} currentUsername={user?.username} />
          )}
        </div>
      )}
    </div>
  );
}

function OverallTable({
  entries,
  rankColor,
  currentUsername,
}: {
  entries: OverallEntry[];
  rankColor: (r: number) => string;
  currentUsername?: string;
}) {
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const pages = totalPages(entries.length, PAGE_SIZE);
  const paged = paginate(entries, page, PAGE_SIZE);

  if (entries.length === 0)
    return <p className="text-gray-500">No submissions yet. Be the first!</p>;

  return (
    <>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Challenges Solved</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Exec Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Submissions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paged.map((e) => {
              const isMe = currentUsername === e.username;
              return (
                <tr
                  key={e.rank}
                  className={
                    isMe
                      ? "bg-indigo-50 hover:bg-indigo-100"
                      : e.rank === 1
                        ? "bg-yellow-50 hover:bg-yellow-100"
                        : "hover:bg-gray-50"
                  }
                >
                  <td className={`px-6 py-4 font-bold text-lg ${rankColor(e.rank)}`}>#{e.rank}</td>
                  <td className="px-6 py-4 font-semibold">
                    {e.username}
                    {isMe && <span className="ml-2 text-xs text-indigo-600 font-medium">(you)</span>}
                  </td>
                  <td className="px-6 py-4">{e.solved} / {e.total}</td>
                  <td className="px-6 py-4 font-medium text-green-600">{e.avg_execution_time_ms.toFixed(2)} ms</td>
                  <td className="px-6 py-4">{e.submission_count}</td>
                  <td className="px-6 py-4 text-gray-500">{e.joined}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />
    </>
  );
}

function ChallengeTable({
  entries,
  rankColor,
  currentUsername,
}: {
  entries: ChallengeEntry[];
  rankColor: (r: number) => string;
  currentUsername?: string;
}) {
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const pages = totalPages(entries.length, PAGE_SIZE);
  const paged = paginate(entries, page, PAGE_SIZE);

  useEffect(() => setPage(1), [entries]);

  if (entries.length === 0)
    return <p className="text-gray-500 text-sm">No correct submissions for this challenge yet.</p>;

  return (
    <>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Best Total Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exec Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planning Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submissions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paged.map((e) => {
              const isMe = currentUsername === e.username;
              return (
                <tr
                  key={e.rank}
                  className={
                    isMe
                      ? "bg-indigo-50 hover:bg-indigo-100"
                      : e.rank === 1
                        ? "bg-yellow-50 hover:bg-yellow-100"
                        : "hover:bg-gray-50"
                  }
                >
                  <td className={`px-6 py-4 font-bold text-lg ${rankColor(e.rank)}`}>#{e.rank}</td>
                  <td className="px-6 py-4 font-semibold">
                    {e.username}
                    {isMe && <span className="ml-2 text-xs text-indigo-600 font-medium">(you)</span>}
                  </td>
                  <td className="px-6 py-4 font-medium text-green-600">{e.best_total_time_ms.toFixed(2)} ms</td>
                  <td className="px-6 py-4 text-gray-500">{e.best_execution_time_ms.toFixed(2)} ms</td>
                  <td className="px-6 py-4 text-gray-500">{e.best_planning_time_ms.toFixed(2)} ms</td>
                  <td className="px-6 py-4">{e.submission_count}</td>
                  <td className="px-6 py-4 text-gray-500">{e.last_submitted}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />
    </>
  );
}

export default Leaderboard;
