import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { RestaurantShell } from "@/components/payro/RestaurantPortal";
import { requireRestaurant } from "@/lib/restaurant-auth";
import { getSupabase } from "@/lib/supabase";
import { formatMoney, parseMoney } from "@/lib/money";
import { prepareReceiptImage } from "@/lib/image";
import { getAccessToken } from "@/lib/data";
import { scanReceipt, type ScannedReceipt } from "@/lib/receipt-scan";
import { uid } from "@/lib/utils";

export const Route = createFileRoute("/restaurant/bills")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    session: typeof search.session === "string" ? search.session : undefined,
  }),
  beforeLoad: requireRestaurant,
  component: Bills,
});
function Bills() {
  const search = Route.useSearch();
  const client = useQueryClient();
  const receiptInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ group: search.session ?? "", merchant: "", amount: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const [receiptPreview, setReceiptPreview] = useState("");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ScannedReceipt | null>(null);
  const [items, setItems] = useState<{ name: string; qty: string; price: string }[]>([]);
  const [service, setService] = useState("0");
  const [tax, setTax] = useState("0");
  const q = useQuery({
    queryKey: ["restaurant-bills"],
    queryFn: async () => {
      const c = getSupabase()!;
      const {
        data: { user },
      } = await c.auth.getUser();
      const { data: m, error: me } = await c
        .from("restaurant_members")
        .select("role,restaurants(id,name,status)")
        .eq("user_id", user!.id)
        .limit(1)
        .single();
      if (me) throw me;
      const r = Array.isArray(m.restaurants) ? m.restaurants[0] : m.restaurants;
      const [{ data: bills, error }, { data: sessions, error: se }] = await Promise.all([
        c
          .from("expenses")
          .select("id,merchant,total_cents,status,created_at,groups(name)")
          .eq("restaurant_id", r.id)
          .order("created_at", { ascending: false }),
        c.from("restaurant_sessions").select("group_id").eq("restaurant_id", r.id),
      ]);
      if (error) throw error;
      if (se) throw se;
      const sessionIds = (sessions ?? []).map((session) => session.group_id);
      const { data: groups, error: ge } = sessionIds.length
        ? await c
            .from("groups")
            .select("id,name")
            .in("id", sessionIds)
            .order("created_at", { ascending: false })
        : { data: [], error: null };
      if (ge) throw ge;
      return { r, role: m.role, bills: bills ?? [], groups: groups ?? [] };
    },
  });

  async function handleReceipt(file?: File) {
    if (!file) return;
    setScanBusy(true);
    setScanError("");
    setMessage("");
    try {
      const c = getSupabase();
      if (!c) throw new Error("Supabase is not configured.");
      const { data: { user } } = await c.auth.getUser();
      if (!user) throw new Error("Sign in again to upload a receipt.");

      const image = await prepareReceiptImage(file);
      setReceiptPreview(image.previewUrl);
      const scanned = await scanReceipt({
        data: { imageBase64: image.base64, accessToken: await getAccessToken() },
      });
      const path = `${user.id}/${uid()}.jpg`;
      const { error } = await c.storage.from("receipts").upload(path, image.blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) throw new Error(`Receipt was read but could not be saved: ${error.message}`);

      setReceipt(scanned);
      setReceiptPath(path);
      setItems(scanned.items.map((item) => ({
        name: item.name,
        qty: String(item.qty),
        price: (item.price_cents / 100).toFixed(2),
      })));
      setService((scanned.service_cents / 100).toFixed(2));
      setTax((scanned.tax_cents / 100).toFixed(2));
      setForm((current) => ({
        ...current,
        merchant: scanned.merchant || current.merchant,
        amount: (scanned.printed_total_cents / 100).toFixed(2),
      }));
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Could not read that receipt.");
      setReceipt(null);
      setReceiptPath(null);
    } finally {
      setScanBusy(false);
      if (receiptInput.current) receiptInput.current.value = "";
    }
  }

  const subtotalCents = items.reduce((sum, item) => sum + (parseMoney(item.price) ?? 0), 0);
  const serviceCents = parseMoney(service) ?? 0;
  const taxCents = parseMoney(tax) ?? 0;
  const totalCents = parseMoney(form.amount) ?? 0;
  const receiptMatches = !receipt || subtotalCents + serviceCents + taxCents === totalCents;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const c = getSupabase()!;
      const d = q.data!;
      if (d.r.status !== "approved")
        throw new Error("Restaurant approval is required before bills can be published.");
      const { data: group, error: ge } = await c
        .from("groups")
        .select("id,group_members(user_id)")
        .eq("id", form.group)
        .single();
      if (ge) throw ge;
      const {
        data: { user },
      } = await c.auth.getUser();
      if (!user) throw new Error("Sign in again to publish this bill.");
      // The restaurant account creates the session and is automatically a member.
      // It should not count as a guest share that is treated as already paid.
      const members = (group.group_members ?? [])
        .map((x) => x.user_id)
        .filter((userId: string) => userId !== user.id);
      if (!members.length)
        throw new Error("This session has no guests to share the bill with yet.");
      const totalKes = totalCents / 100;
      if (!Number.isSafeInteger(totalKes) || totalKes <= 0) {
        throw new Error("Enter a whole-shilling bill total for M-Pesa payments.");
      }
      if (receipt && !receiptMatches)
        throw new Error("Receipt items, service, and tax must add up to the bill total. Review the amounts first.");
      if (totalKes < members.length) {
        throw new Error("The bill total must include at least KES 1 for every guest share.");
      }
      const cents = totalCents;
      const baseShareCents = Math.floor(cents / members.length);
      const extraShareCents = cents % members.length;
      const portions = members.map((id: string, i: number) => ({
        user_id: id,
        share_weight: 1,
        amount_due_cents: baseShareCents + (i < extraShareCents ? 1 : 0),
        item_indexes: [],
      }));
      const { error } = await c.rpc("create_restaurant_bill_with_items", {
        _restaurant_id: d.r.id,
        _group_id: form.group,
        _merchant: form.merchant,
        _subtotal_cents: receipt ? subtotalCents : cents,
        _service_cents: receipt ? serviceCents : 0,
        _tax_cents: receipt ? taxCents : 0,
        _total_cents: cents,
        _items: receipt ? items.map((item) => ({
          name: item.name.trim(),
          qty: Math.max(1, Number.parseInt(item.qty, 10) || 1),
          price_cents: parseMoney(item.price) ?? 0,
        })) : [],
        _receipt_url: receiptPath,
        _participants: portions,
      });
      if (error) throw error;
      setMessage("Bill published to the selected Payro group session.");
      setForm({ group: "", merchant: "", amount: "" });
      setReceipt(null);
      setReceiptPreview("");
      setReceiptPath(null);
      setItems([]);
      setService("0");
      setTax("0");
      await client.invalidateQueries({ queryKey: ["restaurant-bills"] });
      await client.invalidateQueries({ queryKey: ["restaurant-dashboard"] });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not publish bill.");
    } finally {
      setBusy(false);
    }
  }
  if (q.isLoading) return <p>Loading restaurant bills…</p>;
  if (q.error) return <p role="alert">{q.error.message}</p>;
  return (
    <RestaurantShell
      access={{
        id: q.data!.r.id,
        name: q.data!.r.name,
        role: q.data!.role,
        status: q.data!.r.status,
      }}
    >
      <h1 className="text-3xl font-semibold">Restaurant bills</h1>
      <p className="mt-2 text-slate-600">
        Upload a receipt for AI item extraction, review the totals, then let guests claim the items they ordered.
      </p>
      <input
        ref={receiptInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => handleReceipt(event.target.files?.[0])}
      />
      <form
        onSubmit={create}
        className="mt-6 grid gap-4 rounded-3xl border border-black/5 bg-white p-5"
      >
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => receiptInput.current?.click()} disabled={scanBusy || busy} className="h-11 rounded-xl border border-emerald-900/15 px-4 text-sm font-semibold text-emerald-900 disabled:opacity-50">
            {scanBusy ? "Reading receipt with AI…" : receipt ? "Replace receipt" : "Upload bill receipt"}
          </button>
          {receiptPreview && <img src={receiptPreview} alt="Uploaded bill receipt" className="h-14 w-14 rounded-lg border object-cover" />}
          {receipt?.notes && <span className="text-xs text-amber-800">AI note: {receipt.notes}</span>}
        </div>
        {scanError && <p role="alert" className="text-sm text-red-700">{scanError}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Bill description
          <input
            required
            value={form.merchant}
            onChange={(e) => setForm({ ...form, merchant: e.target.value })}
            placeholder="Dinner · Table 8"
            className="mt-2 h-11 w-full rounded-xl border px-3"
          />
        </label>
        <label className="text-sm font-semibold">
          Payro group session
          <select
            required
            value={form.group}
            onChange={(e) => setForm({ ...form, group: e.target.value })}
            className="mt-2 h-11 w-full rounded-xl border bg-white px-3"
          >
            <option value="">Choose a group</option>
            {q.data!.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Bill total (KES)
          <input
            required
            min="1"
            step="0.01"
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0"
            className="mt-2 h-11 w-full rounded-xl border px-3"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Whole Kenyan shillings for M-Pesa.</span>
        </label>
        </div>
        {receipt && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h2 className="font-semibold text-slate-900">Review AI-extracted items</h2>
            <p className="mt-1 text-xs text-slate-500">Check each line and adjust item, quantity, service, or tax so they match the receipt.</p>
            <div className="mt-3 hidden grid-cols-[1fr_90px_130px_auto] gap-2 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
              <span>Item</span><span>Qty</span><span>Line total (KES)</span><span></span>
            </div>
            <div className="mt-3 grid gap-2">
              {items.map((item, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_90px_130px_auto]">
                  <input aria-label={`Item ${index + 1} name`} value={item.name} onChange={(event) => setItems((current) => current.map((line, i) => i === index ? { ...line, name: event.target.value } : line))} className="h-10 rounded-lg border bg-white px-3 text-sm" />
                  <input aria-label={`Item ${index + 1} quantity`} type="number" min="1" step="1" value={item.qty} onChange={(event) => setItems((current) => current.map((line, i) => i === index ? { ...line, qty: event.target.value } : line))} className="h-10 rounded-lg border bg-white px-3 text-sm" />
                  <input aria-label={`Item ${index + 1} line total`} type="number" min="0" step="0.01" value={item.price} onChange={(event) => setItems((current) => current.map((line, i) => i === index ? { ...line, price: event.target.value } : line))} className="h-10 rounded-lg border bg-white px-3 text-sm" />
                  <button type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))} className="h-10 rounded-lg px-3 text-xs font-semibold text-red-700">Remove</button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setItems((current) => [...current, { name: "New item", qty: "1", price: "0.00" }])} className="text-xs font-semibold text-emerald-900">+ Add item</button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold">Service charge (KES)
                <input type="number" min="0" step="0.01" value={service} onChange={(event) => setService(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm" />
              </label>
              <label className="text-xs font-semibold">Tax added (KES)
                <input type="number" min="0" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} className="mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span>Items: {formatMoney(subtotalCents)}</span>
              <span>Service + tax: {formatMoney(serviceCents + taxCents)}</span>
              <span className={receiptMatches ? "font-semibold text-emerald-800" : "font-semibold text-amber-800"}>
                {receiptMatches ? "Matches bill total" : `Items and charges total ${formatMoney(subtotalCents + serviceCents + taxCents)} — reconcile before publishing`}
              </span>
            </div>
          </div>
        )}
        <button
          disabled={busy || scanBusy || q.data!.r.status !== "approved" || !receiptMatches}
          className="h-11 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Publishing…" : "Publish bill"}
        </button>
        <p className="text-xs text-slate-500">{receipt ? "Guests can claim items in Payro; unclaimed items are shared evenly until claimed." : "A receipt is optional; without one, the bill is split equally."}</p>
        {message && (
          <p role="status" className="text-sm text-emerald-900">
            {message}
          </p>
        )}
      </form>
      <div className="mt-6 overflow-x-auto rounded-3xl bg-white p-5">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-400">
            <tr>
              <th className="py-3">Bill</th>
              <th>Session</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {q.data!.bills.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="py-4 font-semibold">{b.merchant}</td>
                <td>{(Array.isArray(b.groups) ? b.groups[0] : b.groups)?.name ?? "—"}</td>
                <td>{formatMoney(Number(b.total_cents))}</td>
                <td className="capitalize">{b.status}</td>
                <td>{new Date(b.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!q.data!.bills.length && (
          <p className="py-8 text-center text-sm text-slate-500">No bills yet.</p>
        )}
      </div>
    </RestaurantShell>
  );
}
