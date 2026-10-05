import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { createMockOtp, getPendingPhone, getStoredSession, persistSession } from "@/lib/auth-store";

export const Route = createFileRoute("/auth/otp")({
  beforeLoad: () => {
    if (getStoredSession()) {
      throw redirect({ to: "/home" });
    }
  },
  component: Otp,
});

function Otp() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const nav = useNavigate();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const setDigit = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const n = [...code];
    n[i] = v;
    setCode(n);
    if (v && i < 5) refs.current[i + 1]?.focus();
    if (n.every((d) => d) && i === 5) setTimeout(() => nav({ to: "/home" }), 300);
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

        <button className="mt-6 text-sm text-muted-foreground">
          Didn't get it? <span className="text-primary font-semibold">Resend in 42s</span>
        </button>

        <button
          onClick={handleComplete}
          className="mt-10 w-full h-14 rounded-2xl payro-gradient text-white font-semibold shadow-glow active:scale-[0.99] transition"
        >
          Verify & Continue
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
