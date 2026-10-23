import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/restaurant/reset-password")({
  ssr: false,
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
      const c = getSupabase();
      if (!c) throw new Error("Password recovery is unavailable.");
      const code = new URLSearchParams(location.search).get("code");
      if (code) {
        const { error } = await c.auth.exchangeCodeForSession(code);
        if (error) throw error;
      }
      const { error } = await c.auth.updateUser({ password });
      if (error) throw error;
      setMessage("Password updated. You can now sign in to the restaurant portal.");
      await c.auth.signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This recovery link is invalid or expired.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[#f5f5f0] px-5">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-800">
          Payro for Restaurants
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Set a new password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose a secure password for your restaurant account.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold">
            New password
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 h-12 w-full rounded-xl border px-4"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-emerald-800">
              {message}
            </p>
          )}
          <button
            disabled={busy}
            className="h-12 w-full rounded-xl bg-emerald-800 font-semibold text-white"
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
        <Link
          to="/restaurant/login"
          className="mt-5 block text-center text-sm font-semibold text-emerald-800"
        >
          Back to restaurant login
        </Link>
      </section>
    </main>
  );
}
