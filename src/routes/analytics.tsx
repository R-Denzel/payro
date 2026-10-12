import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { EmptyState, ErrorNote, Loading } from "@/components/payro/States";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { currentUserId, myShare, useExpenses } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { requireProfileComplete } from "@/lib/route-guards";

export const Route = createFileRoute("/analytics")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  component: Analytics,
});

const CATEGORY_COLORS: Record<string, string> = {
  Food: "bg-emerald-500",
  Travel: "bg-sky-500",
  Rent: "bg-violet-500",
  Bills: "bg-amber-500",
  Shop: "bg-pink-500",
  Fun: "bg-orange-500",
  Other: "bg-slate-400",
};

const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

function Analytics() {
  const me = currentUserId();
  const expenses = useExpenses();

  // "Spent" = your own share of each expense (KES only for now).
  const spend = (expenses.data ?? [])
    .filter((e) => e.currency === "KES")
    .map((e) => ({ e, cents: myShare(e, me)?.amount_due_cents ?? 0, at: new Date(e.created_at) }))
    .filter((s) => s.cents > 0);

  const now = new Date();
  const months = Array.from(
    { length: 12 },
    (_, i) => new Date(now.getFullYear(), now.getMonth() - 11 + i, 1),
  );
  const byMonth = new Map<string, number>();
  for (const s of spend) byMonth.set(monthKey(s.at), (byMonth.get(monthKey(s.at)) ?? 0) + s.cents);
  const series = months.map((m) => byMonth.get(monthKey(m)) ?? 0);
  const max = Math.max(1, ...series);
  const thisMonth = series[11];
  const lastMonth = series[10];
  const change = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  const current = spend.filter((s) => monthKey(s.at) === monthKey(now));
  const byCategory = new Map<string, number>();
  for (const s of current)
    byCategory.set(s.e.category, (byCategory.get(s.e.category) ?? 0) + s.cents);
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  const byGroup = new Map<string, number>();
  for (const s of current) {
    const name = s.e.groups ? `${s.e.groups.emoji} ${s.e.groups.name}` : "No group";
    byGroup.set(name, (byGroup.get(name) ?? 0) + s.cents);
  }
  const groups = [...byGroup.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <MobileFrame>
      <TopBar back="/home" title="Spending insights" />
      <div className="px-5 pb-4">
        {expenses.isLoading ? (
          <Loading />
        ) : expenses.error ? (
          <ErrorNote error={expenses.error} onRetry={() => expenses.refetch()} />
        ) : spend.length === 0 ? (
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" />}
            title="No spending yet"
            body="Your share of each split bill is tracked here."
          />
        ) : (
          <>
            <div className="rounded-3xl bg-gradient-to-br from-navy to-slate-900 p-5 relative overflow-hidden text-white">
              <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-primary/30 blur-3xl" />
              <p className="text-white/60 text-xs uppercase tracking-widest">
                Your share in {now.toLocaleDateString("en-KE", { month: "long" })}
              </p>
              <p className="mt-1 text-3xl font-bold">{formatMoney(thisMonth)}</p>
              {change !== null && (
                <div
                  className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${change <= 0 ? "text-emerald-300" : "text-amber-300"}`}
                >
                  {change <= 0 ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingUp className="h-3.5 w-3.5" />
                  )}
                  {Math.abs(change)}% {change <= 0 ? "less" : "more"} than last month
                </div>
              )}

              <div className="mt-5 flex items-end justify-between gap-1 h-24">
                {series.map((v, i) => (
                  <div key={i} className="flex-1 h-full flex items-end">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-emerald-300"
                      style={{
                        height: `${Math.max(2, (v / max) * 100)}%`,
                        opacity: i === 11 ? 1 : 0.6,
                      }}
                      title={formatMoney(v)}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-white/50 uppercase">
                {months.map((m, i) => (
                  <span key={i} className={`flex-1 text-center ${i === 11 ? "text-white" : ""}`}>
                    {m.toLocaleDateString("en-KE", { month: "narrow" })}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                By category this month
              </p>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No spending this month yet.</p>
              ) : (
                <div className="rounded-2xl bg-white border border-border p-4 space-y-3">
                  {categories.map(([name, cents]) => {
                    const pct = Math.round((cents / thisMonth) * 100);
                    return (
                      <div key={name}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-semibold text-navy">{name}</span>
                          <span className="font-semibold text-muted-foreground">
                            {formatMoney(cents)} · {pct}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-surface overflow-hidden">
                          <div
                            className={`h-full rounded-full ${CATEGORY_COLORS[name] ?? "bg-slate-400"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {groups.length > 0 && (
              <div className="mt-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                  Top groups this month
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {groups.map(([name, cents]) => (
                    <div key={name} className="rounded-2xl border border-border p-3 bg-white">
                      <p className="text-xs text-muted-foreground truncate">{name}</p>
                      <p className="mt-1 text-sm font-bold text-navy">{formatMoney(cents)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MobileFrame>
  );
}
