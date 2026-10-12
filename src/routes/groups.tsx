import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Avatar, EmptyState, ErrorNote, FieldError, Loading } from "@/components/payro/States";
import { Plus, Users, X } from "lucide-react";
import {
  balancesByPerson,
  currentUserId,
  personName,
  summarizeBalances,
  useCreateGroup,
  useExpenses,
  useGroups,
} from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { requireProfileComplete } from "@/lib/route-guards";

export const Route = createFileRoute("/groups")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  component: Groups,
});

const EMOJIS = ["👥", "🏡", "🚗", "🍔", "❤️", "💪", "✈️", "🎉", "💼", "⚽"];

function Groups() {
  const me = currentUserId();
  const groups = useGroups();
  const expenses = useExpenses();
  const [creating, setCreating] = useState(false);
  const totals = summarizeBalances(expenses.data ?? [], me);

  return (
    <MobileFrame>
      <TopBar
        title="Groups"
        subtitle={groups.data ? `${groups.data.length} groups` : undefined}
        right={
          <button
            onClick={() => setCreating(true)}
            className="h-10 px-3 rounded-full bg-surface border border-black/5 flex items-center gap-1 text-sm font-semibold text-primary"
          >
            <Plus className="h-4 w-4" /> New
          </button>
        }
      />

      <div className="px-5 pb-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl border border-border p-3 bg-emerald-50/50">
            <p className="text-xs text-muted-foreground">Total owed to you</p>
            <p className="mt-1 text-lg font-bold text-success">{formatMoney(totals.owedToMe)}</p>
          </div>
          <div className="rounded-2xl border border-border p-3 bg-amber-50/50">
            <p className="text-xs text-muted-foreground">Total you owe</p>
            <p className="mt-1 text-lg font-bold text-navy">{formatMoney(totals.iOwe)}</p>
          </div>
        </div>

        {creating && <CreateGroup onClose={() => setCreating(false)} />}

        {groups.isLoading ? (
          <Loading />
        ) : groups.error ? (
          <ErrorNote error={groups.error} onRetry={() => groups.refetch()} />
        ) : groups.data!.length === 0 && !creating ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No groups yet"
            body="Create a group for your flatmates, trips or regular lunch crew."
            action={
              <button
                onClick={() => setCreating(true)}
                className="h-11 px-5 rounded-xl payro-gradient text-white text-sm font-semibold"
              >
                Create a group
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {groups.data!.map((g) => {
              const groupExpenses = (expenses.data ?? []).filter((e) => e.group_id === g.id);
              const { net } = summarizeBalances(groupExpenses, me);
              const last = groupExpenses[0];
              return (
                <Link
                  to="/groups/$id"
                  params={{ id: g.id }}
                  key={g.id}
                  className="block rounded-2xl border border-black/5 p-4 bg-gradient-to-br from-emerald-50 to-white active:scale-[0.99] transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-white shadow-soft flex items-center justify-center text-2xl">
                      {g.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy">{g.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {g.group_members.length} member{g.group_members.length === 1 ? "" : "s"}
                        {last ? ` · ${last.merchant}` : " · No expenses yet"}
                      </p>
                    </div>
                    <div className="text-right">
                      {net === 0 ? (
                        <span className="text-xs font-semibold text-muted-foreground">Settled</span>
                      ) : (
                        <>
                          <p
                            className={`text-sm font-bold ${net > 0 ? "text-success" : "text-destructive"}`}
                          >
                            {net > 0 ? "+" : "-"}
                            {formatMoney(Math.abs(net))}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {net > 0 ? "owed to you" : "you owe"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex -space-x-2">
                    {g.group_members.slice(0, 5).map((m) => (
                      <Avatar
                        key={m.user_id}
                        name={personName(m.profiles) ?? "?"}
                        seed={m.user_id}
                        className="h-6 w-6 text-[10px] ring-2 ring-white"
                      />
                    ))}
                    {g.group_members.length > 5 && (
                      <div className="h-6 w-6 rounded-full ring-2 ring-white bg-white text-navy text-[10px] font-bold flex items-center justify-center">
                        +{g.group_members.length - 5}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
            {/* People you have open balances with outside groups */}
            <PeopleOutsideGroups />
          </div>
        )}
      </div>
    </MobileFrame>
  );
}

function PeopleOutsideGroups() {
  const me = currentUserId();
  const expenses = useExpenses();
  const rows = balancesByPerson(
    (expenses.data ?? []).filter((e) => !e.group_id),
    me,
  ).filter((r) => r.net !== 0);
  if (rows.length === 0) return null;
  return (
    <div className="pt-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Outside groups
      </p>
      <div className="rounded-2xl bg-white border border-border divide-y divide-border">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3 p-3">
            <Avatar name={r.name} seed={r.key} className="h-9 w-9 text-xs" />
            <p className="flex-1 text-sm font-semibold text-navy">{r.name}</p>
            <span
              className={`text-sm font-bold ${r.net > 0 ? "text-success" : "text-destructive"}`}
            >
              {r.net > 0 ? "+" : "-"}
              {formatMoney(Math.abs(r.net))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateGroup({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const create = useCreateGroup();
  const nav = useNavigate();

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      { name, emoji },
      { onSuccess: (g) => nav({ to: "/groups/$id", params: { id: g.id } }) },
    );
  };

  return (
    <div className="mb-4 rounded-2xl border border-primary/30 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-navy">New group</p>
        <button onClick={onClose} aria-label="Close">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        maxLength={80}
        placeholder="e.g. Nairobi Flat"
        className="mt-3 w-full h-12 rounded-xl border border-border bg-surface px-3 text-sm font-medium outline-none focus:border-primary"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => setEmoji(e)}
            className={`h-9 w-9 rounded-xl text-lg border ${emoji === e ? "border-primary bg-accent" : "border-border"}`}
          >
            {e}
          </button>
        ))}
      </div>
      <FieldError error={create.error} />
      <button
        onClick={submit}
        disabled={!name.trim() || create.isPending}
        className="mt-4 w-full h-11 rounded-xl payro-gradient text-white text-sm font-semibold disabled:opacity-60"
      >
        {create.isPending ? "Creating…" : "Create group"}
      </button>
    </div>
  );
}
