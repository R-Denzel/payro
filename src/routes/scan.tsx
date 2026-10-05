import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Check, Sparkles } from "lucide-react";

export const Route = createFileRoute("/scan")({ component: Scan });

function Scan() {
  const [phase, setPhase] = useState<"scanning" | "done">("scanning");
  const nav = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => setPhase("done"), 2400);
    return () => clearTimeout(t);
  }, []);

  return (
    <MobileFrame showNav={false} contentClassName="bg-black">
      <TopBar
        back="/expense/new"
        title="AI Receipt Scanner"
        right={<span className="text-xs text-white/60">POWERED BY AI</span>}
      />

      <div className="px-5">
        <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
          {/* Simulated receipt */}
          <div className="absolute inset-6 rounded-xl bg-[#f8f5ed] shadow-2xl p-4 text-[10px] font-mono text-zinc-800 leading-relaxed rotate-[-2deg]">
            <p className="text-center font-bold text-sm">JAVA HOUSE</p>
            <p className="text-center text-[9px]">Westlands Branch · Nairobi</p>
            <div className="border-t border-dashed border-zinc-400 my-2" />
            <div className="flex justify-between">
              <span>2× Cappuccino</span>
              <span>640</span>
            </div>
            <div className="flex justify-between">
              <span>1× Avocado Toast</span>
              <span>850</span>
            </div>
            <div className="flex justify-between">
              <span>1× Big Breakfast</span>
              <span>1,200</span>
            </div>
            <div className="flex justify-between">
              <span>3× Fresh Juice</span>
              <span>1,350</span>
            </div>
            <div className="border-t border-dashed border-zinc-400 my-2" />
            <div className="flex justify-between font-bold">
              <span>TOTAL</span>
              <span>KES 4,040</span>
            </div>
          </div>

          {/* Corner brackets */}
          {[
            "top-4 left-4 border-t-2 border-l-2 rounded-tl-xl",
            "top-4 right-4 border-t-2 border-r-2 rounded-tr-xl",
            "bottom-4 left-4 border-b-2 border-l-2 rounded-bl-xl",
            "bottom-4 right-4 border-b-2 border-r-2 rounded-br-xl",
          ].map((c) => (
            <div key={c} className={`absolute h-10 w-10 border-primary ${c}`} />
          ))}

          {/* Scan line */}
          {phase === "scanning" && (
            <div
              className="absolute inset-x-4 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_theme(colors.emerald.400)]"
              style={{ animation: "scanY 2s ease-in-out infinite", top: "50%" }}
            />
          )}
          <style>{`@keyframes scanY {0%,100%{top:15%}50%{top:85%}}`}</style>

          {phase === "done" && (
            <div className="absolute inset-x-4 bottom-4 rounded-2xl glass p-3 flex items-center gap-2 animate-fade-in">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-4 w-4 text-white" strokeWidth={3} />
              </div>
              <div className="flex-1">
                <p className="text-white text-xs font-semibold">Merchant detected</p>
                <p className="text-white/70 text-[10px]">Java House · Westlands</p>
              </div>
            </div>
          )}
        </div>

        {phase === "scanning" ? (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 text-white/80 text-sm">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              Reading receipt with AI…
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-3xl bg-white p-4 animate-fade-in">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Detected items
            </p>
            <div className="mt-2 divide-y divide-border">
              {[
                ["2× Cappuccino", "640"],
                ["Avocado Toast", "850"],
                ["Big Breakfast", "1,200"],
                ["3× Fresh Juice", "1,350"],
              ].map(([n, p]) => (
                <div key={n} className="flex justify-between py-2 text-sm">
                  <span className="text-navy">{n}</span>
                  <span className="font-semibold text-navy">KES {p}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 text-sm font-bold">
                <span>Total</span>
                <span className="text-primary">KES 4,040</span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-accent p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold text-navy">AI suggested split</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Split equally among 4 members ·{" "}
                <span className="text-navy font-semibold">KES 1,010 each</span>
              </p>
            </div>

            <button
              onClick={() => nav({ to: "/home" })}
              className="mt-4 w-full h-13 py-3.5 rounded-2xl payro-gradient text-white font-semibold shadow-glow"
            >
              Confirm & split
            </button>
          </div>
        )}
      </div>
    </MobileFrame>
  );
}
