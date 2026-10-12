import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { FieldError } from "@/components/payro/States";
import { AlertTriangle, Camera, ImageUp, Plus, Sparkles, Trash2 } from "lucide-react";
import { getAccessToken, uploadReceipt } from "@/lib/data";
import { setExpenseDraft } from "@/lib/expense-draft";
import { prepareReceiptImage } from "@/lib/image";
import { formatMoney, parseMoney } from "@/lib/money";
import { scanReceipt, type ScannedReceipt } from "@/lib/receipt-scan";
import { requireProfileComplete } from "@/lib/route-guards";

export const Route = createFileRoute("/scan")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  component: Scan,
});

type EditableItem = { name: string; qty: string; price: string };

function Scan() {
  const nav = useNavigate();
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<"pick" | "scanning" | "review">("pick");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<(ScannedReceipt & { receiptPath: string | null }) | null>(
    null,
  );
  const [merchant, setMerchant] = useState("");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [service, setService] = useState("0");
  const [tax, setTax] = useState("0");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPhase("scanning");
    try {
      const image = await prepareReceiptImage(file);
      setPreview(image.previewUrl);
      const [receiptPath, scanned] = await Promise.all([
        // Keep the photo even if storage fails; the scan is what matters.
        uploadReceipt(image.blob).catch(() => null),
        getAccessToken().then((accessToken) =>
          scanReceipt({ data: { imageBase64: image.base64, accessToken } }),
        ),
      ]);
      setResult({ ...scanned, receiptPath });
      setMerchant(scanned.merchant);
      setItems(
        scanned.items.map((i) => ({
          name: i.name,
          qty: String(i.qty),
          price: String(i.price_cents / 100),
        })),
      );
      setService(String(scanned.service_cents / 100));
      setTax(String(scanned.tax_cents / 100));
      setPhase("review");
    } catch (e) {
      setError(e);
      setPhase("pick");
    }
  };

  const itemsCents = items.reduce((s, i) => s + (parseMoney(i.price) ?? 0), 0);
  const totalCents = itemsCents + (parseMoney(service) ?? 0) + (parseMoney(tax) ?? 0);
  const printed = result?.printed_total_cents ?? 0;
  const mismatch = result !== null && Math.abs(totalCents - printed) > 1;
  const currency = result?.currency ?? "KES";

  const update = (index: number, patch: Partial<EditableItem>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const continueToSplit = () => {
    if (!result) return;
    const cleaned = items
      .map((i) => ({
        name: i.name.trim() || "Item",
        qty: Math.max(1, parseInt(i.qty, 10) || 1),
        price_cents: parseMoney(i.price) ?? 0,
      }))
      .filter((i) => i.price_cents > 0);
    if (cleaned.length === 0) {
      setError(new Error("Add at least one item with a price"));
      return;
    }
    setExpenseDraft({
      ...result,
      merchant: merchant.trim(),
      items: cleaned,
      service_cents: parseMoney(service) ?? 0,
      tax_cents: parseMoney(tax) ?? 0,
      mismatch,
    });
    nav({ to: "/expense/new" });
  };

  return (
    <MobileFrame showNav={false} contentClassName={phase === "review" ? "" : "bg-black"}>
      <TopBar
        back="/home"
        title="AI Receipt Scanner"
        right={
          phase !== "review" ? (
            <span className="text-xs text-white/60">POWERED BY CLAUDE</span>
          ) : undefined
        }
      />

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {phase !== "review" ? (
        <div className="px-5">
          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
            {preview ? (
              <img
                src={preview}
                alt="Receipt"
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 text-sm px-10 text-center gap-2">
                <Camera className="h-10 w-10 text-white/40" />
                Take a photo of the whole receipt, flat and well lit.
              </div>
            )}
            {[
              "top-4 left-4 border-t-2 border-l-2 rounded-tl-xl",
              "top-4 right-4 border-t-2 border-r-2 rounded-tr-xl",
              "bottom-4 left-4 border-b-2 border-l-2 rounded-bl-xl",
              "bottom-4 right-4 border-b-2 border-r-2 rounded-br-xl",
            ].map((c) => (
              <div key={c} className={`absolute h-10 w-10 border-primary ${c}`} />
            ))}
            {phase === "scanning" && (
              <>
                <div
                  className="absolute inset-x-4 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_theme(colors.emerald.400)]"
                  style={{ animation: "scanY 2s ease-in-out infinite", top: "50%" }}
                />
                <style>{`@keyframes scanY {0%,100%{top:15%}50%{top:85%}}`}</style>
              </>
            )}
          </div>

          {phase === "scanning" ? (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 text-white/80 text-sm">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                Reading receipt with AI… this takes a few seconds
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {error ? (
                <div className="rounded-2xl bg-red-500/10 border border-red-400/30 p-3 text-sm text-red-200">
                  {error instanceof Error ? error.message : "Scan failed"}
                </div>
              ) : null}
              <button
                onClick={() => cameraInput.current?.click()}
                className="w-full h-14 rounded-2xl payro-gradient text-white font-semibold shadow-glow flex items-center justify-center gap-2"
              >
                <Camera className="h-5 w-5" /> Take photo
              </button>
              <button
                onClick={() => fileInput.current?.click()}
                className="w-full h-12 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold flex items-center justify-center gap-2"
              >
                <ImageUp className="h-5 w-5" /> Upload from gallery
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 pb-6">
          {preview && (
            <img
              src={preview}
              alt="Receipt"
              className="h-28 w-full object-cover rounded-2xl border border-border"
            />
          )}
          <div className="mt-4 rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Merchant
            </p>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="mt-1 w-full bg-transparent outline-none text-[15px] font-semibold text-navy"
            />
          </div>

          <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1">
            Detected items — tap to edit
          </p>
          <div className="mt-2 rounded-2xl bg-white border border-border divide-y divide-border">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5">
                <input
                  value={item.qty}
                  onChange={(e) => update(i, { qty: e.target.value.replace(/\D/g, "") })}
                  inputMode="numeric"
                  aria-label="Quantity"
                  className="w-9 h-9 rounded-lg bg-surface text-center text-sm font-semibold outline-none"
                />
                <input
                  value={item.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  aria-label="Item name"
                  className="flex-1 min-w-0 h-9 bg-transparent text-sm text-navy outline-none"
                />
                <input
                  value={item.price}
                  onChange={(e) => update(i, { price: e.target.value.replace(/[^\d.]/g, "") })}
                  inputMode="decimal"
                  aria-label="Line total"
                  className="w-20 h-9 rounded-lg bg-surface text-right px-2 text-sm font-semibold outline-none"
                />
                <button
                  onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Remove item"
                  className="h-9 w-7 flex items-center justify-center text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setItems((prev) => [...prev, { name: "", qty: "1", price: "" }])}
              className="w-full p-3 text-sm text-primary font-semibold flex items-center justify-center gap-1"
            >
              <Plus className="h-4 w-4" /> Add item
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">
              Service charge
              <input
                value={service}
                onChange={(e) => setService(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                className="mt-1 w-full h-10 rounded-xl border border-border px-3 text-sm text-navy font-semibold outline-none"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Tax added on top
              <input
                value={tax}
                onChange={(e) => setTax(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                className="mt-1 w-full h-10 rounded-xl border border-border px-3 text-sm text-navy font-semibold outline-none"
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl bg-surface p-4 space-y-1">
            <div className="flex justify-between text-sm font-bold">
              <span>Total</span>
              <span className="text-primary">{formatMoney(totalCents, currency)}</span>
            </div>
            {mismatch && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Receipt total is {formatMoney(printed, currency)}. Check the items before splitting.
              </p>
            )}
            {result?.notes && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                {result.notes}
              </p>
            )}
          </div>

          <FieldError error={error} />
          <button
            onClick={continueToSplit}
            className="mt-4 w-full h-14 rounded-2xl payro-gradient text-white font-semibold shadow-glow"
          >
            Continue to split
          </button>
          <button
            onClick={() => {
              setPhase("pick");
              setPreview(null);
              setResult(null);
            }}
            className="mt-2 w-full h-11 text-sm text-muted-foreground font-semibold"
          >
            Scan a different receipt
          </button>
        </div>
      )}
    </MobileFrame>
  );
}
