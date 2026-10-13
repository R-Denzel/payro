import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Check, Copy, Smartphone } from "lucide-react";
import { MobileFrame } from "@/components/payro/Frame";
import { Avatar, ErrorNote, FieldError, Loading } from "@/components/payro/States";
import { fetchPaymentRequest, reportRequestPaid } from "@/lib/data";
import { formatLocal, mpesaAppIntent, platform, simMenuLink } from "@/lib/mpesa";
import { formatMoney } from "@/lib/money";

// Public pay page for a money request. No sign-in: the payer may not use Payro.
export const Route = createFileRoute("/r/$token")({
  ssr: false,
  component: PayRequest,
});

function PayRequest() {
  const { token } = Route.useParams();
  const request = useQuery({
    queryKey: ["payment-request", token],
    queryFn: () => fetchPaymentRequest(token),
  });
  const report = useMutation({ mutationFn: (ref: string) => reportRequestPaid(token, ref) });
  const [ref, setRef] = useState("");
  const [copied, setCopied] = useState<"number" | "amount" | null>(null);

  const r = request.data;
  if (request.isLoading)
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  if (request.error)
    return (
      <Shell>
        <ErrorNote error={request.error} onRetry={() => request.refetch()} />
      </Shell>
    );
  if (!r || r.expired)
    return (
      <Shell>
        <Notice title="This link has expired" body="Ask them to send you a new payment link." />
      </Shell>
    );
  if (r.amount_cents === 0)
    return (
      <Shell>
        <Notice
          title="All settled"
          body={`You don't owe ${r.requester} anything for ${r.reason}.`}
        />
      </Shell>
    );
  if (report.isSuccess)
    return (
      <Shell>
        <Notice
          done
          title="Thanks!"
          body={`${r.requester} has been told you paid ${formatMoney(r.amount_cents, r.currency)}.`}
        />
      </Shell>
    );

  const number = r.mpesa_number ? formatLocal(r.mpesa_number) : null;
  const amount = String(r.amount_cents / 100);
  const os = platform();

  const copy = async (what: "number" | "amount") => {
    try {
      await navigator.clipboard.writeText(what === "number" ? number!.replace(/\s/g, "") : amount);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard blocked; the value is on screen to type.
    }
  };

  return (
    <Shell>
      <div className="flex flex-col items-center text-center pt-4">
        <Avatar name={r.requester} className="h-14 w-14 text-lg" />
        <p className="mt-3 text-sm text-muted-foreground">
          Hi {r.payer}, <span className="font-semibold text-navy">{r.requester}</span> is requesting
        </p>
        <p className="mt-1 text-5xl font-bold tracking-tight text-navy">
          {formatMoney(r.amount_cents, r.currency)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">for {r.reason}</p>
      </div>

      {number && (
        <div className="mt-8 rounded-2xl border border-border divide-y divide-border">
          <CopyRow
            label="M-Pesa number"
            value={number}
            done={copied === "number"}
            onCopy={() => copy("number")}
          />
          <CopyRow
            label="Amount"
            value={formatMoney(r.amount_cents, r.currency)}
            done={copied === "amount"}
            onCopy={() => copy("amount")}
          />
        </div>
      )}

      {number && os === "android" ? (
        <>
          <a
            href={mpesaAppIntent()}
            onClick={() => void copy("number")}
            className="mt-5 w-full h-14 rounded-2xl bg-[#00A651] text-white font-semibold flex items-center justify-center gap-2 shadow-[0_14px_30px_-12px_rgba(0,166,81,0.6)] active:scale-[0.99] transition"
          >
            <Smartphone className="h-5 w-5" /> Open M-Pesa
          </a>
          <a
            href={simMenuLink()}
            className="mt-2 block text-center text-sm font-semibold text-primary py-2"
          >
            No app? Use the SIM menu (*334#)
          </a>
        </>
      ) : (
        number && (
          <button
            onClick={() => copy("number")}
            className="mt-5 w-full h-14 rounded-2xl bg-[#00A651] text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition"
          >
            <Copy className="h-5 w-5" />{" "}
            {copied === "number" ? "Number copied" : "Copy M-Pesa number"}
          </button>
        )
      )}

      <p className="mt-3 text-center text-xs text-muted-foreground leading-relaxed">
        In M-Pesa choose <b>Send Money</b>, paste the number and enter the amount.
      </p>

      <div className="mt-8 pt-6 border-t border-border">
        <p className="text-sm font-semibold text-navy">Already paid?</p>
        {r.reported && (
          <p className="mt-1 text-xs text-muted-foreground">
            You've told {r.requester} you paid. They'll confirm it once it shows in their M-Pesa.
          </p>
        )}
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          maxLength={10}
          placeholder="M-Pesa code (optional), e.g. SLK4H7XQ2P"
          className="mt-2 w-full h-12 rounded-xl border border-border bg-surface px-3 text-sm font-medium outline-none focus:border-primary"
        />
        <FieldError error={report.error} />
        <button
          onClick={() => report.mutate(ref)}
          disabled={report.isPending}
          className="mt-3 w-full h-12 rounded-xl border border-navy text-navy font-semibold disabled:opacity-60"
        >
          {report.isPending ? "Sending…" : `Tell ${r.requester} I've paid`}
        </button>
      </div>

      <p className="mt-8 pb-6 text-center text-[11px] text-muted-foreground">
        Sent with Payro · Payro never holds your money
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <MobileFrame showNav={false}>
      <div className="px-6 h-full flex flex-col">{children}</div>
    </MobileFrame>
  );
}

function Notice({ title, body, done }: { title: string; body: string; done?: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      {done && (
        <div className="h-20 w-20 rounded-full payro-gradient flex items-center justify-center shadow-glow animate-scale-in">
          <Check className="h-10 w-10 text-white" strokeWidth={3} />
        </div>
      )}
      <h1 className="mt-5 text-2xl font-bold text-navy">{title}</h1>
      <p className="mt-2 text-muted-foreground">{body}</p>
    </div>
  );
}

function CopyRow({
  label,
  value,
  done,
  onCopy,
}: {
  label: string;
  value: string;
  done: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      onClick={onCopy}
      className="w-full flex items-center justify-between px-4 py-3.5 text-left"
    >
      <div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-lg font-bold text-navy tabular-nums">{value}</p>
      </div>
      <span className="flex items-center gap-1 text-xs font-semibold text-primary">
        {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {done ? "Copied" : "Copy"}
      </span>
    </button>
  );
}
