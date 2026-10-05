import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Check, Loader2 } from "lucide-react";

export const Route = createFileRoute("/pay")({ component: Pay });

const methods = [
  { id: "mpesa", name: "M-Pesa", sub: "STK Push · Instant", color: "bg-emerald-600", initial: "M" },
  { id: "airtel", name: "Airtel Money", sub: "Direct debit", color: "bg-red-600", initial: "A" },
  { id: "mtn", name: "MTN MoMo", sub: "Mobile Money", color: "bg-yellow-500", initial: "M" },
];

function Pay() {
  const [step, setStep] = useState<"select" | "stk" | "done">("select");
  const [method, setMethod] = useState("mpesa");
  const nav = useNavigate();

  useEffect(() => {
    if (step === "stk") {
      const t = setTimeout(() => setStep("done"), 2600);
      return () => clearTimeout(t);
    }
    if (step === "done") {
      const t = setTimeout(() => nav({ to: "/home" }), 1800);
      return () => clearTimeout(t);
    }
  }, [step, nav]);

  if (step === "done")
    return (
      <MobileFrame showNav={false}>
        <div className="h-full flex flex-col items-center justify-center px-6 text-center animate-fade-in">
          <div className="h-24 w-24 rounded-full payro-gradient flex items-center justify-center shadow-glow animate-scale-in">
            <Check className="h-12 w-12 text-white" strokeWidth={3} />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-navy">Payment sent</h2>
          <p className="mt-1 text-muted-foreground">KES 1,850 to Kevin M.</p>
          <div className="mt-6 rounded-2xl bg-surface p-4 w-full text-left">
            <div className="flex justify-between text-sm py-1">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-semibold">MPX·48A2·9K</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-muted-foreground">Method</span>
              <span className="font-semibold">M-Pesa</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-muted-foreground">Fee</span>
              <span className="font-semibold text-success">Free</span>
            </div>
          </div>
        </div>
      </MobileFrame>
    );

  if (step === "stk")
    return (
      <MobileFrame showNav={false}>
        <div className="h-full flex flex-col items-center justify-center px-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 blur-2xl payro-gradient rounded-full opacity-60 animate-pulse" />
            <div className="relative h-24 w-24 rounded-3xl bg-emerald-600 flex items-center justify-center text-white text-4xl font-bold">
              M
            </div>
          </div>
          <h2 className="mt-6 text-xl font-bold text-navy">Check your phone</h2>
          <p className="mt-1 text-muted-foreground text-sm px-4">
            We sent an M-Pesa STK Push to <br />
            <span className="font-semibold text-navy">+254 712 345 678</span>
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for PIN…
          </div>
          <div className="mt-8 rounded-2xl bg-surface p-4 w-full max-w-xs">
            <p className="text-3xl font-bold text-navy text-center">KES 1,850</p>
            <p className="text-xs text-center text-muted-foreground mt-1">
              to Kevin M. · Nairobi Flat
            </p>
          </div>
        </div>
      </MobileFrame>
    );

  return (
    <MobileFrame showNav={false}>
      <TopBar back="/home" title="Pay" />
      <div className="px-6">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-50 to-white border border-border p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Amount
          </p>
          <p className="mt-1 text-4xl font-bold text-navy">KES 1,850</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className="h-8 w-8 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center">
              K
            </div>
            <p className="text-sm text-navy">
              to <span className="font-semibold">Kevin Mwangi</span>
            </p>
          </div>
        </div>

        <p className="mt-6 text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Payment method
        </p>
        <div className="space-y-2">
          {methods.map((m) => {
            const active = method === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition ${active ? "border-primary bg-accent" : "border-border bg-white"}`}
              >
                <div
                  className={`h-11 w-11 rounded-xl ${m.color} flex items-center justify-center text-white font-bold`}
                >
                  {m.initial}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-navy">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.sub}</p>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border-2 ${active ? "border-primary bg-primary" : "border-border"} flex items-center justify-center`}
                >
                  {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl bg-surface p-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-semibold">KES 1,850</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Fee</span>
            <span className="font-semibold text-success">Free</span>
          </div>
          <div className="border-t border-border my-2" />
          <div className="flex justify-between text-base">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-navy">KES 1,850</span>
          </div>
        </div>

        <button
          onClick={() => setStep("stk")}
          className="mt-6 w-full h-14 rounded-2xl payro-gradient text-white font-semibold shadow-glow active:scale-[0.99] transition"
        >
          Pay with M-Pesa
        </button>
      </div>
    </MobileFrame>
  );
}
