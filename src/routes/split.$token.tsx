import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Check } from "lucide-react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { ErrorNote, FieldError, Loading } from "@/components/payro/States";
import {
  claimExpenseSplitInviteItem,
  fetchExpenseSplitInvite,
  joinExpenseSplitInvite,
} from "@/lib/data";
import { formatMoney } from "@/lib/money";

export const Route = createFileRoute("/split/$token")({
  ssr: false,
  component: ExpenseSplitGuest,
});

function ExpenseSplitGuest() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const storageKey = `payro:expense-split:${token}`;
  const [guestName, setGuestName] = useState("");
  const [guestAccessToken, setGuestAccessToken] = useState<string | null>(null);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [storageError, setStorageError] = useState<Error | null>(null);
  const invite = useQuery({
    queryKey: ["expense-split-invite", token, guestAccessToken],
    enabled: accessLoaded,
    queryFn: () => fetchExpenseSplitInvite(token, guestAccessToken),
  });
  const join = useMutation({
    mutationFn: async (name: string) => {
      const access = createGuestAccessToken();
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ name, access }));
      } catch {
        throw new Error(
          "Your browser could not save this guest session. Enable local storage and try again.",
        );
      }

      await joinExpenseSplitInvite(token, name, access);
      return { name, access };
    },
    onSuccess: async ({ name, access }) => {
      setGuestName(name);
      setGuestAccessToken(access);
      await queryClient.invalidateQueries({ queryKey: ["expense-split-invite", token] });
    },
  });
  const claim = useMutation({
    mutationFn: (input: { itemId: string; selected: boolean }) => {
      if (!guestAccessToken) throw new Error("Join this split before selecting items.");
      return claimExpenseSplitInviteItem(token, guestAccessToken, input.itemId, input.selected);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expense-split-invite", token] }),
  });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed: unknown = JSON.parse(saved);
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "name" in parsed &&
            typeof parsed.name === "string" &&
            "access" in parsed &&
            typeof parsed.access === "string"
          ) {
            setGuestName(parsed.name);
            setGuestAccessToken(parsed.access);
          } else {
            window.localStorage.removeItem(storageKey);
          }
        } catch {
          window.localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      setStorageError(
        error instanceof Error ? error : new Error("Could not read the saved guest session."),
      );
    } finally {
      setAccessLoaded(true);
    }
  }, [storageKey]);

  function submitJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    join.mutate(guestName.trim());
  }

  const data = invite.data;
  if (!accessLoaded || invite.isLoading)
    return (
      <Shell>
        <Loading label="Loading split…" />
      </Shell>
    );
  if (storageError)
    return (
      <Shell>
        <ErrorNote error={storageError} />
      </Shell>
    );
  if (invite.error)
    return (
      <Shell>
        <ErrorNote error={invite.error} onRetry={() => void invite.refetch()} />
      </Shell>
    );
  if (!data)
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold text-navy">This split invite is unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have expired, been replaced, or the expense may already be settled. Ask the
            person who shared it for a new QR code.
          </p>
        </div>
      </Shell>
    );

  const isJoined = Boolean(data.participant_name && guestAccessToken);

  return (
    <Shell>
      <div className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Payro · Shared bill
        </p>
        <h1 className="mt-2 text-2xl font-bold text-navy">{data.merchant}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bill total:{" "}
          <span className="font-semibold text-navy">
            {formatMoney(data.total_cents, data.currency)}
          </span>
        </p>
      </div>

      {!isJoined ? (
        <form onSubmit={submitJoin} className="mt-6 rounded-2xl border border-border bg-white p-4">
          <h2 className="text-sm font-bold text-navy">Join to choose your items</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            No Payro account is needed. Enter your name so the bill owner can identify your share.
          </p>
          <label htmlFor="guest-name" className="mt-4 block text-xs font-semibold text-navy">
            Your name
          </label>
          <input
            id="guest-name"
            autoComplete="name"
            value={guestName}
            onChange={(event) => setGuestName(event.target.value)}
            minLength={2}
            maxLength={60}
            required
            className="mt-1 h-11 w-full rounded-xl border border-border px-3 text-sm outline-none focus:border-primary"
            placeholder="e.g. Alex"
          />
          <FieldError error={join.error} />
          <button
            type="submit"
            disabled={join.isPending || guestName.trim().length < 2}
            className="mt-3 h-11 w-full rounded-xl payro-gradient text-sm font-semibold text-white disabled:opacity-60"
          >
            {join.isPending ? "Joining…" : "Join this split"}
          </button>
        </form>
      ) : (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">You joined as {data.participant_name}</p>
          <p className="mt-0.5">
            Your current share:{" "}
            <span className="font-bold">
              {formatMoney(data.amount_due_cents ?? 0, data.currency)}
            </span>
          </p>
        </div>
      )}

      <h2 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Items — select what you had
      </h2>
      <div className="rounded-2xl border border-border bg-white divide-y divide-border">
        {data.items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy">
                {item.qty > 1 ? `${item.qty}× ` : ""}
                {item.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatMoney(item.price_cents, data.currency)}
                {item.claim_count > 0 &&
                  ` · selected by ${item.claim_count} ${item.claim_count === 1 ? "person" : "people"}`}
              </p>
            </div>
            {isJoined && (
              <button
                type="button"
                aria-pressed={item.claimed_by_me}
                onClick={() => claim.mutate({ itemId: item.id, selected: !item.claimed_by_me })}
                disabled={claim.isPending}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                  item.claimed_by_me ? "bg-emerald-100 text-emerald-900" : "bg-surface text-navy"
                }`}
              >
                {item.claimed_by_me ? (
                  <span className="inline-flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Selected
                  </span>
                ) : (
                  "Select"
                )}
              </button>
            )}
          </div>
        ))}
      </div>
      <FieldError error={claim.error} />
      <p className="mt-3 pb-6 text-center text-xs text-muted-foreground">
        Your share updates as you select items. Service charges and tax are shared between people on
        the bill.
      </p>
    </Shell>
  );
}

function createGuestAccessToken(): string {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <MobileFrame showNav={false}>
      <TopBar back="/" title="Join split" />
      <div className="flex min-h-full flex-col px-5">{children}</div>
    </MobileFrame>
  );
}
