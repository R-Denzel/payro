import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { getRestaurantAccess } from "@/lib/restaurant-auth";
import { signInWithGoogle } from "@/lib/supabase-auth";

export const Route = createFileRoute("/restaurant/register")({
  ssr: false,
  beforeLoad: async () => {
    if (await getRestaurantAccess()) throw redirect({ to: "/restaurant/dashboard" });
  },
  component: Register,
});
function Register() {
  const [fields, setFields] = useState({
    name: "",
    owner: "",
    email: "",
    phone: "",
    password: "",
    location: "",
    category: "Restaurant",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const nav = useNavigate();
  const change =
    (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFields({ ...fields, [key]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (fields.password.length < 8) throw new Error("Use a password with at least 8 characters.");
      const c = getSupabase();
      if (!c)
        throw new Error(
          "Restaurant signup is not connected yet. Configure the app backend to create your restaurant account.",
        );
      const { data, error } = await c.auth.signUp({
        email: fields.email,
        password: fields.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?intent=restaurant-signup`,
          data: {
            full_name: fields.owner,
            restaurant_name: fields.name,
            restaurant_category: fields.category,
            restaurant_location: fields.location,
            restaurant_phone: fields.phone,
          },
        },
      });
      if (error) throw error;
      if (data.session) {
        const access = await import("@/lib/restaurant-auth").then((m) => m.getRestaurantAccess());
        if (!access)
          throw new Error(
            "Account created, but restaurant registration could not be completed. Contact support.",
          );
        nav({ to: "/restaurant/dashboard" });
      } else
        setError(
          "Check your business email to confirm your account. Your restaurant application will be ready when you sign in.",
        );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete registration.");
    } finally {
      setBusy(false);
    }
  }
  async function registerWithGoogle() {
    setError("");
    if (
      fields.name.trim().length < 2 ||
      fields.owner.trim().length < 2 ||
      !fields.phone.trim() ||
      !fields.location.trim()
    ) {
      setError(
        "Enter the restaurant name, owner name, phone number, and location before continuing with Google.",
      );
      return;
    }
    setGoogleBusy(true);
    try {
      await signInWithGoogle("restaurant-signup", {
        name: fields.name.trim(),
        owner: fields.owner.trim(),
        category: fields.category,
        location: fields.location.trim(),
        phone: fields.phone.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google sign-up.");
      setGoogleBusy(false);
    }
  }
  const input = (key: keyof typeof fields, label: string, type = "text", placeholder = "") => (
    <label className="block text-sm font-semibold">
      {label}
      <input
        required
        type={type}
        value={fields[key]}
        onChange={change(key)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-emerald-700"
      />
    </label>
  );
  return (
    <main className="min-h-dvh bg-[#f5f5f0] px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <Link to="/restaurant" className="font-bold text-emerald-900">
          ← Payro for Restaurants
        </Link>
        <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-800">
            Partner application
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Bring your restaurant to Payro</h1>
          <p className="mt-2 text-slate-600">
            Create an owner account. Restaurant access is reviewed before bills can be published.
          </p>
          <button
            type="button"
            disabled={googleBusy}
            onClick={registerWithGoogle}
            className="mt-7 h-12 w-full rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 disabled:opacity-60"
          >
            {googleBusy ? "Connecting to Google…" : "Sign up with Google"}
          </button>
          <div className="mt-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or create an account with email
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
            {input("name", "Restaurant or business name")}
            {input("owner", "Owner's full name")}
            {input("email", "Business email", "email")}
            {input("phone", "Phone number", "tel", "+254 7xx xxx xxx")}
            {input("password", "Password", "password", "At least 8 characters")}
            <label className="block text-sm font-semibold">
              Business category
              <select
                value={fields.category}
                onChange={change("category")}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3"
              >
                <option>Restaurant</option>
                <option>Cafe</option>
                <option>Bar & Grill</option>
                <option>Hotel</option>
                <option>Other</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              {input("location", "Restaurant location", "text", "Area, city")}
            </div>
            {error && (
              <p
                role="alert"
                className="sm:col-span-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
              >
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="h-12 rounded-xl bg-emerald-800 font-semibold text-white disabled:opacity-60 sm:col-span-2"
            >
              {busy ? "Creating account…" : "Create restaurant account"}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-600">
            Already registered?{" "}
            <Link to="/restaurant/login" className="font-semibold text-emerald-800">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
