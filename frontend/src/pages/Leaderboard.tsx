import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

interface LeaderboardEntry {
  rank: number;
  username: string;
  solved: number;
  total: number;
  avg_execution_time_ms: number;
  submission_count: number;
  joined: string;
}

function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"overall" | "challenge">("overall");

  useEffect(() => {
    apiFetch<LeaderboardEntry[]>("/api/leaderboard")
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const rankColor = (rank: number) => {
    if (rank === 1) return "text-yellow-600";
    if (rank === 2) return "text-gray-400";
    if (rank === 3) return "text-amber-700";
    return "text-gray-400";
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Leaderboard</h2>

      <div className="flex gap-2 mb-6">
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

      {loading ? (
        <p className="text-gray-500">Loading leaderboard...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500">No submissions yet. Be the first!</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Challenges Solved
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Avg Exec Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total Submissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((e) => (
                <tr
                  key={e.rank}
                  className={
                    e.rank === 1
                      ? "bg-yellow-50 hover:bg-yellow-100"
                      : "hover:bg-gray-50"
                  }
                >
                  <td
                    className={`px-6 py-4 font-bold text-lg ${rankColor(e.rank)}`}
                  >
                    #{e.rank}
                  </td>
                  <td className="px-6 py-4 font-semibold">{e.username}</td>
                  <td className="px-6 py-4">
                    {e.solved} / {e.total}
                  </td>
                  <td className="px-6 py-4 font-medium text-green-600">
                    {e.avg_execution_time_ms.toFixed(2)} ms
                  </td>
                  <td className="px-6 py-4">{e.submission_count}</td>
                  <td className="px-6 py-4 text-gray-500">{e.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
