import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Sparkles, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/analytics")({ component: Analytics });

const bars = [42, 68, 55, 80, 62, 90, 48, 72, 58, 85, 65, 78];
const cats = [
  { name: "Food", pct: 38, amt: "KES 12,400", color: "bg-emerald-500" },
  { name: "Travel", pct: 24, amt: "KES 7,800", color: "bg-sky-500" },
  { name: "Rent", pct: 18, amt: "KES 5,900", color: "bg-violet-500" },
  { name: "Bills", pct: 12, amt: "KES 3,900", color: "bg-amber-500" },
  { name: "Other", pct: 8, amt: "KES 2,600", color: "bg-rose-500" },
];

function Analytics() {
  return (
    <MobileFrame>
      <TopBar back="/home" title="Analytics" />
      <div className="px-5">
        <div className="rounded-3xl bg-gradient-to-br from-navy to-slate-900 p-5 relative overflow-hidden text-white">
          <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-primary/30 blur-3xl" />
          <p className="text-white/60 text-xs uppercase tracking-widest">Spent in May</p>
          <p className="mt-1 text-3xl font-bold">KES 32,600</p>
          <div className="mt-1 inline-flex items-center gap-1 text-emerald-300 text-xs font-medium">
            <TrendingDown className="h-3.5 w-3.5" /> 18% less than April
          </div>

          {/* Bar chart */}
          <div className="mt-5 flex items-end justify-between gap-1 h-24">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-emerald-300"
                  style={{ height: `${h}%`, opacity: i === 5 ? 1 : 0.6 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-white/50 uppercase">
            {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map((m, i) => (
              <span key={i} className={i === 5 ? "text-white" : ""}>
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* AI insight */}
        <div className="mt-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-emerald-50 to-white p-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl payro-gradient flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-semibold text-navy">AI insight</p>
          </div>
          <p className="mt-2 text-sm text-navy leading-relaxed">
            You spend <span className="font-bold text-primary">40% less</span> on takeout when
            eating at home 3+ times per week. Try meal-prep this Sunday to save ~KES 4,200.
          </p>
        </div>

        {/* Categories */}
        <div className="mt-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            By category
          </p>
          <div className="rounded-2xl bg-white border border-border p-4 space-y-3">
            {cats.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-semibold text-navy">{c.name}</span>
                  <span className="font-semibold text-muted-foreground">
                    {c.amt} · {c.pct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.color}`}
                    style={{ width: `${c.pct * 2.5}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Group spending */}
        <div className="mt-5 pb-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Top groups
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: "Nairobi Flat", amt: "KES 8,400", tr: "+12%", pos: false },
              { name: "Road Trip", amt: "KES 5,200", tr: "-8%", pos: true },
              { name: "Lunch Crew", amt: "KES 3,100", tr: "+3%", pos: false },
              { name: "Family", amt: "KES 2,900", tr: "-15%", pos: true },
            ].map((g, i) => (
              <div key={i} className="rounded-2xl border border-border p-3 bg-white">
                <p className="text-xs text-muted-foreground truncate">{g.name}</p>
                <p className="mt-1 text-sm font-bold text-navy">{g.amt}</p>
                <div
                  className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold ${g.pos ? "text-success" : "text-destructive"}`}
                >
                  {g.pos ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  {g.tr}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}
