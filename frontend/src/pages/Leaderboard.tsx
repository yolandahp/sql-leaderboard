import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

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
  avg_execution_time_ms: number;
  planning_time_ms: number;
  submission_count: number;
  last_submitted: string;
}

interface ChallengeOption {
  id: number;
  title: string;
}

function Leaderboard() {
  const [view, setView] = useState<"overall" | "challenge">("overall");
  const [overallEntries, setOverallEntries] = useState<OverallEntry[]>([]);
  const [challengeEntries, setChallengeEntries] = useState<ChallengeEntry[]>([]);
  const [challenges, setChallenges] = useState<ChallengeOption[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<OverallEntry[]>("/api/leaderboard")
      .then(setOverallEntries)
      .catch(() => {})
      .finally(() => setLoading(false));

    apiFetch<ChallengeOption[]>("/api/challenges")
      .then((data) => {
        setChallenges(data);
        if (data.length > 0) setSelectedChallenge(data[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (view !== "challenge" || !selectedChallenge) return;
    setLoading(true);
    apiFetch<ChallengeEntry[]>(`/api/leaderboard/challenge/${selectedChallenge}`)
      .then(setChallengeEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [view, selectedChallenge]);

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

        {view === "challenge" && challenges.length > 0 && (
          <select
            value={selectedChallenge ?? ""}
            onChange={(e) => setSelectedChallenge(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            {challenges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading leaderboard...</p>
      ) : view === "overall" ? (
        <OverallTable entries={overallEntries} rankColor={rankColor} />
      ) : (
        <ChallengeTable entries={challengeEntries} rankColor={rankColor} />
      )}
    </div>
  );
}

function OverallTable({
  entries,
  rankColor,
}: {
  entries: OverallEntry[];
  rankColor: (r: number) => string;
}) {
  if (entries.length === 0)
    return <p className="text-gray-500">No submissions yet. Be the first!</p>;

  return (
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
          {entries.map((e) => (
            <tr
              key={e.rank}
              className={e.rank === 1 ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-gray-50"}
            >
              <td className={`px-6 py-4 font-bold text-lg ${rankColor(e.rank)}`}>#{e.rank}</td>
              <td className="px-6 py-4 font-semibold">{e.username}</td>
              <td className="px-6 py-4">{e.solved} / {e.total}</td>
              <td className="px-6 py-4 font-medium text-green-600">{e.avg_execution_time_ms.toFixed(2)} ms</td>
              <td className="px-6 py-4">{e.submission_count}</td>
              <td className="px-6 py-4 text-gray-500">{e.joined}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChallengeTable({
  entries,
  rankColor,
}: {
  entries: ChallengeEntry[];
  rankColor: (r: number) => string;
}) {
  if (entries.length === 0)
    return <p className="text-gray-500">No correct submissions for this challenge yet.</p>;

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Exec Time</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planning Time</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submissions</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {entries.map((e) => (
            <tr
              key={e.rank}
              className={e.rank === 1 ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-gray-50"}
            >
              <td className={`px-6 py-4 font-bold text-lg ${rankColor(e.rank)}`}>#{e.rank}</td>
              <td className="px-6 py-4 font-semibold">{e.username}</td>
              <td className="px-6 py-4 font-medium text-green-600">{e.avg_execution_time_ms.toFixed(2)} ms</td>
              <td className="px-6 py-4 text-gray-500">{e.planning_time_ms.toFixed(2)} ms</td>
              <td className="px-6 py-4">{e.submission_count}</td>
              <td className="px-6 py-4 text-gray-500">{e.last_submitted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Leaderboard;
