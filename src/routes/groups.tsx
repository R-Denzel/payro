import { createFileRoute, Link } from "@tanstack/react-router";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/groups")({ component: Groups });

const groups = [
  {
    id: "nairobi-flat",
    name: "Nairobi Flat",
    members: 4,
    balance: +2400,
    last: "Rent · 2d ago",
    emoji: "🏡",
    tint: "from-emerald-100 to-emerald-50",
  },
  {
    id: "road-trip",
    name: "Mombasa Road Trip",
    members: 6,
    balance: -1850,
    last: "Fuel · 5h ago",
    emoji: "🚗",
    tint: "from-amber-100 to-amber-50",
  },
  {
    id: "lunch-crew",
    name: "Lunch Crew",
    members: 8,
    balance: +320,
    last: "Java House · 1d ago",
    emoji: "🍔",
    tint: "from-rose-100 to-rose-50",
  },
  {
    id: "family",
    name: "Family",
    members: 5,
    balance: 0,
    last: "Settled up ✓",
    emoji: "❤️",
    tint: "from-sky-100 to-sky-50",
  },
  {
    id: "gym",
    name: "Gym Buddies",
    members: 3,
    balance: -450,
    last: "Membership · 3d",
    emoji: "💪",
    tint: "from-violet-100 to-violet-50",
  },
];

function Groups() {
  return (
    <MobileFrame>
      <TopBar
        title="Groups"
        subtitle={`${groups.length} active`}
        right={
          <button className="h-10 w-10 rounded-full bg-surface border border-black/5 flex items-center justify-center">
            <Search className="h-4 w-4" />
          </button>
        }
      />

      <div className="px-5">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl border border-border p-3 bg-emerald-50/50">
            <p className="text-xs text-muted-foreground">Total owed to you</p>
            <p className="mt-1 text-lg font-bold text-success">+KES 2,720</p>
          </div>
          <div className="rounded-2xl border border-border p-3 bg-amber-50/50">
            <p className="text-xs text-muted-foreground">Total you owe</p>
            <p className="mt-1 text-lg font-bold text-navy">-KES 2,300</p>
          </div>
        </div>

        <div className="space-y-3">
          {groups.map((g) => (
            <Link
              to="/groups/$id"
              params={{ id: g.id }}
              key={g.id}
              className={`block rounded-2xl border border-black/5 p-4 bg-gradient-to-br ${g.tint} active:scale-[0.99] transition`}
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-white shadow-soft flex items-center justify-center text-2xl">
                  {g.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.members} members · {g.last}
                  </p>
                </div>
                <div className="text-right">
                  {g.balance === 0 ? (
                    <span className="text-xs font-semibold text-muted-foreground">Settled</span>
                  ) : (
                    <>
                      <p
                        className={`text-sm font-bold ${g.balance > 0 ? "text-success" : "text-destructive"}`}
                      >
                        {g.balance > 0 ? "+" : ""}KES {Math.abs(g.balance).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {g.balance > 0 ? "owed to you" : "you owe"}
                      </p>
                    </>
                  )}
                </div>
              </div>
              {/* Members avatars */}
              <div className="mt-3 flex items-center">
                <div className="flex -space-x-2">
                  {Array.from({ length: Math.min(g.members, 4) }).map((_, i) => (
                    <div
                      key={i}
                      className="h-6 w-6 rounded-full ring-2 ring-white bg-navy text-white text-[10px] font-bold flex items-center justify-center"
                      style={{ background: `hsl(${i * 70 + 140} 50% 45%)` }}
                    >
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                  {g.members > 4 && (
                    <div className="h-6 w-6 rounded-full ring-2 ring-white bg-white text-navy text-[10px] font-bold flex items-center justify-center">
                      +{g.members - 4}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* FAB */}
      <Link
        to="/expense/new"
        className="absolute right-5 bottom-28 h-14 w-14 rounded-2xl payro-gradient text-white shadow-glow flex items-center justify-center active:scale-95 transition z-20"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </Link>
    </MobileFrame>
  );
}
