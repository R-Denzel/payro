import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Banknote,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Utensils,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type { RestaurantAccess } from "@/lib/restaurant-auth";

const nav = [
  ["Overview", "/restaurant/dashboard", LayoutDashboard],
  ["Group sessions", "/restaurant/sessions", Users],
  ["Restaurant bills", "/restaurant/bills", ClipboardList],
  ["Settlements", "/restaurant/settlements", Banknote],
  ["Reports", "/restaurant/reports", BarChart3],
  ["Settings", "/restaurant/settings", Settings],
] as const;
export function RestaurantShell({
  access,
  children,
}: {
  access: RestaurantAccess;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  async function logout() {
    await getSupabase()?.auth.signOut();
    navigate({ to: "/restaurant/login" });
  }
  return (
    <div className="min-h-dvh bg-[#f5f5f0] text-[#17251d] md:flex">
      <aside className="flex w-full flex-col bg-[#153d2c] px-4 py-5 text-white md:fixed md:inset-y-0 md:w-64 md:px-5">
        <Link to="/restaurant/dashboard" className="flex items-center gap-3 px-2 text-lg font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
            <Utensils size={19} />
          </span>
          <span>
            Payro{" "}
            <small className="block text-xs font-medium text-emerald-200">for Restaurants</small>
          </span>
        </Link>
        <div className="mt-8 rounded-2xl bg-white/10 p-3">
          <p className="truncate text-sm font-semibold">{access.name}</p>
          <p className="mt-1 text-xs capitalize text-emerald-100/70">
            {access.role} · {access.status}
          </p>
        </div>
        <nav className="mt-7 grid grid-cols-3 gap-1 sm:grid-cols-6 md:grid-cols-1">
          {nav.map(([label, to, Icon]) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white"
            >
              <Icon size={17} />
              <span className="hidden md:inline">{label}</span>
              <span className="md:hidden">{label.split(" ")[0]}</span>
            </Link>
          ))}
        </nav>
        <button
          onClick={logout}
          className="mt-auto hidden items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/70 hover:bg-white/10 md:flex"
        >
          <LogOut size={17} />
          Log out
        </button>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-10 pt-6 sm:px-7 md:ml-64 md:px-9 md:pt-9">
        {children}
        <button
          onClick={logout}
          className="mt-10 flex items-center gap-2 text-sm text-slate-500 md:hidden"
        >
          <LogOut size={16} />
          Log out
        </button>
      </main>
    </div>
  );
}
