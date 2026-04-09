import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Pagination, { paginate, totalPages } from "../components/Pagination";

interface Challenge {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  time_limit_ms: number;
  is_active: boolean;
  created_at: string;
  submission_count: number;
  best_time_ms: number | null;
  schema_tables: string[];
}

const difficultyBadge: Record<string, string> = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  hard: "bg-red-100 text-red-800",
};

function Challenges() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => {
    apiFetch<Challenge[]>("/api/challenges")
      .then(setChallenges)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Reset to page 1 when filters change
  useEffect(() => setPage(1), [filter, search, sort]);

  const filtered = challenges
    .filter((c) => filter === "all" || c.difficulty === filter)
    .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sort) {
        case "newest": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name": return a.title.localeCompare(b.title);
        case "submissions": return b.submission_count - a.submission_count;
        default: return 0;
      }
    });

  const paged = paginate(filtered, page, PAGE_SIZE);
  const pages = totalPages(filtered.length, PAGE_SIZE);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">Challenges</h2>
          {user?.is_admin && (
            <Link
              to="/admin/challenges/new"
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
            >
              + New Challenge
            </Link>
          )}
        </div>
        <div className="flex gap-2">
          {["all", "easy", "medium", "hard"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                filter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by challenge name..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-1">
          {[
            { id: "newest", label: "Newest" },
            { id: "oldest", label: "Oldest" },
            { id: "name", label: "Name" },
            { id: "submissions", label: "Most Submissions" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setSort(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                sort === s.id
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading challenges...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No challenges yet. Check back soon!</p>
      ) : (
        <>
        <div className="grid gap-4">
          {paged.map((c) => (
            <Link
              key={c.id}
              to={`/challenges/${c.id}`}
              className="block bg-white rounded-xl shadow hover:shadow-md transition p-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {c.title}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        difficultyBadge[c.difficulty] ??
                        "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {c.difficulty.charAt(0).toUpperCase() +
                        c.difficulty.slice(1)}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{c.description}</p>
                  <div className="flex gap-6 text-xs text-gray-500">
                    {c.schema_tables && c.schema_tables.length > 0 && (
                      <span>
                        Schema:{" "}
                        <span className="text-gray-700">
                          {c.schema_tables.join(", ")}
                        </span>
                      </span>
                    )}
                    <span>
                      Timeout:{" "}
                      <span className="text-gray-700">
                        {c.time_limit_ms / 1000}s
                      </span>
                    </span>
                  </div>
                </div>
                <div className="text-right ml-6">
                  <p className="text-sm text-gray-500">
                    {c.submission_count} submissions
                  </p>
                  {c.best_time_ms != null && (
                    <p className="text-sm text-gray-500">
                      Best:{" "}
                      <span className="font-medium text-green-600">
                        {c.best_time_ms.toFixed(2)} ms
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
        <Pagination currentPage={page} totalPages={pages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

export default Challenges;
