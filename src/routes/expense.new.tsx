import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { ScanLine, Utensils, Car, Home, ShoppingBag, Ticket, Zap } from "lucide-react";

export const Route = createFileRoute("/expense/new")({ component: NewExpense });

const cats = [
  { icon: Utensils, label: "Food" },
  { icon: Car, label: "Travel" },
  { icon: Home, label: "Rent" },
  { icon: ShoppingBag, label: "Shop" },
  { icon: Ticket, label: "Fun" },
  { icon: Zap, label: "Bills" },
];

function NewExpense() {
  const [amount, setAmount] = useState("4800");
  const [cat, setCat] = useState("Food");
  const [split, setSplit] = useState("equal");
  const nav = useNavigate();
  return (
    <MobileFrame showNav={false}>
      <TopBar back="/home" title="New expense" />

      <div className="px-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold text-center">
          Amount
        </p>
        <div className="mt-2 flex items-baseline justify-center gap-1">
          <span className="text-muted-foreground text-lg font-semibold">KES</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            className="w-40 text-center text-5xl font-bold text-navy bg-transparent outline-none tracking-tight"
          />
        </div>

        <div className="mt-6 space-y-3">
          <div className="rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Title
            </p>
            <input
              defaultValue="Dinner at Talisman"
              className="mt-1 w-full bg-transparent outline-none text-[15px] font-semibold text-navy"
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2 px-1">
              Category
            </p>
            <div className="grid grid-cols-6 gap-2">
              {cats.map((c) => {
                const active = cat === c.label;
                return (
                  <button
                    key={c.label}
                    onClick={() => setCat(c.label)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl border transition ${active ? "border-primary bg-accent" : "border-border bg-white"}`}
                  >
                    <c.icon
                      className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span
                      className={`text-[9px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Members · 4
              </p>
              <button className="text-xs text-primary font-semibold">+ Add</button>
            </div>
            <div className="flex -space-x-2">
              {["A", "K", "S", "J"].map((n, i) => (
                <div
                  key={i}
                  className="h-9 w-9 rounded-full ring-2 ring-surface text-white text-xs font-bold flex items-center justify-center"
                  style={{ background: `hsl(${i * 80 + 140} 50% 45%)` }}
                >
                  {n}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2 px-1">
              Split method
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["equal", "Equal"],
                ["exact", "Exact"],
                ["shares", "Shares"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setSplit(v)}
                  className={`h-11 rounded-xl border text-sm font-semibold transition ${split === v ? "border-primary bg-accent text-primary" : "border-border text-navy"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Each pays{" "}
              <span className="font-semibold text-navy">
                KES {Math.round(+amount / 4).toLocaleString()}
              </span>
            </p>
          </div>

          <Link
            to="/scan"
            className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border p-4 hover:border-primary transition"
          >
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ScanLine className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-navy">Scan receipt with AI</p>
              <p className="text-xs text-muted-foreground">Auto-detect items & suggest split</p>
            </div>
            <span className="text-primary text-lg">›</span>
          </Link>
        </div>

        <button
          onClick={() => nav({ to: "/home" })}
          className="mt-6 mb-6 w-full h-14 rounded-2xl payro-gradient text-white font-semibold shadow-glow active:scale-[0.99] transition"
        >
          Add expense · KES {(+amount).toLocaleString()}
        </button>
      </div>
    </MobileFrame>
  );
}
