import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Bell, Users, Zap, ScanLine, Check } from "lucide-react";

export const Route = createFileRoute("/notifications")({ component: Notifications });

const groups = [
  {
    label: "Today",
    items: [
      {
        icon: Zap,
        tint: "bg-emerald-100 text-primary",
        title: "Kevin paid you KES 1,850",
        meta: "M-Pesa · 12:04",
        unread: true,
      },
      {
        icon: Users,
        tint: "bg-sky-100 text-sky-700",
        title: "Sarah added an expense to Nairobi Flat",
        meta: "Uber home · KES 900",
        unread: true,
      },
      {
        icon: Check,
        tint: "bg-emerald-100 text-primary",
        title: "Your withdrawal was successful",
        meta: "KES 10,000 to Equity Bank",
      },
    ],
  },
  {
    label: "Yesterday",
    items: [
      {
        icon: ScanLine,
        tint: "bg-violet-100 text-violet-700",
        title: "AI split completed for Java House",
        meta: "4 members · KES 1,010 each",
      },
      {
        icon: Bell,
        tint: "bg-amber-100 text-amber-700",
        title: "Reminder: settle up with James",
        meta: "You owe KES 200",
      },
    ],
  },
  {
    label: "Earlier",
    items: [
      {
        icon: Users,
        tint: "bg-rose-100 text-rose-700",
        title: "You were added to Lunch Crew",
        meta: "8 members",
      },
      {
        icon: Zap,
        tint: "bg-emerald-100 text-primary",
        title: "Payro Wallet is live in Kenya 🎉",
        meta: "Explore deposits & withdrawals",
      },
    ],
  },
];

function Notifications() {
  return (
    <MobileFrame>
      <TopBar
        back="/home"
        title="Notifications"
        right={<button className="text-xs text-primary font-semibold">Mark all read</button>}
      />
      <div className="px-5">
        {groups.map((g) => (
          <div key={g.label} className="mb-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">
              {g.label}
            </p>
            <div className="rounded-2xl bg-white border border-border divide-y divide-border">
              {g.items.map((n, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3.5 ${n.unread ? "bg-accent/40" : ""}`}
                >
                  <div
                    className={`h-10 w-10 rounded-xl ${n.tint} flex items-center justify-center shrink-0`}
                  >
                    <n.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy leading-snug">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.meta}</p>
                  </div>
                  {n.unread && <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MobileFrame>
  );
}
