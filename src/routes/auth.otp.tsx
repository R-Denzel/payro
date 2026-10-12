import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { getPendingPhone, getStoredSession } from "@/lib/auth-store";
import { sendOtp, verifyOtp } from "@/lib/supabase-auth";

const RESEND_SECONDS = 60;

export const Route = createFileRoute("/auth/otp")({
  ssr: false,
  beforeLoad: () => {
    if (getStoredSession()) {
      throw redirect({ to: "/home" });
    }
    if (!getPendingPhone()) {
      throw redirect({ to: "/auth" });
    }
  },
  component: Otp,
});

function Otp() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const nav = useNavigate();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const pendingPhone = getPendingPhone() ?? "";

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const handleComplete = async (digits = code) => {
    if (verifying) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyOtp(digits.join(""));
      nav({ to: "/home" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setError(null);
    try {
      await sendOtp(pendingPhone);
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend code");
    }
  };

  const setDigit = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const n = [...code];
    n[i] = v;
    setCode(n);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (n.every((d) => d) && i === 5) handleComplete(n);
  };
  return (
    <MobileFrame showNav={false}>
      <TopBar back="/auth" />
      <div className="px-6">
        <h1 className="text-3xl font-bold text-navy leading-tight">Verify your number</h1>
        <p className="mt-2 text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-semibold text-navy">
            {pendingPhone.replace(/(\d{3})(\d{3})(\d{3})$/, " $1 $2 $3")}
          </span>
        </p>

        <div className="mt-10 flex gap-2 justify-between">
          {code.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus();
              }}
              inputMode="numeric"
              maxLength={1}
              className={`h-14 w-12 rounded-2xl border-2 text-center text-xl font-bold outline-none ${d ? "border-primary bg-accent text-navy" : "border-border bg-surface"}`}
            />
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <button onClick={handleResend} className="mt-6 text-sm text-muted-foreground">
          Didn't get it?{" "}
          <span className="text-primary font-semibold">
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
          </span>
        </button>

        <button
          onClick={() => handleComplete()}
          disabled={verifying || code.some((d) => !d)}
          className="mt-10 w-full h-14 rounded-2xl payro-gradient text-white font-semibold shadow-glow active:scale-[0.99] transition disabled:opacity-60"
        >
          {verifying ? "Verifying…" : "Verify & Continue"}
        </button>

        <div className="mt-8 rounded-2xl bg-surface p-4 border border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            🔒 Your number is used to secure your account. Payro will never share it with anyone.
          </p>
        </div>
      </div>
    </MobileFrame>
  );
}
