import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Check, Copy, QrCode, RefreshCw } from "lucide-react";
import { createExpenseSplitInvite } from "@/lib/data";
import { FieldError } from "@/components/payro/States";

export function ExpenseSplitInvite({ expenseId }: { expenseId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrError, setQrError] = useState<Error | null>(null);
  const [copied, setCopied] = useState(false);
  const createInvite = useMutation({ mutationFn: () => createExpenseSplitInvite(expenseId) });

  useEffect(() => {
    if (!token) return;
    const inviteUrl = new URL(
      `/split/${encodeURIComponent(token)}`,
      window.location.origin,
    ).toString();
    setLink(inviteUrl);
    setQrData(null);
    setQrError(null);
    void QRCode.toDataURL(inviteUrl, {
      width: 256,
      margin: 2,
      color: { dark: "#102a43", light: "#ffffff" },
    })
      .then(setQrData)
      .catch((error: unknown) =>
        setQrError(error instanceof Error ? error : new Error("Could not generate the QR code.")),
      );
  }, [token]);

  async function copyLink() {
    if (!link) return;
    setQrError(null);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      setQrError(error instanceof Error ? error : new Error("Could not copy the invite link."));
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-primary">
          <QrCode className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-navy">Let guests choose their items</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Share a QR code so guests can join without an account and select what they had. Their
            share updates as items are claimed.
          </p>
        </div>
      </div>

      {qrData && link ? (
        <div className="mt-4 flex flex-col items-center rounded-2xl bg-surface p-4">
          <img src={qrData} alt="QR code to join this expense split" className="h-52 w-52" />
          <p className="mt-2 max-w-full break-all text-center text-[11px] text-muted-foreground">
            {link}
          </p>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-navy"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Link copied" : "Copy invite link"}
          </button>
          <button
            type="button"
            onClick={() => createInvite.mutate(undefined, { onSuccess: setToken })}
            disabled={createInvite.isPending}
            className="mt-3 inline-flex h-9 items-center gap-2 text-xs font-semibold text-muted-foreground disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {createInvite.isPending ? "Creating replacement…" : "Create replacement QR"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => createInvite.mutate(undefined, { onSuccess: setToken })}
          disabled={createInvite.isPending}
          className="mt-4 h-11 w-full rounded-xl payro-gradient text-sm font-semibold text-white disabled:opacity-60"
        >
          {createInvite.isPending ? "Creating invite…" : "Create guest QR code"}
        </button>
      )}

      <FieldError error={createInvite.error ?? qrError} />
      {token && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Creating a replacement QR code will invalidate this one. Invites expire after 14 days.
        </p>
      )}
    </section>
  );
}
