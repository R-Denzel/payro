import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MobileFrame, TopBar } from "@/components/payro/Frame";
import { Avatar, FieldError } from "@/components/payro/States";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Bell, ChevronRight, Globe, LogOut, Pencil, QrCode, Scale } from "lucide-react";
import {
  currentUserId,
  useExpenses,
  useGroups,
  usePayments,
  useProfile,
  useUpdateProfile,
} from "@/lib/data";
import { requireProfileComplete } from "@/lib/route-guards";
import { signOut } from "@/lib/supabase-auth";

export const Route = createFileRoute("/profile")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  component: Profile,
});

function formatPhone(digits: string | null | undefined) {
  if (!digits) return "";
  return `+${digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3 $4")}`;
}

function Profile() {
  const me = currentUserId();
  const profile = useProfile();
  const groups = useGroups();
  const expenses = useExpenses();
  const payments = usePayments();
  const update = useUpdateProfile();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const p = profile.data;
  const items = [
    [
      { icon: Bell, label: "Notifications", to: "/notifications" },
      { icon: Scale, label: "Balances", to: "/wallet" },
      { icon: BarChart3, label: "Spending insights", to: "/analytics" },
      { icon: QrCode, label: "My QR code", to: "/qr" },
    ],
    [
      {
        icon: Globe,
        label: "Country & Currency",
        meta: p ? `${p.country} · ${p.currency}` : "",
        to: "/profile",
      },
    ],
  ];

  const logout = async () => {
    await signOut();
    qc.clear();
    nav({ to: "/auth" });
  };

  return (
    <MobileFrame>
      <TopBar title="Profile" />

      <div className="px-5 pb-4">
        <div className="rounded-3xl payro-gradient-dark p-5 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-primary/40 blur-3xl" />
          <div className="flex items-center gap-4">
            <Avatar
              name={p?.full_name ?? ""}
              seed={me}
              className="h-16 w-16 text-xl rounded-2xl ring-4 ring-white/10"
            />
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 min-w-0 h-9 rounded-lg bg-white/10 border border-white/20 px-2 text-white text-sm outline-none"
                  />
                  <button
                    onClick={() =>
                      update.mutate({ full_name: name }, { onSuccess: () => setEditing(false) })
                    }
                    disabled={name.trim().length < 2 || update.isPending}
                    className="h-9 px-3 rounded-lg bg-white text-navy text-xs font-semibold disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setName(p?.full_name ?? "");
                    setEditing(true);
                  }}
                  className="flex items-center gap-2 text-white text-lg font-bold"
                >
                  {p?.full_name || "…"}
                  <Pencil className="h-3.5 w-3.5 text-white/60" />
                </button>
              )}
              <p className="text-white/70 text-xs">{formatPhone(p?.phone)}</p>
              <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-300 text-[10px] font-semibold">PHONE VERIFIED</span>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-white text-lg font-bold">{expenses.data?.length ?? "–"}</p>
              <p className="text-white/60 text-[10px] uppercase">Expenses</p>
            </div>
            <div>
              <p className="text-white text-lg font-bold">{groups.data?.length ?? "–"}</p>
              <p className="text-white/60 text-[10px] uppercase">Groups</p>
            </div>
            <div>
              <p className="text-white text-lg font-bold">{payments.data?.length ?? "–"}</p>
              <p className="text-white/60 text-[10px] uppercase">Payments</p>
            </div>
          </div>
        </div>
        <FieldError error={update.error} />

        {items.map((section, si) => (
          <div
            key={si}
            className="mt-4 rounded-2xl bg-white border border-border divide-y divide-border overflow-hidden"
          >
            {section.map((it, i) => (
              <Link to={it.to} key={i} className="flex items-center gap-3 p-4 active:bg-surface">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-surface text-navy">
                  <it.icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-navy">{it.label}</p>
                  {"meta" in it && it.meta && (
                    <p className="text-xs text-muted-foreground">{it.meta}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        ))}

        <button
          onClick={logout}
          className="mt-4 w-full flex items-center gap-3 p-4 rounded-2xl bg-white border border-border"
        >
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-red-50 text-destructive">
            <LogOut className="h-4.5 w-4.5" />
          </div>
          <p className="flex-1 text-left text-sm font-semibold text-destructive">Sign out</p>
        </button>

        <p className="mt-6 mb-2 text-center text-xs text-muted-foreground">
          Payro v1.0 · Made with 💚 for Africa
        </p>
      </div>
    </MobileFrame>
  );
}
