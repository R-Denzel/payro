import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { EmptyState, ErrorNote, Loading } from "@/components/payro/States";
import { Activity as ActivityIcon } from "lucide-react";
import { currentUserId, myShare, personName, useExpenses, usePayments } from "@/lib/data";
import { formatMoney, relativeDay, timeOfDay } from "@/lib/money";
import { requireProfileComplete } from "@/lib/route-guards";

export const Route = createFileRoute("/activity")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  component: Activity,
});

const PROVIDER_LABEL = {
  mpesa: "M-Pesa",
  airtel: "Airtel",
  mtn: "MTN MoMo",
  card: "Card",
  cash: "Cash",
};

type Row = {
  key: string;
  at: string;
  title: string;
  meta: string;
  amount: string;
  positive: boolean;
  expenseId: string;
};

function Activity() {
  const me = currentUserId();
  const expenses = useExpenses();
  const payments = usePayments();

  let paidIn = 0;
  let paidOut = 0;
  const rows: Row[] = [];

  for (const e of expenses.data ?? []) {
    const share = myShare(e, me);
    const mine = e.creator_id === me;
    rows.push({
      key: `e:${e.id}`,
      at: e.created_at,
      title: e.merchant,
      meta: `${mine ? "You paid" : `${personName(e.creator) ?? "Someone"} paid`} · ${e.groups?.name ?? e.category}`,
      amount: mine
        ? formatMoney(e.total_cents, e.currency)
        : `-${formatMoney(share?.amount_due_cents ?? 0, e.currency)}`,
      positive: false,
      expenseId: e.id,
    });
  }
  for (const p of payments.data ?? []) {
    if (p.status !== "success") continue;
    const received = p.expenses?.creator_id === me && p.payer_id !== me;
    if (received) paidIn += p.amount_cents;
    else if (p.payer_id === me) paidOut += p.amount_cents;
    rows.push({
      key: `p:${p.id}`,
      at: p.created_at,
      title: received ? "Payment received" : "You paid back",
      meta: `${p.expenses?.merchant ?? ""} · ${PROVIDER_LABEL[p.provider]}${p.provider_ref ? ` · ${p.provider_ref}` : ""}`,
      amount: `${received ? "+" : "-"}${formatMoney(p.amount_cents, p.currency)}`,
      positive: received,
      expenseId: p.expense_id,
    });
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));

  const days = new Map<string, Row[]>();
  for (const r of rows) {
    const label = relativeDay(r.at);
    days.set(label, [...(days.get(label) ?? []), r]);
  }

  const loading = expenses.isLoading || payments.isLoading;
  const error = expenses.error ?? payments.error;

  return (
    <MobileFrame>
      <TopBar title="Activity" />

      <div className="px-5 pb-4">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-2xl border border-border p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Received</p>
            <p className="text-sm font-bold text-success mt-1">{formatMoney(paidIn)}</p>
          </div>
          <div className="rounded-2xl border border-border p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Paid back</p>
            <p className="text-sm font-bold text-navy mt-1">{formatMoney(paidOut)}</p>
          </div>
          <div className="rounded-2xl border border-border p-3 text-center bg-accent/40">
            <p className="text-[10px] uppercase text-primary font-semibold">Net</p>
            <p className="text-sm font-bold text-primary mt-1">
              {paidIn - paidOut >= 0 ? "+" : "-"}
              {formatMoney(Math.abs(paidIn - paidOut))}
            </p>
          </div>
        </div>

        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorNote error={error} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ActivityIcon className="h-6 w-6" />}
            title="Nothing here yet"
            body="Expenses and payments will show up here."
          />
        ) : (
          [...days.entries()].map(([label, items]) => (
            <div key={label} className="mb-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">
                {label}
              </p>
              <div className="rounded-2xl bg-white border border-border divide-y divide-border">
                {items.map((t) => (
                  <Link
                    key={t.key}
                    to="/expense/$id"
                    params={{ id: t.expenseId }}
                    className="flex items-center gap-3 p-3.5"
                  >
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center text-[10px] font-bold ${t.positive ? "bg-emerald-100 text-primary" : "bg-surface text-navy"}`}
                    >
                      {t.title[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy truncate">{t.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {t.meta} · {timeOfDay(t.at)}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold whitespace-nowrap ${t.positive ? "text-success" : "text-navy"}`}
                    >
                      {t.amount}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </MobileFrame>
  );
}
