import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Avatar, EmptyState, ErrorNote, FieldError, Loading } from "@/components/payro/States";
import { Check, Receipt, UserPlus } from "lucide-react";
import {
  balancesByPerson,
  currentUserId,
  personName,
  summarizeBalances,
  useAddMember,
  useExpenses,
  useGroup,
} from "@/lib/data";
import { formatMoney, relativeDay } from "@/lib/money";
import { requireProfileComplete } from "@/lib/route-guards";

export const Route = createFileRoute("/groups/$id")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  component: GroupDetail,
});

function GroupDetail() {
  const { id } = Route.useParams();
  const me = currentUserId();
  const group = useGroup(id);
  const expenses = useExpenses();
  const [adding, setAdding] = useState(false);

  if (group.isLoading) {
    return (
      <MobileFrame>
        <TopBar back="/groups" title="Group" />
        <Loading />
      </MobileFrame>
    );
  }
  if (group.error || !group.data) {
    return (
      <MobileFrame>
        <TopBar back="/groups" title="Group" />
        <div className="px-5">
          <ErrorNote error={group.error ?? new Error("Group not found")} />
        </div>
      </MobileFrame>
    );
  }

  const g = group.data;
  const isAdmin = g.group_members.some((m) => m.user_id === me && m.role === "admin");
  const groupExpenses = (expenses.data ?? []).filter((e) => e.group_id === id);
  const { net } = summarizeBalances(groupExpenses, me);
  const people = balancesByPerson(groupExpenses, me);
  const totalDue = groupExpenses.reduce(
    (s, e) => s + e.expense_participants.reduce((a, p) => a + p.amount_due_cents, 0),
    0,
  );
  const totalPaid = groupExpenses.reduce(
    (s, e) => s + e.expense_participants.reduce((a, p) => a + p.amount_paid_cents, 0),
    0,
  );
  const progress = totalDue === 0 ? 100 : Math.round((totalPaid / totalDue) * 100);

  return (
    <MobileFrame>
      <TopBar
        back="/groups"
        title={`${g.emoji} ${g.name}`}
        subtitle={`${g.group_members.length} member${g.group_members.length === 1 ? "" : "s"}`}
      />

      <div className="px-5 pb-4">
        <div className="rounded-3xl payro-gradient-dark p-5 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/40 blur-3xl" />
          <p className="text-white/60 text-xs uppercase tracking-wider">Your balance</p>
          <p className="mt-1 text-white text-3xl font-bold">
            {net === 0 ? "Settled" : `${net > 0 ? "+" : "-"} ${formatMoney(Math.abs(net))}`}
          </p>
          <p className="text-white/70 text-sm mt-0.5">
            {net > 0 ? "owed to you" : net < 0 ? "you owe" : "Nothing outstanding"}
          </p>

          <div className="mt-5">
            <div className="flex items-center justify-between text-white/80 text-xs mb-1.5">
              <span>Settlement progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Link
              to="/pay"
              className="flex-1 h-11 rounded-xl bg-white text-navy font-semibold text-sm flex items-center justify-center"
            >
              Settle up
            </Link>
            <Link
              to="/expense/new"
              search={{ group: id }}
              className="flex-1 h-11 rounded-xl bg-white/10 text-white font-semibold text-sm flex items-center justify-center border border-white/20"
            >
              Add expense
            </Link>
          </div>
        </div>

        {/* Members */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Members
            </p>
            {isAdmin && (
              <button
                onClick={() => setAdding((v) => !v)}
                className="text-xs text-primary font-semibold flex items-center gap-1"
              >
                <UserPlus className="h-3.5 w-3.5" /> Add
              </button>
            )}
          </div>
          {adding && <AddMember groupId={id} onDone={() => setAdding(false)} />}
          <div className="space-y-2">
            {g.group_members.map((m) => {
              const name = m.user_id === me ? "You" : (personName(m.profiles) ?? "Member");
              const bal = people.find((p) => p.key === m.user_id)?.net ?? 0;
              return (
                <div
                  key={m.user_id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-2xl bg-surface"
                >
                  <Avatar name={name} seed={m.user_id} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-navy">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.role === "admin" ? "Admin" : "Member"}
                      {m.user_id !== me &&
                        (bal > 0 ? " · owes you" : bal < 0 ? " · you owe" : " · settled")}
                    </p>
                  </div>
                  {m.user_id !== me && bal !== 0 && (
                    <span
                      className={`text-sm font-bold ${bal > 0 ? "text-success" : "text-destructive"}`}
                    >
                      {bal > 0 ? "+" : "-"}
                      {formatMoney(Math.abs(bal))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Expenses
          </p>
          {groupExpenses.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="No expenses in this group"
              body="Add one manually or scan a receipt."
            />
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
              {groupExpenses.map((e) => {
                const settled = e.status === "settled";
                const payer = e.creator_id === me ? "You" : (personName(e.creator) ?? "Someone");
                return (
                  <Link
                    key={e.id}
                    to="/expense/$id"
                    params={{ id: e.id }}
                    className="relative pb-4 block"
                  >
                    <div
                      className={`absolute -left-6 top-1 h-4 w-4 rounded-full ring-4 ring-background ${settled ? "bg-success" : "bg-primary"}`}
                    >
                      {settled && <Check className="h-3 w-3 text-white m-0.5" strokeWidth={3} />}
                    </div>
                    <div className="rounded-2xl bg-white border border-border p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-semibold text-navy">{e.merchant}</p>
                          <p className="text-xs text-muted-foreground">
                            {payer} paid · {formatMoney(e.total_cents, e.currency)}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {relativeDay(e.created_at)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-primary font-medium">
                        {settled
                          ? "Settled"
                          : `Split ${e.expense_participants.length} ways · ${e.split_mode === "items" ? "by item" : e.split_mode}`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MobileFrame>
  );
}

function AddMember({ groupId, onDone }: { groupId: string; onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const add = useAddMember();
  const submit = () =>
    add.mutate(
      { groupId, phone },
      {
        onSuccess: () => {
          setPhone("");
          onDone();
        },
      },
    );
  return (
    <div className="mb-3 rounded-2xl border border-primary/30 bg-white p-3">
      <p className="text-xs text-muted-foreground">
        Enter the phone number they signed up to Payro with.
      </p>
      <div className="mt-2 flex gap-2">
        <div className="flex-1 flex items-center rounded-xl border border-border bg-surface h-11 px-3 gap-2">
          <span className="text-sm font-semibold text-muted-foreground">+254</span>
          <input
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            inputMode="tel"
            placeholder="712 345 678"
            className="flex-1 bg-transparent outline-none text-sm font-medium"
          />
        </div>
        <button
          onClick={submit}
          disabled={!phone.trim() || add.isPending}
          className="h-11 px-4 rounded-xl payro-gradient text-white text-sm font-semibold disabled:opacity-60"
        >
          {add.isPending ? "…" : "Add"}
        </button>
      </div>
      <FieldError error={add.error} />
    </div>
  );
}
