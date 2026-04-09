import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../api/client";
import Pagination, { paginate, totalPages } from "../components/Pagination";

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

interface AdminChallenge {
  id: number;
  title: string;
  difficulty: string;
  is_active: boolean;
  submission_count: number;
  created_at: string;
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
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.is_admin ?? false;

  useEffect(() => {
    const fetches: Promise<unknown>[] = [
      apiFetch<ProfileStats>("/api/auth/me/stats")
        .then(setStats)
        .catch(() => {}),
    ];

    if (isAdmin) {
      fetches.push(
        apiFetch<AdminChallenge[]>("/api/challenges")
          .then(setChallenges)
          .catch(() => {}),
      );
    } else {
      fetches.push(
        apiFetch<Submission[]>("/api/auth/me/submissions").then(setSubmissions),
      );
    }

    Promise.all(fetches).finally(() => setLoading(false));
  }, [isAdmin]);

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

      {isAdmin ? (
        <AdminChallengesSection
          challenges={challenges}
          setChallenges={setChallenges}
          loading={loading}
        />
      ) : (
        <SubmissionHistory submissions={submissions} loading={loading} />
      )}
    </div>
  );
}

const difficultyBadge: Record<string, string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  hard: "bg-red-100 text-red-800",
};

function AdminChallengesSection({
  challenges,
  setChallenges,
  loading,
}: {
  challenges: AdminChallenge[];
  setChallenges: React.Dispatch<React.SetStateAction<AdminChallenge[]>>;
  loading: boolean;
}) {
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
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-gray-900">Manage Challenges</h3>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Difficulty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submissions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {challenges.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{c.title}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${difficultyBadge[c.difficulty] ?? "bg-gray-100 text-gray-800"}`}>
                      {c.difficulty.charAt(0).toUpperCase() + c.difficulty.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium ${c.is_active ? "text-green-600" : "text-gray-400"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{c.submission_count}</td>
                  <td className="px-6 py-4 text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/admin/challenges/${c.id}/edit`} className="text-indigo-600 hover:underline text-sm mr-4">Edit</Link>
                    <button onClick={() => handleDelete(c.id, c.title)} className="text-red-600 hover:underline text-sm">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function SubmissionHistory({
  submissions,
  loading,
}: {
  submissions: Submission[];
  loading: boolean;
}) {
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const pages = totalPages(submissions.length, PAGE_SIZE);
  const paged = paginate(submissions, page, PAGE_SIZE);

  return (
    <>
      <h3 className="text-xl font-semibold text-gray-900 mb-4">
        Submission History
      </h3>
      {loading ? (
        <p className="text-gray-500">Loading submissions...</p>
      ) : submissions.length === 0 ? (
        <p className="text-gray-500">No submissions yet.</p>
      ) : (
        <>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Challenge</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Result</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Exec Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paged.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-900">{s.id}</td>
                    <td className="px-6 py-3 text-gray-900">
                      {s.challenge_title ?? `Challenge ${s.challenge_id}`}
                    </td>
                    <td className="px-6 py-3">
                      {s.error_message ? (
                        <span className="text-red-600">Error</span>
                      ) : s.is_correct ? (
                        <span className="text-green-600 font-medium">Correct</span>
                      ) : (
                        <span className="text-yellow-600">Incorrect</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-900">
                      {s.execution_time_ms != null ? `${s.execution_time_ms.toFixed(2)} ms` : "--"}
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
                    <td className="px-6 py-3">
                      <Link
                        to={`/challenges/${s.challenge_id}?submission=${s.id}`}
                        className="text-indigo-600 text-sm font-medium hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />
        </>
      )}
    </>
  );
}

export default Profile;
