import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api/client";

interface ChallengeData {
  title: string;
  description: string;
  difficulty: string;
  schema_sql: string;
  seed_sql: string;
  index_sql: string;
  seed_sql_large: string;
  ground_truth_query: string;
  time_limit_ms: number;
  is_active: boolean;
}

const EMPTY_FORM: ChallengeData = {
  title: "",
  description: "",
  difficulty: "medium",
  schema_sql: "",
  seed_sql: "",
  index_sql: "",
  seed_sql_large: "",
  ground_truth_query: "",
  time_limit_ms: 5000,
  is_active: true,
};

function ChallengeForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [form, setForm] = useState<ChallengeData>(EMPTY_FORM);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch<ChallengeData>(`/api/challenges/${id}/admin`)
      .then((data) => setForm(data))
      .catch(() => setError("Failed to load challenge."))
      .finally(() => setLoading(false));
  }, [id]);

  const updateField = (
    field: keyof ChallengeData,
    value: string | number | boolean,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isEditing) {
        await apiFetch(`/api/challenges/${id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await apiFetch("/api/challenges", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      navigate("/profile");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <Link
          to="/profile"
          className="text-sm text-indigo-600 hover:underline"
        >
          &larr; Back to Profile
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {isEditing ? "Edit Challenge" : "New Challenge"}
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <TextInput
          label="Title"
          value={form.title}
          onChange={(v) => updateField("title", v)}
          required
        />

        <TextAreaInput
          label="Description"
          value={form.description}
          onChange={(v) => updateField("description", v)}
          rows={3}
          required
        />

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Difficulty
            </label>
            <select
              value={form.difficulty}
              onChange={(e) => updateField("difficulty", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Limit (ms)
            </label>
            <input
              type="number"
              value={form.time_limit_ms}
              onChange={(e) =>
                updateField("time_limit_ms", parseInt(e.target.value) || 5000)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => updateField("is_active", e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Active
            </label>
          </div>
        </div>

        <TextAreaInput
          label="Schema SQL (DDL)"
          value={form.schema_sql}
          onChange={(v) => updateField("schema_sql", v)}
          rows={8}
          mono
          placeholder="CREATE TABLE customers (&#10;  id SERIAL PRIMARY KEY,&#10;  name VARCHAR(100) NOT NULL&#10;);"
          required
        />

        <TextAreaInput
          label="Seed SQL (DML)"
          value={form.seed_sql}
          onChange={(v) => updateField("seed_sql", v)}
          rows={6}
          mono
          placeholder="INSERT INTO customers (name) VALUES ('Alice'), ('Bob');"
          required
        />

        <TextAreaInput
          label="Index SQL (for indexed instance)"
          value={form.index_sql}
          onChange={(v) => updateField("index_sql", v)}
          rows={4}
          mono
          placeholder="CREATE INDEX idx_orders_customer ON orders(customer_id);&#10;CREATE INDEX idx_orders_date ON orders(order_date);"
        />

        <TextAreaInput
          label="Large Dataset SQL (extra seed for large instance)"
          value={form.seed_sql_large}
          onChange={(v) => updateField("seed_sql_large", v)}
          rows={4}
          mono
          placeholder="INSERT INTO orders (customer_id, amount, order_date)&#10;SELECT (random()*4+1)::int, (random()*500)::numeric(10,2), '2025-01-01'::date + (random()*365)::int&#10;FROM generate_series(1, 10000);"
        />

        <TextAreaInput
          label="Ground Truth Query"
          value={form.ground_truth_query}
          onChange={(v) => updateField("ground_truth_query", v)}
          rows={6}
          mono
          placeholder="SELECT name, COUNT(*) FROM customers GROUP BY name;"
          required
        />

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {submitting
              ? "Saving..."
              : isEditing
                ? "Update Challenge"
                : "Create Challenge"}
          </button>
          <Link
            to="/profile"
            className="px-6 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

function TextAreaInput({
  label,
  value,
  onChange,
  rows,
  mono,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  mono?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows ?? 4}
        required={required}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${mono ? "font-mono text-sm" : ""}`}
      />
    </div>
  );
}

export default ChallengeForm;
