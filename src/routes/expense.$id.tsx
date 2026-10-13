import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Avatar, ErrorNote, FieldError, Loading } from "@/components/payro/States";
import { Check, X } from "lucide-react";
import {
  MpesaNumberPrompt,
  ShareRequestPanel,
  usePayoutNumber,
} from "@/components/payro/RequestMoney";
import {
  currentUserId,
  outstanding,
  participantName,
  personName,
  useExpense,
  useReceiptUrl,
  useCreatePaymentRequest,
  useRecordPayment,
} from "@/lib/data";
import { formatMoney, relativeDay, timeOfDay } from "@/lib/money";
import { requireProfileComplete } from "@/lib/route-guards";

export const Route = createFileRoute("/expense/$id")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  component: ExpenseDetail,
});

function ExpenseDetail() {
  const { id } = Route.useParams();
  const me = currentUserId();
  const expense = useExpense(id);
  const receipt = useReceiptUrl(expense.data?.receipt_url ?? null);
  const record = useRecordPayment();
  const createRequest = useCreatePaymentRequest();
  const payout = usePayoutNumber();
  const [sheet, setSheet] = useState<{
    token: string;
    name: string;
    amount: number;
    phone: string | null;
  } | null>(null);

  if (expense.isLoading)
    return (
      <MobileFrame showNav={false}>
        <TopBar back="/home" title="Expense" />
        <Loading />
      </MobileFrame>
    );
  if (expense.error || !expense.data)
    return (
      <MobileFrame showNav={false}>
        <TopBar back="/home" title="Expense" />
        <div className="px-5">
          <ErrorNote error={expense.error ?? new Error("Not found")} />
        </div>
      </MobileFrame>
    );

  const e = expense.data;
  const iAmCreator = e.creator_id === me;
  const paidBy = iAmCreator ? "You" : (personName(e.creator) ?? "Someone");
  const unpaidOthers = e.expense_participants.filter(
    (p) => p.user_id !== e.creator_id && outstanding(p) > 0,
  );
  const nameOf = (participantId: string) => {
    const p = e.expense_participants.find((x) => x.id === participantId);
    return p ? participantName(p, me) : "?";
  };

  return (
    <MobileFrame showNav={false}>
      <TopBar
        back={e.group_id ? `/groups/${e.group_id}` : "/home"}
        title={e.merchant}
        subtitle={`${e.groups ? `${e.groups.emoji} ${e.groups.name} · ` : ""}${relativeDay(e.created_at)} ${timeOfDay(e.created_at)}`}
      />
      <div className="px-5 pb-6">
        <div className="rounded-3xl payro-gradient-dark p-5 text-white">
          <p className="text-white/60 text-xs uppercase tracking-wider">{e.category}</p>
          <p className="mt-1 text-3xl font-bold">{formatMoney(e.total_cents, e.currency)}</p>
          <p className="text-white/70 text-sm mt-0.5">
            {paidBy} paid · split{" "}
            {e.split_mode === "items"
              ? "by item"
              : e.split_mode === "custom"
                ? "by shares"
                : "equally"}
          </p>
          {e.status === "settled" && (
            <span className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold">
              <Check className="h-3 w-3" /> SETTLED
            </span>
          )}
        </div>

        <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Who owes what
        </p>
        {iAmCreator && unpaidOthers.length > 0 && !payout.isLoading && !payout.number && (
          <div className="mb-3">
            <MpesaNumberPrompt />
          </div>
        )}
        <div className="space-y-2">
          {e.expense_participants.map((p) => {
            const left = outstanding(p);
            const name = participantName(p, me);
            const isCreatorRow = p.user_id === e.creator_id;
            const canMarkPaid = left > 0 && (iAmCreator || p.user_id === me);
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 py-2.5 px-3 rounded-2xl bg-surface"
              >
                <Avatar name={name === "You" ? "Me" : name} seed={p.user_id ?? p.id} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isCreatorRow
                      ? "Paid the bill"
                      : left === 0
                        ? "Paid"
                        : p.amount_paid_cents > 0
                          ? `Paid ${formatMoney(p.amount_paid_cents, e.currency)} · ${formatMoney(left, e.currency)} left`
                          : "Pending"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-navy">
                    {formatMoney(p.amount_due_cents, e.currency)}
                  </p>
                  {canMarkPaid &&
                    !isCreatorRow &&
                    (p.user_id === me ? (
                      <Link
                        to="/pay"
                        search={{ share: p.id }}
                        className="text-[11px] font-semibold text-primary"
                      >
                        Pay my share
                      </Link>
                    ) : (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => record.mutate({ participantId: p.id, provider: "cash" })}
                          disabled={record.isPending}
                          className="text-[11px] font-semibold text-muted-foreground disabled:opacity-50"
                        >
                          Mark paid
                        </button>
                        <button
                          onClick={() =>
                            createRequest.mutate(p.id, {
                              onSuccess: (token) =>
                                setSheet({ token, name, amount: left, phone: p.guest_phone }),
                            })
                          }
                          disabled={createRequest.isPending || !payout.number}
                          className="text-[11px] font-semibold text-primary disabled:opacity-50"
                        >
                          {createRequest.isPending && createRequest.variables === p.id
                            ? "…"
                            : "Request"}
                        </button>
                      </div>
                    ))}
                  {left === 0 && !isCreatorRow && (
                    <p className="text-[11px] font-semibold text-success">✓ Paid</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <FieldError error={record.error ?? createRequest.error} />

        {e.expense_items.length > 0 && (
          <>
            <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Items
            </p>
            <div className="rounded-2xl bg-white border border-border divide-y divide-border">
              {e.expense_items.map((item) => (
                <div key={item.id} className="p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-navy">
                      {item.qty > 1 ? `${item.qty}× ` : ""}
                      {item.name}
                    </span>
                    <span className="font-semibold text-navy">
                      {formatMoney(item.price_cents, e.currency)}
                    </span>
                  </div>
                  {item.item_claims.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.item_claims.map((c) => nameOf(c.participant_id)).join(", ")}
                    </p>
                  )}
                </div>
              ))}
              {(e.service_cents > 0 || e.tax_cents > 0) && (
                <div className="p-3 text-xs text-muted-foreground space-y-0.5">
                  {e.service_cents > 0 && (
                    <div className="flex justify-between">
                      <span>Service charge</span>
                      <span>{formatMoney(e.service_cents, e.currency)}</span>
                    </div>
                  )}
                  {e.tax_cents > 0 && (
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>{formatMoney(e.tax_cents, e.currency)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {receipt.data && (
          <a href={receipt.data} target="_blank" rel="noreferrer" className="block mt-6">
            <img
              src={receipt.data}
              alt="Receipt"
              className="w-full max-h-80 object-contain rounded-2xl border border-border bg-surface"
            />
          </a>
        )}
      </div>

      {sheet && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end lg:items-center justify-center animate-fade-in"
          onClick={() => setSheet(null)}
        >
          <div
            onClick={(ev) => ev.stopPropagation()}
            className="w-full max-w-[520px] rounded-t-3xl lg:rounded-3xl bg-white p-6 pb-[calc(env(safe-area-inset-bottom)_+_1.5rem)]"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-navy">Request from {sheet.name}</h2>
              <button
                onClick={() => setSheet(null)}
                aria-label="Close"
                className="h-9 w-9 rounded-full bg-surface flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ShareRequestPanel
              token={sheet.token}
              name={sheet.name}
              amountCents={sheet.amount}
              currency={e.currency}
              reason={e.merchant}
              phone={sheet.phone}
            />
          </div>
        </div>
      )}
    </MobileFrame>
  );
}
