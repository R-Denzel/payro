import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MobileFrame, PayroLogo } from "@/components/payro/Frame";
import { getPendingSessionInvite, getStoredSession, setPendingPhone } from "@/lib/auth-store";
import { sendOtp, signInWithGoogle } from "@/lib/supabase-auth";

export const Route = createFileRoute("/auth")({
  // Session lives in browser storage, so gate on the client only.
  ssr: false,
  beforeLoad: () => {
    if (getStoredSession()) {
      const inviteToken = getPendingSessionInvite();
      if (inviteToken) {
        throw redirect({ to: "/restaurant/join/$token", params: { token: inviteToken } });
      }
      throw redirect({ to: "/home" });
    }
  },
  component: Auth,
});

function Auth() {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();
  const handleContinue = async () => {
    if (phone.replace(/\D/g, "").length < 9) {
      setError("Enter your phone number");
      return;
    }
    const normalized = `+254${phone.replace(/\D/g, "").replace(/^0/, "")}`;
    setSending(true);
    setError(null);
    try {
      await sendOtp(normalized);
      setPendingPhone(normalized);
      nav({ to: "/auth/otp" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setSending(false);
    }
  };
  const handleGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle("customer"); // navigates away to Google on success
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Google sign-in");
    }
  };
  return (
    <MobileFrame showNav={false}>
      <div className="px-6 pt-4 flex flex-col h-full">
        <div className="flex items-center gap-3 lg:hidden">
          <PayroLogo className="h-10 w-10" />
          <span className="text-lg font-bold text-navy">Payro</span>
        </div>
        <div className="mt-10">
          <h1 className="text-3xl font-bold text-navy leading-tight">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">Enter your phone number to continue</p>
        </div>

        <div className="mt-8">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Phone Number
          </label>
          <div className="mt-2 flex items-center rounded-2xl border border-border bg-surface h-14 px-4 gap-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
            <div className="flex items-center gap-2 pr-3 border-r border-border">
              <span className="text-xl">🇰🇪</span>
              <span className="text-sm font-semibold">+254</span>
            </div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="712 345 678"
              inputMode="tel"
              autoComplete="tel-national"
              className="flex-1 bg-transparent outline-none text-[15px] font-medium placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={sending}
          className="mt-6 w-full h-14 rounded-2xl payro-gradient text-white font-semibold shadow-glow active:scale-[0.99] transition disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send OTP"}
        </button>

        <div className="mt-8 flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or continue with</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={handleGoogle}
            className="h-14 rounded-2xl border border-border bg-white flex items-center justify-center gap-2 font-medium text-sm active:scale-[0.99]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2c-.3 1.4-1.1 2.6-2.3 3.4v2.8h3.7c2.2-2 3.4-4.9 3.4-8.3z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v2.9C3.7 21.4 7.5 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7.5H1.8C1 9.1.5 10.9.5 12.6s.4 3.5 1.3 5.1l3.8-2.9z"
              />
              <path
                fill="#EA4335"
                d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.5 0 3.7 2.6 1.8 6.5l3.8 2.9C6.5 6.8 9 4.8 12 4.8z"
              />
            </svg>
            Google
          </button>
          <button className="h-14 rounded-2xl bg-navy text-white flex items-center justify-center gap-2 font-medium text-sm active:scale-[0.99]">
            <svg width="16" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            Apple
          </button>
        </div>

        <p className="mt-auto pt-8 pb-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/" className="text-navy font-medium">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/" className="text-navy font-medium">
            Privacy Policy
          </Link>
        </p>
      </div>
    </MobileFrame>
  );
}
