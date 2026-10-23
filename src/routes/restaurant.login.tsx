import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Utensils } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { getRestaurantAccess } from "@/lib/restaurant-auth";
import { signInWithGoogle } from "@/lib/supabase-auth";

export const Route = createFileRoute("/restaurant/login")({
  ssr: false,
  beforeLoad: async () => {
    if (await getRestaurantAccess()) throw redirect({ to: "/restaurant/dashboard" });
  },
  component: Login,
});
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);
  const nav = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const client = getSupabase();
      if (!client)
        throw new Error(
          "Restaurant sign-in is not connected yet. Configure the app backend to access restaurant accounts.",
        );
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const access = await getRestaurantAccess();
      if (!access) {
        await client.auth.signOut();
        throw new Error(
          "This login is not linked to a restaurant account. Register your restaurant or check your account.",
        );
      }
      nav({ to: "/restaurant/dashboard" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sign in failed. Check your details and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function recover() {
    setError("");
    if (!email) {
      setError("Enter your business email first, then choose forgot password.");
      return;
    }
    try {
      const client = getSupabase();
      if (!client) throw new Error("Password recovery is unavailable.");
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/restaurant/reset-password`,
      });
      if (error) throw error;
      setError("If an account exists for this email, a recovery link is on its way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send recovery email.");
    }
  }
  async function continueWithGoogle() {
    setError("");
    setGoogleBusy(true);
    try {
      await signInWithGoogle("restaurant-login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google sign-in.");
      setGoogleBusy(false);
    }
  }
  return (
    <main className="grid min-h-dvh bg-[#f5f5f0] lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#153d2c] p-12 text-white lg:flex">
        <Link to="/restaurant" className="flex items-center gap-3 text-xl font-bold">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
            <Utensils />
          </span>
          Payro <span className="font-medium text-emerald-200">for Restaurants</span>
        </Link>
        <div className="max-w-lg">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-200">
            For owners, managers & teams
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-tight">
            A calmer way to settle the table.
          </h1>
          <p className="mt-5 text-lg leading-8 text-white/65">
            Manage group sessions, share restaurant bills and see confirmed payments from your
            dedicated workspace.
          </p>
        </div>
        <p className="text-sm text-white/45">
          Secure access for your restaurant and authorised staff.
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link
            to="/restaurant"
            className="flex items-center gap-2 font-bold text-emerald-900 lg:hidden"
          >
            <Utensils /> Payro for Restaurants
          </Link>
          <p className="mt-10 text-xs font-bold uppercase tracking-[.2em] text-emerald-800">
            Restaurant portal
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Welcome back</h2>
          <p className="mt-2 text-slate-600">Sign in to manage your restaurant on Payro.</p>
          <button
            type="button"
            disabled={googleBusy}
            onClick={continueWithGoogle}
            className="mt-8 h-12 w-full rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 disabled:opacity-60"
          >
            {googleBusy ? "Connecting to Google…" : "Continue with Google"}
          </button>
          <div className="mt-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or use email and password
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <form className="mt-5 space-y-5" onSubmit={submit}>
            <label className="block text-sm font-semibold">
              Business email
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-emerald-700"
              />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <div className="mt-2 flex h-12 rounded-xl border border-slate-200 bg-white focus-within:border-emerald-700">
                <input
                  required
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl bg-transparent px-4 outline-none"
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                  className="px-4 text-slate-500"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={recover}
                className="text-sm font-semibold text-emerald-800"
              >
                Forgot password?
              </button>
            </div>
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="h-12 w-full rounded-xl bg-emerald-800 font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in to restaurant portal"}
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-slate-600">
            New to Payro?{" "}
            <Link to="/restaurant/register" className="font-semibold text-emerald-800">
              Register your restaurant
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
