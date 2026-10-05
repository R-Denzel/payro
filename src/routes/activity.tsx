import { createFileRoute } from "@tanstack/react-router";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Filter } from "lucide-react";

export const Route = createFileRoute("/activity")({ component: Activity });

const groups = [
  {
    label: "Today · 8 May",
    items: [
      { t: "Sent", who: "Kevin M.", tag: "M-Pesa", a: "-KES 1,850", pos: false, time: "12:04" },
      { t: "Received", who: "Sarah W.", tag: "M-Pesa", a: "+KES 640", pos: true, time: "09:22" },
      {
        t: "Deposit",
        who: "Payro Wallet",
        tag: "Top-up",
        a: "+KES 5,000",
        pos: true,
        time: "08:10",
      },
    ],
  },
  {
    label: "Yesterday",
    items: [
      {
        t: "Split",
        who: "Java House · Group",
        tag: "Food",
        a: "-KES 1,010",
        pos: false,
        time: "20:15",
      },
      { t: "Sent", who: "James O.", tag: "Airtel", a: "-KES 200", pos: false, time: "14:03" },
    ],
  },
  {
    label: "Mon · 6 May",
    items: [
      {
        t: "Split",
        who: "Uber to airport",
        tag: "Travel",
        a: "-KES 1,850",
        pos: false,
        time: "06:30",
      },
      { t: "Received", who: "Aisha K.", tag: "MTN MoMo", a: "+KES 3,400", pos: true, time: "—" },
    ],
  },
];

function Activity() {
  return (
    <MobileFrame>
      <TopBar
        title="Activity"
        right={
          <button className="h-10 w-10 rounded-full bg-surface border border-black/5 flex items-center justify-center">
            <Filter className="h-4 w-4" />
          </button>
        }
      />

      <div className="px-5">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-2xl border border-border p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">In</p>
            <p className="text-sm font-bold text-success mt-1">+KES 9,040</p>
          </div>
          <div className="rounded-2xl border border-border p-3 text-center">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Out</p>
            <p className="text-sm font-bold text-navy mt-1">-KES 4,910</p>
          </div>
          <div className="rounded-2xl border border-border p-3 text-center bg-accent/40">
            <p className="text-[10px] uppercase text-primary font-semibold">Net</p>
            <p className="text-sm font-bold text-primary mt-1">+4,130</p>
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.label} className="mb-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">
              {g.label}
            </p>
            <div className="rounded-2xl bg-white border border-border divide-y divide-border">
              {g.items.map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-3.5">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center text-[10px] font-bold ${t.pos ? "bg-emerald-100 text-primary" : "bg-surface text-navy"}`}
                  >
                    {t.t[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-navy">{t.who}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.t} · {t.tag} · {t.time}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${t.pos ? "text-success" : "text-navy"}`}>
                    {t.a}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MobileFrame>
  );
}
