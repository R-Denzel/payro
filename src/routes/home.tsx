import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileFrame } from "@/components/payro/Frame";
import { Avatar, EmptyState, ErrorNote, Loading } from "@/components/payro/States";
import {
  Bell,
  Send,
  Plus,
  ScanLine,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Scale,
} from "lucide-react";
import { getStoredSession } from "@/lib/auth-store";
import {
  currentUserId,
  myShare,
  summarizeBalances,
  useExpenses,
  useNotifications,
} from "@/lib/data";
import { formatMoney, relativeDay } from "@/lib/money";
import { requireProfileComplete } from "@/lib/route-guards";

export const Route = createFileRoute("/home")({
  // Session lives in browser storage, so gate on the client only.
  ssr: false,
  beforeLoad: requireProfileComplete,
  component: Home,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Home() {
  const me = currentUserId();
  const name = getStoredSession()?.fullName ?? "";
  const expenses = useExpenses();
  const notifications = useNotifications();
  const unread = notifications.data?.some((n) => !n.read_at) ?? false;
  const { owedToMe, iOwe, net } = summarizeBalances(expenses.data ?? [], me);

  return (
    <MobileFrame>
      {/* Header */}
      <div className="px-5 pt-2 pb-4 flex items-center justify-between">
        <Link to="/profile" className="flex items-center gap-3">
          <Avatar name={name} seed={me} className="h-11 w-11" />
          <div>
            <p className="text-xs text-muted-foreground">{greeting()}</p>
            <p className="text-sm font-semibold text-navy">{name}</p>
          </div>
        </Link>
        <Link
          to="/notifications"
          className="relative h-11 w-11 rounded-full bg-surface flex items-center justify-center border border-black/5"
        >
          <Bell className="h-5 w-5 text-navy" />
          {unread && (
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
          )}
        </Link>
      </div>

      {/* Balance card */}
      <div className="px-5">
        <Link
          to="/wallet"
          className="block relative rounded-3xl payro-gradient-dark p-5 overflow-hidden"
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/40 blur-3xl" />
          <div className="absolute right-6 top-6 opacity-40">
            <Scale className="h-6 w-6 text-white" />
          </div>
          <p className="text-white/60 text-xs font-medium tracking-wider uppercase">Net balance</p>
          <p className="mt-2 text-white text-3xl font-bold tracking-tight">
            {net === 0 ? "All settled" : `${net > 0 ? "+" : "-"}${formatMoney(Math.abs(net))}`}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
              <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-medium">
                <ArrowDownLeft className="h-3.5 w-3.5" />
                Owed to you
              </div>
              <p className="mt-1 text-white text-lg font-bold">{formatMoney(owedToMe)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
              <div className="flex items-center gap-1.5 text-amber-300 text-xs font-medium">
                <ArrowUpRight className="h-3.5 w-3.5" />
                You owe
              </div>
              <p className="mt-1 text-white text-lg font-bold">{formatMoney(iOwe)}</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="px-5 mt-6 grid grid-cols-4 gap-3">
        {[
          { icon: Plus, label: "Split", to: "/expense/new" },
          { icon: ScanLine, label: "Scan", to: "/scan" },
          { icon: Send, label: "Settle", to: "/pay" },
          { icon: QrCode, label: "My QR", to: "/qr" },
        ].map((a) => (
          <Link key={a.label} to={a.to} className="flex flex-col items-center gap-2 group">
            <div className="h-14 w-14 rounded-2xl bg-surface border border-black/5 flex items-center justify-center group-active:scale-95 transition">
              <a.icon className="h-6 w-6 text-primary" strokeWidth={2} />
            </div>
            <span className="text-[11px] font-medium text-navy">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div className="px-5 mt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-navy">Recent expenses</h2>
          <Link to="/activity" className="text-xs text-primary font-semibold">
            See all
          </Link>
        </div>
        {expenses.isLoading ? (
          <Loading />
        ) : expenses.error ? (
          <ErrorNote error={expenses.error} onRetry={() => expenses.refetch()} />
        ) : expenses.data!.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="No expenses yet"
            body="Scan a receipt or add a bill to split it with friends."
            action={
              <Link
                to="/scan"
                className="inline-flex h-11 px-5 items-center rounded-xl payro-gradient text-white text-sm font-semibold"
              >
                Scan a receipt
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {expenses.data!.slice(0, 5).map((e) => {
              const share = myShare(e, me);
              const iPaid = e.creator_id === me;
              return (
                <Link
                  key={e.id}
                  to="/expense/$id"
                  params={{ id: e.id }}
                  className="flex items-center gap-3 py-3 px-3 rounded-2xl hover:bg-surface transition"
                >
                  <div className="h-11 w-11 rounded-xl bg-accent text-primary flex items-center justify-center text-xs font-bold">
                    {e.groups?.emoji ?? e.category[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">{e.merchant}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {iPaid ? "You paid" : "You owe"} · {e.groups?.name ?? e.category} ·{" "}
                      {relativeDay(e.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-navy">
                      {formatMoney(e.total_cents, e.currency)}
                    </p>
                    {share && !iPaid && (
                      <p className="text-[10px] text-muted-foreground">
                        Your share {formatMoney(share.amount_due_cents, e.currency)}
                      </p>
                    )}
                    {e.status === "settled" && (
                      <p className="text-[10px] text-success font-semibold">Settled</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </MobileFrame>
  );
}
