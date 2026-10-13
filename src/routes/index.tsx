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
    <div className="relative min-h-dvh w-full overflow-hidden flex flex-col items-center justify-center payro-gradient-dark">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background: "radial-gradient(640px 420px at 50% 35%, #10B981 0%, transparent 60%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(circle at 50% 40%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 40%, black, transparent 70%)",
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
        <p className="mt-2 text-white/60 text-xs font-semibold tracking-[0.25em]">
          SPLIT SMART · PAY EASY
        </p>
      </div>
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)_+_4rem)] flex gap-1.5">
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
  );
}
