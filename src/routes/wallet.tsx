import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { ArrowDownToLine, ArrowUpFromLine, Plus, CreditCard } from "lucide-react";

export const Route = createFileRoute("/wallet")({ component: Wallet });

function Wallet() {
  return (
    <MobileFrame>
      <TopBar back="/home" title="Wallet" />
      <div className="px-5">
        <div className="rounded-3xl payro-gradient-dark p-6 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-primary/40 blur-3xl" />
          <div className="flex items-center justify-between">
            <p className="text-white/60 text-xs uppercase tracking-widest">Available balance</p>
            <span className="text-white/70 text-xs px-2 py-1 rounded-full bg-white/10">KES</span>
          </div>
          <p className="mt-2 text-white text-4xl font-bold tracking-tight">
            48,320<span className="text-white/60 text-2xl">.50</span>
          </p>
          <p className="mt-1 text-emerald-300 text-xs">+ KES 2,140 this week</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button className="h-11 rounded-xl bg-white text-navy font-semibold text-sm flex items-center justify-center gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Deposit
            </button>
            <button className="h-11 rounded-xl bg-white/10 text-white font-semibold text-sm flex items-center justify-center gap-2 border border-white/20">
              <ArrowUpFromLine className="h-4 w-4" />
              Withdraw
            </button>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Payment methods
            </p>
            <button className="text-xs text-primary font-semibold flex items-center gap-1">
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
          <div className="space-y-2">
            {[
              { name: "M-Pesa", num: "+254 712 •••• 678", color: "bg-emerald-600", primary: true },
              { name: "Airtel Money", num: "+254 733 •••• 210", color: "bg-red-600" },
              { name: "Equity Bank", num: "•••• 4820", color: "bg-navy" },
            ].map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-border"
              >
                <div className={`h-11 w-11 rounded-xl ${p.color} flex items-center justify-center`}>
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-navy">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.num}</p>
                </div>
                {p.primary && (
                  <span className="text-[10px] font-bold text-primary bg-accent px-2 py-1 rounded-full">
                    DEFAULT
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 pb-4">
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">
            Recent transactions
          </p>
          <div className="rounded-2xl bg-white border border-border divide-y divide-border">
            {[
              { n: "Deposit · M-Pesa", d: "Today · 09:42", a: "+KES 5,000", pos: true },
              { n: "Sent to Kevin M.", d: "Today · 08:15", a: "-KES 1,850", pos: false },
              { n: "Received from Sarah", d: "Yesterday", a: "+KES 640", pos: true },
              { n: "Java House", d: "Mon", a: "-KES 1,010", pos: false },
              { n: "Withdraw to Bank", d: "Sun", a: "-KES 10,000", pos: false },
            ].map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3.5">
                <div>
                  <p className="text-sm font-semibold text-navy">{t.n}</p>
                  <p className="text-[11px] text-muted-foreground">{t.d}</p>
                </div>
                <span className={`text-sm font-bold ${t.pos ? "text-success" : "text-navy"}`}>
                  {t.a}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}
