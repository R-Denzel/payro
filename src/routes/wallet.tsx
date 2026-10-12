import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Avatar, EmptyState, ErrorNote, Loading } from "@/components/payro/States";
import { Scale } from "lucide-react";
import { balancesByPerson, currentUserId, summarizeBalances, useExpenses } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { requireProfileComplete } from "@/lib/route-guards";

export const Route = createFileRoute("/wallet")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  component: Balances,
});

function Balances() {
  const me = currentUserId();
  const expenses = useExpenses();
  const { owedToMe, iOwe, net } = summarizeBalances(expenses.data ?? [], me);
  const people = balancesByPerson(expenses.data ?? [], me).filter((p) => p.net !== 0);

  return (
    <MobileFrame>
      <TopBar back="/home" title="Balances" />
      <div className="px-5 pb-4">
        <div className="rounded-3xl payro-gradient-dark p-6 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-primary/40 blur-3xl" />
          <p className="text-white/60 text-xs uppercase tracking-widest">Net balance</p>
          <p className="mt-2 text-white text-4xl font-bold tracking-tight">
            {net === 0 ? "Settled" : `${net > 0 ? "+" : "-"}${formatMoney(Math.abs(net))}`}
          </p>
          <p className="mt-1 text-white/70 text-xs">
            {formatMoney(owedToMe)} owed to you · {formatMoney(iOwe)} you owe
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link
              to="/pay"
              className="h-11 rounded-xl bg-white text-navy font-semibold text-sm flex items-center justify-center"
            >
              Settle up
            </Link>
            <Link
              to="/expense/new"
              className="h-11 rounded-xl bg-white/10 text-white font-semibold text-sm flex items-center justify-center border border-white/20"
            >
              Add expense
            </Link>
          </div>
        </div>

        <p className="mt-6 mb-3 text-xs uppercase tracking-wider font-semibold text-muted-foreground">
          By person
        </p>
        {expenses.isLoading ? (
          <Loading />
        ) : expenses.error ? (
          <ErrorNote error={expenses.error} onRetry={() => expenses.refetch()} />
        ) : people.length === 0 ? (
          <EmptyState
            icon={<Scale className="h-6 w-6" />}
            title="No open balances"
            body="When you split a bill, who owes who shows up here."
          />
        ) : (
          <div className="rounded-2xl bg-white border border-border divide-y divide-border">
            {people.map((p) => (
              <div key={p.key} className="flex items-center gap-3 p-3.5">
                <Avatar name={p.name} seed={p.key} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-navy">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.net > 0 ? "owes you" : "you owe"}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold ${p.net > 0 ? "text-success" : "text-destructive"}`}
                >
                  {formatMoney(Math.abs(p.net))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </MobileFrame>
  );
}
