"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });

    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-stone-500 text-sm">Invalid reset link.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="password"
        placeholder="New password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        autoFocus
        required
        className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
      />
      <input
        type="password"
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        className="w-full border border-stone-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-stone-900 text-white text-sm rounded hover:bg-stone-700 transition-colors disabled:opacity-50"
      >
        {loading ? "…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-8 w-full max-w-sm">
        <h1 className="font-serif text-2xl text-stone-900 mb-2">Reset password</h1>
        <p className="text-stone-400 text-sm mb-6">Enter your new password below.</p>
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
