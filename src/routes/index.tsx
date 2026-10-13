import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PayroLogo } from "@/components/payro/Frame";
import { getStoredSession } from "@/lib/auth-store";

export const Route = createFileRoute("/")({ component: Splash });

function Splash() {
  const nav = useNavigate();
  useEffect(() => {
    // Returning users skip onboarding.
    const t = setTimeout(() => nav({ to: getStoredSession() ? "/home" : "/onboarding" }), 2200);
    return () => clearTimeout(t);
  }, [nav]);
  return (
    <div
      className="min-h-dvh w-full flex items-center justify-center sm:py-6 sm:px-4"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, #d8f5e9 0%, transparent 60%), linear-gradient(180deg,#eef1f6,#e6ebf3)",
      }}
    >
      <div className="relative w-full sm:max-w-[400px] h-dvh sm:h-[860px] sm:rounded-[44px] sm:shadow-[0_40px_80px_-30px_rgba(15,23,42,0.35)] sm:border border-black/5 overflow-hidden flex flex-col items-center justify-center payro-gradient-dark">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(600px 400px at 50% 30%, #10B981 0%, transparent 60%)",
          }}
        />
        <div className="relative flex flex-col items-center animate-fade-in">
          <div className="relative">
            <div className="absolute inset-0 blur-2xl payro-gradient rounded-3xl opacity-60 animate-pulse" />
            <div className="relative">
              <PayroLogo className="h-24 w-24 animate-scale-in" />
            </div>
          </div>
          <h1 className="mt-8 text-white text-4xl font-bold tracking-tight">Payro</h1>
          <p className="mt-2 text-white/60 text-sm font-medium tracking-wide">
            SPLIT SMART · PAY EASY
          </p>
        </div>
        <div className="absolute bottom-16 flex gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse" />
          <span
            className="h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-white/80 animate-pulse"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
