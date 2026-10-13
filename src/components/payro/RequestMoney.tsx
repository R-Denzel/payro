import { useState } from "react";
import { Check, Copy, MessageSquare, Share2 } from "lucide-react";
import { FieldError } from "@/components/payro/States";
import { useProfile, useUpdateProfile } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { formatLocal, requestUrl, smsLink, toMsisdn, whatsappLink } from "@/lib/mpesa";

/** The number people pay the current user on: their saved M-Pesa number, else their login phone. */
export function usePayoutNumber() {
  const profile = useProfile();
  const number = profile.data ? (profile.data.mpesa_number ?? profile.data.phone) : null;
  return { number, isLoading: profile.isLoading };
}

/** One-time prompt for users with no phone on file (e.g. Google sign-ins). */
export function MpesaNumberPrompt() {
  const update = useUpdateProfile();
  const [value, setValue] = useState("");
  const msisdn = toMsisdn(value);
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-navy">Where should people pay you?</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Your M-Pesa number is shown on the payment links you send.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="tel"
          placeholder="0712 345 678"
          className="flex-1 min-w-0 h-12 rounded-xl border border-border bg-white px-3 text-[15px] font-medium outline-none focus:border-primary"
        />
        <button
          onClick={() => msisdn && update.mutate({ mpesa_number: msisdn })}
          disabled={!msisdn || update.isPending}
          className="h-12 px-5 rounded-xl payro-gradient text-white text-sm font-semibold disabled:opacity-50"
        >
          {update.isPending ? "Saving…" : "Save"}
        </button>
      </div>
      <FieldError error={update.error} />
    </div>
  );
}

export function requestMessage(o: {
  name: string;
  amountCents: number;
  currency: string;
  reason: string;
  url: string;
}) {
  return `Hi ${o.name}, you owe me ${formatMoney(o.amountCents, o.currency)} for ${o.reason}. Pay with M-Pesa here: ${o.url}`;
}

/** Shown once a pay link exists: every share button is a fresh tap, which phones require. */
export function ShareRequestPanel({
  token,
  name,
  amountCents,
  currency,
  reason,
  phone,
}: {
  token: string;
  name: string;
  amountCents: number;
  currency: string;
  reason: string;
  phone?: string | null;
}) {
  const url = requestUrl(token);
  const text = requestMessage({ name, amountCents, currency, reason, url });
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the link is visible to copy by hand.
    }
  };

  const btn =
    "h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.98] transition";
  return (
    <div>
      <div className="rounded-2xl bg-surface border border-border p-4 text-sm text-navy leading-relaxed break-words">
        {text}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {canShare && (
          <button
            onClick={() => navigator.share({ text }).catch(() => {})}
            className={`${btn} col-span-2 payro-gradient text-white shadow-glow`}
          >
            <Share2 className="h-4 w-4" /> Share request
          </button>
        )}
        <a
          href={whatsappLink(text, phone)}
          target="_blank"
          rel="noreferrer"
          className={`${btn} bg-[#25D366] text-white`}
        >
          WhatsApp
        </a>
        <a href={smsLink(text, phone)} className={`${btn} border border-border bg-white text-navy`}>
          <MessageSquare className="h-4 w-4" /> SMS
        </a>
        <button
          onClick={copy}
          className={`${btn} col-span-2 border border-border bg-white text-navy`}
        >
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy message"}
        </button>
      </div>
      {phone && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Sending to {formatLocal(phone)}
        </p>
      )}
    </div>
  );
}
