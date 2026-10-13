import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { EmptyState, ErrorNote, Loading } from "@/components/payro/States";
import { Bell, Check, Users, Zap, Receipt, HandCoins } from "lucide-react";
import { useMarkAllNotificationsRead, useNotifications, type Notification } from "@/lib/data";
import { relativeDay, timeOfDay } from "@/lib/money";
import { requireProfileComplete } from "@/lib/route-guards";

export const Route = createFileRoute("/notifications")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  component: Notifications,
});

const STYLE: Record<string, { icon: typeof Bell; tint: string }> = {
  group_added: { icon: Users, tint: "bg-sky-100 text-sky-700" },
  expense_added: { icon: Receipt, tint: "bg-violet-100 text-violet-700" },
  payment_received: { icon: Zap, tint: "bg-emerald-100 text-primary" },
  payment_confirmed: { icon: Check, tint: "bg-emerald-100 text-primary" },
  payment_reported: { icon: HandCoins, tint: "bg-emerald-100 text-primary" },
};

function NotificationRow({ n }: { n: Notification }) {
  const style = STYLE[n.kind] ?? { icon: Bell, tint: "bg-amber-100 text-amber-700" };
  const body = (
    <div className={`flex items-start gap-3 p-3.5 ${n.read_at ? "" : "bg-accent/40"}`}>
      <div
        className={`h-10 w-10 rounded-xl ${style.tint} flex items-center justify-center shrink-0`}
      >
        <style.icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-navy leading-snug">{n.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {n.body ? `${n.body} · ` : ""}
          {timeOfDay(n.created_at)}
        </p>
      </div>
      {!n.read_at && <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />}
    </div>
  );
  if (n.data.expense_id)
    return (
      <Link to="/expense/$id" params={{ id: n.data.expense_id }} className="block">
        {body}
      </Link>
    );
  if (n.data.group_id)
    return (
      <Link to="/groups/$id" params={{ id: n.data.group_id }} className="block">
        {body}
      </Link>
    );
  return body;
}

function Notifications() {
  const notifications = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const list = notifications.data ?? [];
  const days = new Map<string, Notification[]>();
  for (const n of list) {
    const label = relativeDay(n.created_at);
    days.set(label, [...(days.get(label) ?? []), n]);
  }

  return (
    <MobileFrame>
      <TopBar
        back="/home"
        title="Notifications"
        right={
          list.some((n) => !n.read_at) ? (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="text-xs text-primary font-semibold"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />
      <div className="px-5 pb-4">
        {notifications.isLoading ? (
          <Loading />
        ) : notifications.error ? (
          <ErrorNote error={notifications.error} onRetry={() => notifications.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-6 w-6" />}
            title="No notifications"
            body="You'll hear here when someone splits a bill with you or pays you back."
          />
        ) : (
          [...days.entries()].map(([label, items]) => (
            <div key={label} className="mb-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">
                {label}
              </p>
              <div className="rounded-2xl bg-white border border-border divide-y divide-border overflow-hidden">
                {items.map((n) => (
                  <NotificationRow key={n.id} n={n} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </MobileFrame>
  );
}
