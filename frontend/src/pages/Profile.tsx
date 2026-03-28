import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../api/client";

interface Submission {
  id: number;
  challenge_id: number;
  challenge_title?: string;
  query: string;
  is_correct: boolean;
  execution_time_ms: number | null;
  planning_time_ms: number | null;
  total_cost: number | null;
  error_message: string | null;
  submitted_at: string;
}

interface ProfileStats {
  total_submissions: number;
  challenges_solved: number;
  total_challenges: number;
  overall_rank: number | null;
}

function Profile() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Submission[]>("/api/auth/me/submissions").then(setSubmissions),
      apiFetch<ProfileStats>("/api/auth/me/stats")
        .then(setStats)
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile</h2>

      {/* User Info */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Username</p>
            <p className="text-lg font-medium">{user.username}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="text-lg font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Member since</p>
            <p className="text-lg font-medium">
              {new Date(user.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total submissions</p>
            <p className="text-lg font-medium">
              {stats?.total_submissions ?? submissions.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Challenges solved</p>
            <p className="text-lg font-medium">
              {stats
                ? `${stats.challenges_solved} / ${stats.total_challenges}`
                : "--"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Overall rank</p>
            <p className="text-lg font-medium text-indigo-600">
              {stats?.overall_rank ? `#${stats.overall_rank}` : "--"}
            </p>
          </div>
        </div>
      </div>

      {/* Submission History */}
      <h3 className="text-xl font-semibold text-gray-900 mb-4">
        Submission History
      </h3>
      {loading ? (
        <p className="text-gray-500">Loading submissions...</p>
      ) : submissions.length === 0 ? (
        <p className="text-gray-500">No submissions yet.</p>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Challenge
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Result
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Exec Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td className="px-6 py-3 text-gray-900">{s.id}</td>
                  <td className="px-6 py-3 text-gray-900">
                    {s.challenge_title ?? `Challenge ${s.challenge_id}`}
                  </td>
                  <td className="px-6 py-3">
                    {s.error_message ? (
                      <span className="text-red-600">Error</span>
                    ) : s.is_correct ? (
                      <span className="text-green-600 font-medium">
                        Correct
                      </span>
                    ) : (
                      <span className="text-yellow-600">Incorrect</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-900">
                    {s.execution_time_ms != null
                      ? `${s.execution_time_ms.toFixed(2)} ms`
                      : "--"}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {new Date(s.submitted_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Profile;
