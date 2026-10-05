import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { MoreHorizontal, Check } from "lucide-react";

export const Route = createFileRoute("/groups/$id")({ component: GroupDetail });

function GroupDetail() {
  const { id } = Route.useParams();
  const title = id
    .split("-")
    .map((s: string) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
  return (
    <MobileFrame>
      <TopBar
        back="/groups"
        title={title}
        subtitle="4 members"
        right={
          <button className="h-10 w-10 rounded-full bg-surface border border-black/5 flex items-center justify-center">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        }
      />

      <div className="px-5">
        <div className="rounded-3xl payro-gradient-dark p-5 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/40 blur-3xl" />
          <p className="text-white/60 text-xs uppercase tracking-wider">Your balance</p>
          <p className="mt-1 text-white text-3xl font-bold">+ KES 2,400</p>
          <p className="text-white/70 text-sm mt-0.5">Kevin owes you the most</p>

          <div className="mt-5">
            <div className="flex items-center justify-between text-white/80 text-xs mb-1.5">
              <span>Settlement progress</span>
              <span>68%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-[68%] rounded-full bg-emerald-400" />
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
              className="flex-1 h-11 rounded-xl bg-white/10 text-white font-semibold text-sm flex items-center justify-center border border-white/20"
            >
              Add expense
            </Link>
          </div>
        </div>

        {/* Members */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Balances
          </p>
          <div className="space-y-2">
            {[
              { n: "Kevin M.", s: "Owes you", a: "+KES 1,850", pos: true },
              { n: "Sarah W.", s: "Owes you", a: "+KES 550", pos: true },
              { n: "You", s: "Balanced", a: "KES 0", pos: null },
              { n: "James O.", s: "You owe", a: "-KES 200", pos: false },
            ].map((m, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-2xl bg-surface">
                <div
                  className="h-10 w-10 rounded-full text-white font-bold flex items-center justify-center text-sm"
                  style={{ background: `hsl(${i * 80 + 140} 50% 45%)` }}
                >
                  {m.n[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-navy">{m.n}</p>
                  <p className="text-xs text-muted-foreground">{m.s}</p>
                </div>
                <span
                  className={`text-sm font-bold ${m.pos === true ? "text-success" : m.pos === false ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {m.a}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="mt-6 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Timeline
          </p>
          <div className="relative pl-6">
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
            {[
              {
                t: "Today",
                title: "Dinner at Talisman",
                meta: "You paid · KES 4,800",
                split: "Split 4 ways",
                state: "active",
              },
              {
                t: "Yesterday",
                title: "Uber home",
                meta: "Kevin paid · KES 900",
                split: "Split 3 ways",
                state: "done",
              },
              {
                t: "Mon",
                title: "Groceries — Naivas",
                meta: "You paid · KES 3,200",
                split: "Split 4 ways",
                state: "done",
              },
              {
                t: "Sun",
                title: "Kevin settled",
                meta: "M-Pesa · KES 1,200",
                split: "Received",
                state: "paid",
              },
            ].map((e, i) => (
              <div key={i} className="relative pb-4">
                <div
                  className={`absolute -left-6 top-1 h-4 w-4 rounded-full ring-4 ring-background ${e.state === "paid" ? "bg-success" : e.state === "active" ? "bg-primary" : "bg-border"}`}
                >
                  {e.state === "paid" && (
                    <Check className="h-3 w-3 text-white m-0.5" strokeWidth={3} />
                  )}
                </div>
                <div className="rounded-2xl bg-white border border-border p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-semibold text-navy">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{e.meta}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground">{e.t}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-primary font-medium">{e.split}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MobileFrame>
  );
}
