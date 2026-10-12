import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Avatar, FieldError } from "@/components/payro/States";
import {
  AlertTriangle,
  Car,
  Home,
  MoreHorizontal,
  ScanLine,
  ShoppingBag,
  Ticket,
  UserPlus,
  Utensils,
  X,
  Zap,
} from "lucide-react";
import { getStoredSession } from "@/lib/auth-store";
import { currentUserId, personName, useCreateExpense, useGroups } from "@/lib/data";
import { takeExpenseDraft, type ExpenseDraft } from "@/lib/expense-draft";
import { formatMoney, parseMoney } from "@/lib/money";
import { requireProfileComplete } from "@/lib/route-guards";
import { customTotal, equalTotal, personTotal, type ItemAllocation } from "@/lib/split-store";

export const Route = createFileRoute("/expense/new")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  validateSearch: (search: Record<string, unknown>): { group?: string } => ({
    group: typeof search.group === "string" ? search.group : undefined,
  }),
  component: NewExpense,
});

const cats = [
  { icon: Utensils, label: "Food" },
  { icon: Car, label: "Travel" },
  { icon: Home, label: "Rent" },
  { icon: ShoppingBag, label: "Shop" },
  { icon: Ticket, label: "Fun" },
  { icon: Zap, label: "Bills" },
  { icon: MoreHorizontal, label: "Other" },
];

type Person = { key: string; userId: string | null; name: string };
type Mode = "equal" | "custom" | "items";

function NewExpense() {
  const me = currentUserId();
  const myName = getStoredSession()?.fullName || "You";
  const search = Route.useSearch();
  const nav = useNavigate();
  const groups = useGroups();
  const create = useCreateExpense();

  const [draft] = useState<ExpenseDraft | null>(() => takeExpenseDraft());
  const items = draft?.items ?? [];
  const hasItems = items.length > 0;

  const [merchant, setMerchant] = useState(draft?.merchant ?? "");
  const [category, setCategory] = useState(hasItems ? "Food" : "Other");
  const [amount, setAmount] = useState("");
  const [service, setService] = useState(draft ? String(draft.service_cents / 100) : "0");
  const [tax, setTax] = useState(draft ? String(draft.tax_cents / 100) : "0");
  const [groupId, setGroupId] = useState<string | null>(search.group ?? null);
  const [mode, setMode] = useState<Mode>(hasItems ? "items" : "equal");
  const [guests, setGuests] = useState<Person[]>([]);
  const [guestName, setGuestName] = useState("");
  const [included, setIncluded] = useState<Set<string>>(new Set([me]));
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [claims, setClaims] = useState<Record<number, string[]>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const currency = draft?.currency ?? "KES";

  const group = groups.data?.find((g) => g.id === groupId) ?? null;

  const people: Person[] = useMemo(() => {
    const members: Person[] = group
      ? group.group_members.map((m) => ({
          key: m.user_id,
          userId: m.user_id,
          name: m.user_id === me ? myName : (personName(m.profiles) ?? "Member"),
        }))
      : [{ key: me, userId: me, name: myName }];
    return [...members, ...guests];
  }, [group, guests, me, myName]);

  // Picking a group includes everyone in it by default.
  useEffect(() => {
    setIncluded(
      new Set([
        ...(group?.group_members.map((m) => m.user_id) ?? [me]),
        ...guests.map((g) => g.key),
      ]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  const active = people.filter((p) => included.has(p.key));
  const activeKeys = active.map((p) => p.key);

  const subtotalCents = hasItems
    ? items.reduce((s, i) => s + i.price_cents, 0)
    : (parseMoney(amount) ?? 0);
  const serviceCents = hasItems ? (parseMoney(service) ?? 0) : 0;
  const taxCents = hasItems ? (parseMoney(tax) ?? 0) : 0;
  const totalCents = subtotalCents + serviceCents + taxCents;

  const unassigned = hasItems
    ? items.map((_, i) => i).filter((i) => !(claims[i] ?? []).some((k) => included.has(k)))
    : [];

  const shares: Record<string, number> = useMemo(() => {
    if (activeKeys.length === 0 || subtotalCents === 0) return {};
    const opts = { serviceCents, taxCents };
    if (mode === "equal") return equalTotal(subtotalCents, activeKeys, opts);
    if (mode === "custom") {
      const w = Object.fromEntries(activeKeys.map((k) => [k, Number(weights[k] ?? "1") || 0]));
      return customTotal(subtotalCents, w, opts);
    }
    const allocations: ItemAllocation[] = [];
    items.forEach((item, index) => {
      const owners = (claims[index] ?? []).filter((k) => included.has(k));
      if (owners.length === 0) return;
      const split = equalTotal(item.price_cents, owners);
      for (const [owner, cents] of Object.entries(split)) {
        allocations.push({
          id: `${index}:${owner}`,
          name: item.name,
          priceCents: cents,
          participantId: owner,
        });
      }
    });
    return personTotal(allocations, activeKeys, opts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, subtotalCents, serviceCents, taxCents, activeKeys.join(","), weights, claims, items]);

  const toggle = (key: string) =>
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleClaim = (index: number, key: string) =>
    setClaims((prev) => {
      const owners = prev[index] ?? [];
      return {
        ...prev,
        [index]: owners.includes(key) ? owners.filter((k) => k !== key) : [...owners, key],
      };
    });

  const addGuest = () => {
    const name = guestName.trim();
    if (!name) return;
    const guest: Person = { key: `guest:${crypto.randomUUID()}`, userId: null, name };
    setGuests((g) => [...g, guest]);
    setIncluded((prev) => new Set(prev).add(guest.key));
    setGuestName("");
  };

  const submit = () => {
    setLocalError(null);
    if (!merchant.trim()) return setLocalError("Give the expense a name");
    if (totalCents <= 0) return setLocalError("Enter an amount");
    if (active.length === 0) return setLocalError("Choose who is splitting");
    if (mode === "items" && unassigned.length > 0)
      return setLocalError("Assign every item to at least one person");
    const sum = Object.values(shares).reduce((a, b) => a + b, 0);
    if (sum !== totalCents) return setLocalError("Shares don't add up to the total");

    create.mutate(
      {
        expense: {
          group_id: groupId,
          merchant: merchant.trim(),
          category,
          currency,
          subtotal_cents: subtotalCents,
          service_cents: serviceCents,
          tax_cents: taxCents,
          total_cents: totalCents,
          split_mode: mode,
          receipt_url: draft?.receiptPath ?? null,
        },
        items: items.map((i) => ({ name: i.name, price_cents: i.price_cents, qty: i.qty })),
        participants: active
          .filter((p) => p.key === me || (shares[p.key] ?? 0) > 0)
          .map((p) => ({
            user_id: p.userId,
            guest_name: p.userId ? null : p.name,
            share_weight: mode === "custom" ? Number(weights[p.key] ?? "1") || 0 : 1,
            amount_due_cents: shares[p.key] ?? 0,
            item_indexes:
              mode === "items"
                ? items.map((_, i) => i).filter((i) => (claims[i] ?? []).includes(p.key))
                : [],
          })),
      },
      { onSuccess: (id) => nav({ to: "/expense/$id", params: { id } }) },
    );
  };

  return (
    <MobileFrame showNav={false}>
      <TopBar back={groupId ? `/groups/${groupId}` : "/home"} title="New expense" />

      <div className="px-6 pb-6">
        {hasItems ? (
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Total from receipt
            </p>
            <p className="mt-1 text-4xl font-bold text-navy tracking-tight">
              {formatMoney(totalCents, currency)}
            </p>
            {draft?.mismatch && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 rounded-full px-3 py-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Receipt printed {formatMoney(draft.printed_total_cents, currency)} — check items
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold text-center">
              Amount
            </p>
            <div className="mt-2 flex items-baseline justify-center gap-1">
              <span className="text-muted-foreground text-lg font-semibold">{currency}</span>
              <input
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                placeholder="0"
                className="w-44 text-center text-5xl font-bold text-navy bg-transparent outline-none tracking-tight"
              />
            </div>
          </>
        )}

        <div className="mt-6 space-y-3">
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              What was it for?
            </p>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g. Dinner at Talisman"
              className="mt-1 w-full bg-transparent outline-none text-[15px] font-semibold text-navy"
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2 px-1">
              Category
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {cats.map((c) => {
                const on = category === c.label;
                return (
                  <button
                    key={c.label}
                    onClick={() => setCategory(c.label)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl border transition ${on ? "border-primary bg-accent" : "border-border bg-white"}`}
                  >
                    <c.icon
                      className={`h-5 w-5 ${on ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span
                      className={`text-[9px] font-semibold ${on ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Group
            </p>
            <select
              value={groupId ?? ""}
              onChange={(e) => setGroupId(e.target.value || null)}
              className="mt-1 w-full bg-transparent outline-none text-[15px] font-semibold text-navy"
            >
              <option value="">No group (just me + guests)</option>
              {groups.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.emoji} {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">
              Split between · {active.length}
            </p>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => {
                const on = included.has(p.key);
                return (
                  <button
                    key={p.key}
                    onClick={() => toggle(p.key)}
                    className={`flex items-center gap-2 pl-1 pr-3 h-9 rounded-full border text-xs font-semibold ${on ? "border-primary bg-accent text-navy" : "border-border bg-white text-muted-foreground"}`}
                  >
                    <Avatar name={p.name} seed={p.key} className="h-7 w-7 text-[10px]" />
                    {p.key === me ? "You" : p.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGuest()}
                placeholder="Add someone not on Payro"
                className="flex-1 h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={addGuest}
                className="h-10 w-10 rounded-xl border border-border bg-white flex items-center justify-center text-primary"
                aria-label="Add guest"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2 px-1">
              Split method
            </p>
            <div className={`grid gap-2 ${hasItems ? "grid-cols-3" : "grid-cols-2"}`}>
              {(
                [
                  ...(hasItems ? [["items", "By item"]] : []),
                  ["equal", "Equal"],
                  ["custom", "Shares"],
                ] as [Mode, string][]
              ).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setMode(v)}
                  className={`h-11 rounded-xl border text-sm font-semibold transition ${mode === v ? "border-primary bg-accent text-primary" : "border-border text-navy"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {mode === "items" && (
            <div className="rounded-2xl border border-border bg-white divide-y divide-border">
              {items.map((item, index) => (
                <div key={index} className="p-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-navy">
                      {item.qty > 1 ? `${item.qty}× ` : ""}
                      {item.name}
                    </span>
                    <span className="font-semibold text-navy">
                      {formatMoney(item.price_cents, currency)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {active.map((p) => {
                      const on = (claims[index] ?? []).includes(p.key);
                      return (
                        <button
                          key={p.key}
                          onClick={() => toggleClaim(index, p.key)}
                          className={`h-7 px-2.5 rounded-full text-[11px] font-semibold border ${on ? "border-primary bg-primary text-white" : "border-border text-muted-foreground"}`}
                        >
                          {p.key === me ? "Me" : p.name.split(" ")[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="p-3 grid grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground">
                  Service charge
                  <input
                    value={service}
                    onChange={(e) => setService(e.target.value.replace(/[^\d.]/g, ""))}
                    inputMode="decimal"
                    className="mt-1 w-full h-9 rounded-lg border border-border px-2 text-sm text-navy font-semibold outline-none"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Tax added
                  <input
                    value={tax}
                    onChange={(e) => setTax(e.target.value.replace(/[^\d.]/g, ""))}
                    inputMode="decimal"
                    className="mt-1 w-full h-9 rounded-lg border border-border px-2 text-sm text-navy font-semibold outline-none"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Per-person preview */}
          {active.length > 0 && totalCents > 0 && (
            <div className="rounded-2xl bg-surface p-3 space-y-2">
              {active.map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <Avatar name={p.name} seed={p.key} className="h-7 w-7 text-[10px]" />
                  <span className="flex-1 text-sm font-medium text-navy">
                    {p.key === me ? "You" : p.name}
                  </span>
                  {mode === "custom" && (
                    <input
                      value={weights[p.key] ?? "1"}
                      onChange={(e) =>
                        setWeights((w) => ({
                          ...w,
                          [p.key]: e.target.value.replace(/[^\d.]/g, ""),
                        }))
                      }
                      inputMode="decimal"
                      aria-label="Shares"
                      className="w-14 h-8 rounded-lg border border-border bg-white text-center text-sm font-semibold outline-none"
                    />
                  )}
                  <span className="w-28 text-right text-sm font-bold text-navy">
                    {formatMoney(shares[p.key] ?? 0, currency)}
                  </span>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground pt-1">
                You paid the bill — others will owe you their share.
              </p>
            </div>
          )}

          {!hasItems && (
            <Link
              to="/scan"
              className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border p-4 hover:border-primary transition"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ScanLine className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-navy">Scan receipt with AI</p>
                <p className="text-xs text-muted-foreground">
                  Read items and split by who had what
                </p>
              </div>
              <span className="text-primary text-lg">›</span>
            </Link>
          )}
          {draft && (
            <button
              onClick={() => nav({ to: "/scan" })}
              className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" /> Discard scan and start over
            </button>
          )}
        </div>

        <FieldError error={localError ?? create.error} />
        <button
          onClick={submit}
          disabled={create.isPending}
          className="mt-6 w-full h-14 rounded-2xl payro-gradient text-white font-semibold shadow-glow active:scale-[0.99] transition disabled:opacity-60"
        >
          {create.isPending ? "Saving…" : `Add expense · ${formatMoney(totalCents, currency)}`}
        </button>
      </div>
    </MobileFrame>
  );
}
