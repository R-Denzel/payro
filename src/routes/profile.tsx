import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import {
  ChevronRight,
  Shield,
  CreditCard,
  Bell,
  HelpCircle,
  Globe,
  LogOut,
  Settings,
} from "lucide-react";

export const Route = createFileRoute("/profile")({ component: Profile });

function Profile() {
  type Item = { icon: typeof Shield; label: string; to: string; meta?: string; danger?: boolean };
  const items: Item[][] = [
    [
      { icon: Shield, label: "Security & PIN", to: "/profile" },
      { icon: CreditCard, label: "Payment methods", to: "/wallet" },
      { icon: Bell, label: "Notifications", to: "/notifications" },
    ],
    [
      { icon: Globe, label: "Country & Currency", meta: "Kenya · KES", to: "/profile" },
      { icon: Settings, label: "Preferences", to: "/profile" },
    ],
    [
      { icon: HelpCircle, label: "Help & Support", to: "/profile" },
      { icon: LogOut, label: "Sign out", to: "/auth", danger: true },
    ],
  ];

  return (
    <MobileFrame>
      <TopBar title="Profile" />

      <div className="px-5">
        <div className="rounded-3xl payro-gradient-dark p-5 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-primary/40 blur-3xl" />
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 ring-4 ring-white/10 flex items-center justify-center text-white text-xl font-bold">
              AK
            </div>
            <div className="flex-1">
              <p className="text-white text-lg font-bold">Amara Kimani</p>
              <p className="text-white/70 text-xs">+254 712 345 678</p>
              <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-300 text-[10px] font-semibold">VERIFIED</span>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-white text-lg font-bold">142</p>
              <p className="text-white/60 text-[10px] uppercase">Transactions</p>
            </div>
            <div>
              <p className="text-white text-lg font-bold">8</p>
              <p className="text-white/60 text-[10px] uppercase">Groups</p>
            </div>
            <div>
              <p className="text-white text-lg font-bold">4.9★</p>
              <p className="text-white/60 text-[10px] uppercase">Rating</p>
            </div>
          </div>
        </div>

        {items.map((section, si) => (
          <div
            key={si}
            className="mt-4 rounded-2xl bg-white border border-border divide-y divide-border overflow-hidden"
          >
            {section.map((it, i) => (
              <Link to={it.to} key={i} className="flex items-center gap-3 p-4 active:bg-surface">
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center ${it.danger ? "bg-red-50 text-destructive" : "bg-surface text-navy"}`}
                >
                  <it.icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm font-semibold ${it.danger ? "text-destructive" : "text-navy"}`}
                  >
                    {it.label}
                  </p>
                  {it.meta && <p className="text-xs text-muted-foreground">{it.meta}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        ))}

        <p className="mt-6 mb-2 text-center text-xs text-muted-foreground">
          Payro v1.0 · Made with 💚 for Africa
        </p>
      </div>
    </MobileFrame>
  );
}
