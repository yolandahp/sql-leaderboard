import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";

interface LeaderboardEntry {
  rank: number;
  username: string;
  solved: number;
  total: number;
  avg_execution_time_ms: number;
}

interface Stats {
  active_challenges: number;
  total_submissions: number;
  registered_users: number;
}

function Home() {
  const [topUsers, setTopUsers] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiFetch<LeaderboardEntry[]>("/api/leaderboard?limit=5")
      .then(setTopUsers)
      .catch(() => {});
    apiFetch<Stats>("/api/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <div className="text-center py-16">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4">
          SQL Performance Leaderboard
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Compete by writing the most efficient PostgreSQL queries. Submit your
          solutions, get instant feedback on correctness and performance, and
          climb the leaderboard.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            to="/challenges"
            className="bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-indigo-700 transition"
          >
            View Challenges
          </Link>
          <Link
            to="/leaderboard"
            className="bg-white text-indigo-600 border-2 border-indigo-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-indigo-50 transition"
          >
            Leaderboard
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-16">
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <p className="text-3xl font-bold text-indigo-600">
            {stats?.active_challenges ?? "--"}
          </p>
          <p className="text-sm text-gray-500 mt-1">Active Challenges</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <p className="text-3xl font-bold text-indigo-600">
            {stats?.total_submissions?.toLocaleString() ?? "--"}
          </p>
          <p className="text-sm text-gray-500 mt-1">Total Submissions</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <p className="text-3xl font-bold text-indigo-600">
            {stats?.registered_users ?? "--"}
          </p>
          <p className="text-sm text-gray-500 mt-1">Registered Users</p>
        </div>
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <p className="text-3xl font-bold text-indigo-600">&lt; 2s</p>
          <p className="text-sm text-gray-500 mt-1">Avg Response Time</p>
        </div>
      </div>

      {/* How it works */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
          How It Works
        </h2>
        <div className="grid grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              1
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Pick a Challenge
            </h3>
            <p className="text-gray-600">
              Choose from challenges with different schemas, data sizes, and
              difficulty levels.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              2
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Write &amp; Submit SQL
            </h3>
            <p className="text-gray-600">
              Write your SELECT query in the editor. We parse and validate it,
              then run it in an isolated sandbox.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              3
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Compete &amp; Learn
            </h3>
            <p className="text-gray-600">
              See your execution plan, compare with others, and get index
              recommendations to improve.
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Platform Features
        </h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow p-6">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-blue-50 text-blue-700">
              Query Plan Diff
            </span>
            <p className="text-gray-600 text-sm">
              Compare EXPLAIN ANALYZE output across submissions. See structural
              changes, per-node timing deltas, and buffer cache hit ratios.
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-green-50 text-green-700">
              Index Recommendations
            </span>
            <p className="text-gray-600 text-sm">
              Get hypothetical index suggestions via HypoPG. See estimated cost
              reduction without actually creating indexes.
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-orange-50 text-orange-700">
              Multi-Instance Testing
            </span>
            <p className="text-gray-600 text-sm">
              Queries run against multiple PostgreSQL instances with different
              data sizes, versions, and index configurations.
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-red-50 text-red-700">
              Sandbox Execution
            </span>
            <p className="text-gray-600 text-sm">
              Every query runs in an isolated Docker container with read-only
              transactions, statement timeouts, and resource limits.
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-6">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-teal-50 text-teal-700">
              Real-time Leaderboard
            </span>
            <p className="text-gray-600 text-sm">
              Per-challenge and overall rankings based on correctness and average
              execution time across all instances.
            </p>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Top Performers
        </h2>
        <div className="bg-white rounded-xl shadow overflow-hidden max-w-2xl mx-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Solved
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Avg Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topUsers.length > 0 ? (
                topUsers.map((u) => (
                  <tr key={u.rank} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-indigo-600">
                      #{u.rank}
                    </td>
                    <td className="px-6 py-4 text-sm">{u.username}</td>
                    <td className="px-6 py-4 text-sm">
                      {u.solved}/{u.total}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {u.avg_execution_time_ms.toFixed(2)} ms
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-4 text-sm text-gray-400 text-center"
                  >
                    No submissions yet. Be the first!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-6 py-3 bg-gray-50 text-center">
            <Link
              to="/leaderboard"
              className="text-sm text-indigo-600 hover:underline font-medium"
            >
              View Full Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
