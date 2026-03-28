import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";

interface Challenge {
  id: number;
  title: string;
  difficulty: string;
  is_active: boolean;
  submission_count: number;
  created_at: string;
}

const difficultyBadge: Record<string, string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  hard: "bg-red-100 text-red-800",
};

function AdminChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = () => {
    apiFetch<Challenge[]>("/api/challenges")
      .then(setChallenges)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(fetchChallenges, []);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/challenges/${id}`, { method: "DELETE" });
      setChallenges((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("Failed to delete challenge.");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Manage Challenges</h2>
        <Link
          to="/admin/challenges/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
        >
          + New Challenge
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : challenges.length === 0 ? (
        <p className="text-gray-500">No challenges yet.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Difficulty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Submissions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {challenges.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {c.title}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${difficultyBadge[c.difficulty] ?? "bg-gray-100 text-gray-800"}`}
                    >
                      {c.difficulty.charAt(0).toUpperCase() +
                        c.difficulty.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-medium ${c.is_active ? "text-green-600" : "text-gray-400"}`}
                    >
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {c.submission_count}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/admin/challenges/${c.id}/edit`}
                      className="text-indigo-600 hover:underline text-sm mr-4"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(c.id, c.title)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Delete
                    </button>
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

export default AdminChallenges;
