import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { FieldError, Loading } from "@/components/payro/States";
import {
  MpesaNumberPrompt,
  ShareRequestPanel,
  usePayoutNumber,
} from "@/components/payro/RequestMoney";
import { getStoredSession } from "@/lib/auth-store";
import { useRequestMoney } from "@/lib/data";
import { formatMoney, parseMoney } from "@/lib/money";
import { toMsisdn } from "@/lib/mpesa";
import { requireProfileComplete } from "@/lib/route-guards";

export const Route = createFileRoute("/request")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  component: RequestMoney,
});

function RequestMoney() {
  const currency = getStoredSession()?.currency ?? "KES";
  const payout = usePayoutNumber();
  const request = useRequestMoney();
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");

  const cents = parseMoney(amount) ?? 0;
  const msisdn = phone.trim() ? toMsisdn(phone) : null;
  const phoneInvalid = phone.trim() !== "" && !msisdn;
  const ready = cents > 0 && name.trim().length > 0 && !phoneInvalid && !!payout.number;

  const submit = () =>
    ready &&
    request.mutate({
      name: name.trim(),
      phone: msisdn,
      amountCents: cents,
      currency,
      reason: reason.trim() || "money you owe me",
    });

  if (request.data)
    return (
      <MobileFrame showNav={false}>
        <div className="px-6 pt-6 pb-8">
          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-full payro-gradient flex items-center justify-center shadow-glow animate-scale-in">
              <Check className="h-8 w-8 text-white" strokeWidth={3} />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-navy">Request ready</h1>
            <p className="mt-1 text-muted-foreground">
              Send it to {name.trim()} — they can pay with M-Pesa, no app needed.
            </p>
          </div>
          <div className="mt-6">
            <ShareRequestPanel
              token={request.data.token}
              name={name.trim()}
              amountCents={cents}
              currency={currency}
              reason={reason.trim() || "money you owe me"}
              phone={msisdn}
            />
          </div>
          <Link
            to="/expense/$id"
            params={{ id: request.data.expenseId }}
            className="mt-6 block text-center text-sm font-semibold text-primary"
          >
            Done
          </Link>
        </div>
      </MobileFrame>
    );

  const field =
    "mt-2 w-full h-14 rounded-2xl border border-border bg-surface px-4 text-[15px] font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";

  return (
    <MobileFrame showNav={false}>
      <TopBar back="/home" title="Request money" />
      <div className="px-6 pb-8 flex flex-col min-h-[calc(100%-4rem)]">
        <div className="py-8 text-center">
          <div className="inline-flex items-baseline gap-2">
            <span className="text-xl font-semibold text-muted-foreground">{currency}</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              inputMode="decimal"
              placeholder="0"
              autoFocus
              aria-label="Amount"
              className="min-w-0 bg-transparent text-6xl font-bold tracking-tight text-navy outline-none placeholder:text-border text-left"
              style={{ width: `${Math.max(amount.length, 1) + 0.5}ch` }}
            />
          </div>
        </div>

        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          From
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Their name"
          autoComplete="off"
          className={field}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="Their phone (optional) — to send it straight to them"
          className={`${field} text-sm`}
        />
        {phoneInvalid && (
          <p className="mt-1 text-xs text-destructive">Enter a Kenyan mobile number</p>
        )}

        <label className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          For
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lunch, rent, tickets…"
          className={field}
        />

        <div className="mt-6">
          {payout.isLoading ? <Loading /> : !payout.number && <MpesaNumberPrompt />}
        </div>

        <FieldError error={request.error} />
        <div className="mt-auto pt-6">
          <button
            onClick={submit}
            disabled={!ready || request.isPending}
            className="w-full h-14 rounded-2xl payro-gradient text-white font-semibold shadow-glow active:scale-[0.99] transition disabled:opacity-50 disabled:shadow-none"
          >
            {request.isPending
              ? "Creating link…"
              : cents > 0
                ? `Request ${formatMoney(cents, currency)}`
                : "Request"}
          </button>
        </div>
      </div>
    </MobileFrame>
  );
}
