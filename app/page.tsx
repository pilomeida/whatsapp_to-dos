"use client";

import { useEffect, useState } from "react";

interface Todo {
  id: string;
  title: string;
  notes: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  deadline: string | null;
  category: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
}

const priorityColor: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-yellow-400",
  medium: "bg-blue-500",
  low: "bg-emerald-500",
};

const priorityLabel: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

type Filter = "all" | "today" | "week" | "done";

function isToday(deadline: string | null): boolean {
  if (!deadline) return false;
  const today = new Date().toLocaleDateString("en-CA");
  return deadline === today;
}

function isThisWeek(deadline: string | null): boolean {
  if (!deadline) return false;
  const today = new Date();
  const week = new Date(today);
  week.setDate(week.getDate() + 7);
  const d = new Date(deadline + "T00:00:00");
  return d >= today && d <= week;
}

function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  const today = new Date().toLocaleDateString("en-CA");
  return deadline < today;
}

function formatDeadline(deadline: string): string {
  const today = new Date().toLocaleDateString("en-CA");
  if (deadline === today) return "today";
  const d = new Date(deadline + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function Dashboard() {
  const [open, setOpen] = useState<Todo[]>([]);
  const [done, setDone] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  // Add form state
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newPriority, setNewPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [newDeadline, setNewDeadline] = useState("");
  const [newCategory, setNewCategory] = useState("");

  async function fetchTodos() {
    const res = await fetch("/api/todos");
    const data = await res.json();
    setOpen(data.open ?? []);
    setDone(data.done ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchTodos(); }, []);

  async function markDone(id: string) {
    await fetch("/api/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done: true }),
    });
    fetchTodos();
  }

  async function markUndone(id: string) {
    await fetch("/api/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done: false }),
    });
    fetchTodos();
  }

  async function setPriority(id: string, priority: "urgent" | "high" | "medium" | "low") {
    await fetch("/api/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, priority }),
    });
    fetchTodos();
  }

  async function setDeadline(id: string, deadline: string) {
    await fetch("/api/todos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, deadline: deadline || null }),
    });
    fetchTodos();
  }

  async function handleChangePwd(e: React.FormEvent) {
    e.preventDefault();
    setPwdSaving(true);
    setPwdError("");
    const res = await fetch("/api/auth/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
    });
    if (res.ok) {
      setShowChangePwd(false);
      setCurrentPwd("");
      setNewPwd("");
    } else {
      const data = await res.json();
      setPwdError(data.error ?? "Something went wrong.");
    }
    setPwdSaving(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        notes: newNotes.trim() || null,
        priority: newPriority,
        deadline: newDeadline || null,
        category: newCategory.trim() || null,
      }),
    });
    setNewTitle("");
    setNewNotes("");
    setNewPriority("medium");
    setNewDeadline("");
    setNewCategory("");
    setShowAdd(false);
    setSaving(false);
    fetchTodos();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this to-do?")) return;
    await fetch(`/api/todos?id=${id}`, { method: "DELETE" });
    fetchTodos();
  }

  const visibleTodos =
    filter === "done"
      ? done
      : open.filter((t) => {
          if (filter === "today") return isToday(t.deadline) || !t.deadline;
          if (filter === "week") return isThisWeek(t.deadline) || !t.deadline;
          return true;
        });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "done", label: "Done" },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-serif text-3xl font-normal text-stone-900 tracking-tight">
                To-Dos
              </h1>
              <p className="text-sm text-stone-400 mt-0.5">
                {open.length} open · {done.length} completed recently
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowChangePwd(!showChangePwd); setShowAdd(false); }}
                className="text-sm px-3 py-2 text-stone-400 hover:text-stone-700 transition-colors"
                title="Change password"
              >
                🔑
              </button>
              <button
                onClick={() => { setShowAdd(!showAdd); setShowChangePwd(false); }}
                className="text-sm px-4 py-2 bg-stone-900 text-white rounded hover:bg-stone-700 transition-colors"
              >
                {showAdd ? "Cancel" : "+ Add"}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Change password form */}
        {showChangePwd && (
          <form
            onSubmit={handleChangePwd}
            className="mb-8 bg-white border border-stone-200 rounded-lg p-5 shadow-sm"
          >
            <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-4">
              Change password
            </h2>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Current password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                autoFocus
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              <input
                type="password"
                placeholder="New password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              {pwdError && <p className="text-red-500 text-xs">{pwdError}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowChangePwd(false); setPwdError(""); }}
                  className="px-3 py-2 text-sm text-stone-500 hover:text-stone-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="px-4 py-2 bg-stone-900 text-white text-sm rounded hover:bg-stone-700 transition-colors disabled:opacity-50"
                >
                  {pwdSaving ? "Saving…" : "Update"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Add form */}
        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="mb-8 bg-white border border-stone-200 rounded-lg p-5 shadow-sm"
          >
            <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-4">
              New to-do
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              <div className="flex gap-3">
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as "urgent" | "high" | "medium" | "low")}
                  className="border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
                <input
                  type="text"
                  placeholder="Category (optional)"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="ml-auto px-4 py-2 bg-stone-900 text-white text-sm rounded hover:bg-stone-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "Adding…" : "Add"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex gap-1 mb-6">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                filter === f.key
                  ? "bg-stone-900 text-white"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Todo list */}
        {loading ? (
          <p className="text-stone-400 text-sm">Loading…</p>
        ) : visibleTodos.length === 0 ? (
          <p className="text-stone-400 text-sm">
            {filter === "done" ? "Nothing completed recently." : "No to-dos here."}
          </p>
        ) : (
          <div className="space-y-2">
            {visibleTodos.map((todo) => (
              <div
                key={todo.id}
                className={`bg-white border rounded-lg px-4 py-3 shadow-sm flex items-start gap-3 group ${
                  todo.done ? "opacity-60 border-stone-100" : "border-stone-200"
                }`}
              >
                {/* Done checkbox */}
                <button
                  onClick={() => todo.done ? markUndone(todo.id) : markDone(todo.id)}
                  className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 transition-colors ${
                    todo.done
                      ? "bg-stone-400 border-stone-400"
                      : "border-stone-300 hover:border-stone-500"
                  }`}
                  title={todo.done ? "Mark undone" : "Mark done"}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-medium ${todo.done ? "line-through text-stone-400" : "text-stone-900"}`}
                    >
                      {todo.title}
                    </span>
                    {/* Priority dot */}
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityColor[todo.priority]}`}
                      title={priorityLabel[todo.priority]}
                    />
                  </div>
                  {todo.notes && (
                    <p className="text-xs text-stone-400 mt-0.5">{todo.notes}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {/* Category tag */}
                    {todo.category && (
                      <span className="text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                        {todo.category}
                      </span>
                    )}
                    {/* Inline priority edit */}
                    {!todo.done && (
                      <select
                        value={todo.priority}
                        onChange={(e) =>
                          setPriority(todo.id, e.target.value as "urgent" | "high" | "medium" | "low")
                        }
                        className="text-xs text-stone-400 bg-transparent border-none focus:outline-none cursor-pointer hover:text-stone-700"
                      >
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    )}
                    {/* Inline deadline edit */}
                    {!todo.done && (
                      <input
                        type="date"
                        value={todo.deadline ?? ""}
                        onChange={(e) => setDeadline(todo.id, e.target.value)}
                        className={`text-xs bg-transparent border-none focus:outline-none cursor-pointer ${
                          isOverdue(todo.deadline)
                            ? "text-red-500 font-medium"
                            : "text-stone-400 hover:text-stone-700"
                        }`}
                        title="Set deadline"
                      />
                    )}
                    {todo.deadline && !todo.done && (
                      <span
                        className={`text-xs ${
                          isOverdue(todo.deadline) ? "text-red-500 font-medium" : "text-stone-400"
                        }`}
                      >
                        {isOverdue(todo.deadline) ? "⚠ overdue · " : ""}
                        due {formatDeadline(todo.deadline)}
                      </span>
                    )}
                    {todo.done && todo.done_at && (
                      <span className="text-xs text-stone-400">
                        Completed{" "}
                        {new Date(todo.done_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(todo.id)}
                  className="flex-shrink-0 text-stone-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-lg leading-none mt-0.5"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
