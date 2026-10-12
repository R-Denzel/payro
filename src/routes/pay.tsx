import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Avatar, EmptyState, ErrorNote, FieldError, Loading } from "@/components/payro/States";
import { Check, Info, PartyPopper } from "lucide-react";
import {
  currentUserId,
  outstanding,
  personName,
  useExpenses,
  useRecordPayment,
  type PaymentProvider,
} from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { requireProfileComplete } from "@/lib/route-guards";

export const Route = createFileRoute("/pay")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  validateSearch: (search: Record<string, unknown>): { share?: string } => ({
    share: typeof search.share === "string" ? search.share : undefined,
  }),
  component: Pay,
});

const methods: {
  id: PaymentProvider;
  name: string;
  sub: string;
  color: string;
  initial: string;
}[] = [
  { id: "mpesa", name: "M-Pesa", sub: "Sent via M-Pesa", color: "bg-emerald-600", initial: "M" },
  { id: "airtel", name: "Airtel Money", sub: "Sent via Airtel", color: "bg-red-600", initial: "A" },
  { id: "mtn", name: "MTN MoMo", sub: "Sent via MoMo", color: "bg-yellow-500", initial: "M" },
  { id: "cash", name: "Cash", sub: "Paid in person", color: "bg-navy", initial: "C" },
];

function Pay() {
  const me = currentUserId();
  const search = Route.useSearch();
  const nav = useNavigate();
  const expenses = useExpenses();
  const record = useRecordPayment();
  const [selected, setSelected] = useState<string | null>(search.share ?? null);
  const [method, setMethod] = useState<PaymentProvider>("mpesa");
  const [reference, setReference] = useState("");
  const [done, setDone] = useState<{ amount: number; to: string; currency: string } | null>(null);

  // Shares I owe to other people.
  const debts = (expenses.data ?? []).flatMap((e) =>
    e.expense_participants
      .filter((p) => p.user_id === me && e.creator_id !== me && outstanding(p) > 0)
      .map((p) => ({
        participant: p,
        expense: e,
        to: personName(e.creator) ?? "Someone",
        amount: outstanding(p),
      })),
  );
  const debt = debts.find((d) => d.participant.id === selected) ?? null;

  if (done)
    return (
      <MobileFrame showNav={false}>
        <div className="h-full flex flex-col items-center justify-center px-6 text-center animate-fade-in">
          <div className="h-24 w-24 rounded-full payro-gradient flex items-center justify-center shadow-glow animate-scale-in">
            <Check className="h-12 w-12 text-white" strokeWidth={3} />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-navy">Payment recorded</h2>
          <p className="mt-1 text-muted-foreground">
            {formatMoney(done.amount, done.currency)} to {done.to}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">They've been notified.</p>
          <button
            onClick={() => nav({ to: "/home" })}
            className="mt-8 w-full h-14 rounded-2xl payro-gradient text-white font-semibold shadow-glow"
          >
            Done
          </button>
        </div>
      </MobileFrame>
    );

  return (
    <MobileFrame showNav={false}>
      <TopBar back="/home" title="Settle up" />
      <div className="px-6 pb-6">
        {expenses.isLoading ? (
          <Loading />
        ) : expenses.error ? (
          <ErrorNote error={expenses.error} onRetry={() => expenses.refetch()} />
        ) : debts.length === 0 ? (
          <EmptyState
            icon={<PartyPopper className="h-6 w-6" />}
            title="You're all settled"
            body="You don't owe anyone right now."
            action={
              <Link to="/home" className="text-sm font-semibold text-primary">
                Back home
              </Link>
            }
          />
        ) : !debt ? (
          <>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              What you owe
            </p>
            <div className="space-y-2">
              {debts.map((d) => (
                <button
                  key={d.participant.id}
                  onClick={() => setSelected(d.participant.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border bg-white text-left"
                >
                  <Avatar name={d.to} seed={d.expense.creator_id} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy">{d.to}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.expense.merchant}</p>
                  </div>
                  <span className="text-sm font-bold text-destructive">
                    {formatMoney(d.amount, d.expense.currency)}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-white border border-border p-5 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Amount
              </p>
              <p className="mt-1 text-4xl font-bold text-navy">
                {formatMoney(debt.amount, debt.expense.currency)}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Avatar name={debt.to} seed={debt.expense.creator_id} className="h-8 w-8 text-xs" />
                <p className="text-sm text-navy">
                  to <span className="font-semibold">{debt.to}</span> · {debt.expense.merchant}
                </p>
              </div>
              {debts.length > 1 && (
                <button
                  onClick={() => setSelected(null)}
                  className="mt-3 text-xs font-semibold text-primary"
                >
                  Choose a different debt
                </button>
              )}
            </div>

            <div className="mt-4 rounded-2xl bg-sky-50 border border-sky-100 p-3 flex gap-2 text-xs text-sky-900">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              Send the money with your usual app, then record it here. Payro doesn't move money yet.
            </div>

            <p className="mt-6 text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              How did you pay?
            </p>
            <div className="space-y-2">
              {methods.map((m) => {
                const on = method === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition ${on ? "border-primary bg-accent" : "border-border bg-white"}`}
                  >
                    <div
                      className={`h-11 w-11 rounded-xl ${m.color} flex items-center justify-center text-white font-bold`}
                    >
                      {m.initial}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-navy">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.sub}</p>
                    </div>
                    <div
                      className={`h-5 w-5 rounded-full border-2 ${on ? "border-primary bg-primary" : "border-border"} flex items-center justify-center`}
                    >
                      {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {method !== "cash" && (
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
                placeholder="Transaction code (optional), e.g. SLK4H7XQ2P"
                className="mt-3 w-full h-12 rounded-xl border border-border bg-surface px-3 text-sm font-medium outline-none focus:border-primary"
              />
            )}

            <FieldError error={record.error} />
            <button
              onClick={() =>
                record.mutate(
                  { participantId: debt.participant.id, provider: method, reference },
                  {
                    onSuccess: () =>
                      setDone({
                        amount: debt.amount,
                        to: debt.to,
                        currency: debt.expense.currency,
                      }),
                  },
                )
              }
              disabled={record.isPending}
              className="mt-6 w-full h-14 rounded-2xl payro-gradient text-white font-semibold shadow-glow active:scale-[0.99] transition disabled:opacity-60"
            >
              {record.isPending ? "Recording…" : "Record payment"}
            </button>
          </>
        )}
      </div>
    </MobileFrame>
  );
}
