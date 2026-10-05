import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { MobileFrame } from "@/components/payro/Frame";
import {
  Bell,
  Send,
  Download,
  ScanLine,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Wallet as WalletIcon,
} from "lucide-react";
import { getStoredSession } from "@/lib/auth-store";

export const Route = createFileRoute("/home")({
  beforeLoad: () => {
    if (!getStoredSession()) {
      throw redirect({ to: "/auth" });
    }
  },
  component: Home,
});

function Home() {
  return (
    <MobileFrame>
      {/* Header */}
      <div className="px-5 pt-2 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold">
            AK
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Good morning</p>
            <p className="text-sm font-semibold text-navy">Amara Kimani</p>
          </div>
        </div>
        <Link
          to="/notifications"
          className="relative h-11 w-11 rounded-full bg-surface flex items-center justify-center border border-black/5"
        >
          <Bell className="h-5 w-5 text-navy" />
          <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
        </Link>
      </div>

      {/* Wallet card */}
      <div className="px-5">
        <Link
          to="/wallet"
          className="block relative rounded-3xl payro-gradient-dark p-5 overflow-hidden"
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/40 blur-3xl" />
          <div className="absolute right-6 top-6 opacity-40">
            <WalletIcon className="h-6 w-6 text-white" />
          </div>
          <p className="text-white/60 text-xs font-medium tracking-wider uppercase">
            Wallet balance
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-white text-3xl font-bold tracking-tight">KES 48,320</span>
            <span className="text-white/60 text-sm font-medium">.50</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
              <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-medium">
                <ArrowDownLeft className="h-3.5 w-3.5" />
                Owed to you
              </div>
              <p className="mt-1 text-white text-lg font-bold">KES 12,450</p>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur p-3">
              <div className="flex items-center gap-1.5 text-amber-300 text-xs font-medium">
                <ArrowUpRight className="h-3.5 w-3.5" />
                You owe
              </div>
              <p className="mt-1 text-white text-lg font-bold">KES 3,200</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="px-5 mt-6 grid grid-cols-4 gap-3">
        {[
          { icon: Send, label: "Send", to: "/pay" },
          { icon: Download, label: "Request", to: "/expense/new" },
          { icon: ScanLine, label: "Scan", to: "/scan" },
          { icon: QrCode, label: "QR Pay", to: "/qr" },
        ].map((a) => (
          <Link key={a.label} to={a.to} className="flex flex-col items-center gap-2 group">
            <div className="h-14 w-14 rounded-2xl bg-surface border border-black/5 flex items-center justify-center group-active:scale-95 transition">
              <a.icon className="h-6 w-6 text-primary" strokeWidth={2} />
            </div>
            <span className="text-[11px] font-medium text-navy">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Insight card */}
      <div className="px-5 mt-6">
        <Link
          to="/analytics"
          className="flex items-center gap-3 rounded-2xl border border-border p-4 bg-gradient-to-br from-emerald-50 to-white"
        >
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-navy">You saved 18% this month</p>
            <p className="text-xs text-muted-foreground">Groceries down vs. last month</p>
          </div>
          <span className="text-primary text-sm font-semibold">See →</span>
        </Link>
      </div>

      {/* Recent activity */}
      <div className="px-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-navy">Recent activity</h2>
          <Link to="/activity" className="text-xs text-primary font-semibold">
            See all
          </Link>
        </div>
        <div className="space-y-2">
          {[
            {
              name: "Nairobi Coffee Trip",
              who: "Split with 4",
              amt: "-KES 640",
              tag: "Food",
              color: "bg-amber-100 text-amber-700",
            },
            {
              name: "Kevin paid you back",
              who: "M-Pesa · 12:04",
              amt: "+KES 1,200",
              tag: "Received",
              color: "bg-emerald-100 text-emerald-700",
            },
            {
              name: "Uber to airport",
              who: "You paid · Split 3",
              amt: "-KES 1,850",
              tag: "Travel",
              color: "bg-sky-100 text-sky-700",
            },
            {
              name: "Netflix subscription",
              who: "Group: Roommates",
              amt: "-KES 350",
              tag: "Bills",
              color: "bg-violet-100 text-violet-700",
            },
          ].map((t, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-3 px-3 rounded-2xl hover:bg-surface transition"
            >
              <div
                className={`h-11 w-11 rounded-xl ${t.color} flex items-center justify-center text-xs font-bold`}
              >
                {t.tag[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground truncate">{t.who}</p>
              </div>
              <span
                className={`text-sm font-bold ${t.amt.startsWith("+") ? "text-success" : "text-navy"}`}
              >
                {t.amt}
              </span>
            </div>
          ))}
        </div>
      </div>
    </MobileFrame>
  );
}
