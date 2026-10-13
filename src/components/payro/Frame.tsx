import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Activity, User, Plus, ChartColumn, Wallet, Bell } from "lucide-react";
import type { ReactNode } from "react";

export function PayroLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none">
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#pg)" />
      <path d="M14 12h9a6 6 0 0 1 0 12h-4v6h-5V12zm5 4v4h4a2 2 0 1 0 0-4h-4z" fill="white" />
    </svg>
  );
}

/**
 * App shell. Phones: edge-to-edge with safe-area padding and a bottom tab bar.
 * Desktop (lg+): navy sidebar and a centred content column — no device mockup.
 */
export function MobileFrame({
  children,
  showNav = true,
  contentClassName = "",
}: {
  children: ReactNode;
  showNav?: boolean;
  contentClassName?: string;
}) {
  return (
    <div className="h-dvh w-full flex bg-background">
      {showNav && <SideNav />}
      <div className="relative flex-1 min-w-0 flex flex-col">
        {!showNav && <BrandBar />}
        <div
          className={`flex-1 overflow-y-auto no-scrollbar pt-[calc(env(safe-area-inset-top)_+_0.75rem)] lg:pt-8 ${
            showNav
              ? "pb-[calc(env(safe-area-inset-bottom)_+_6.5rem)] lg:pb-12"
              : "pb-[env(safe-area-inset-bottom)] lg:pb-8"
          } ${contentClassName}`}
        >
          <div className="mx-auto w-full max-w-[640px] h-full">{children}</div>
        </div>
        {showNav && <BottomNav />}
      </div>
    </div>
  );
}

const NAV = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/groups", icon: Users, label: "Groups" },
  { to: "/activity", icon: Activity, label: "Activity" },
  { to: "/analytics", icon: ChartColumn, label: "Insights", desktopOnly: true },
  { to: "/wallet", icon: Wallet, label: "Wallet", desktopOnly: true },
  { to: "/notifications", icon: Bell, label: "Notifications", desktopOnly: true },
  { to: "/profile", icon: User, label: "Profile" },
] as const;

function useIsActive() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => path === to || path.startsWith(`${to}/`);
}

function SideNav() {
  const isActive = useIsActive();
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col payro-gradient-dark text-white px-4 py-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
      <Link to="/home" className="relative flex items-center gap-3 px-2">
        <PayroLogo className="h-9 w-9" />
        <span className="text-lg font-bold tracking-tight">Payro</span>
      </Link>
      <Link
        to="/expense/new"
        className="relative mt-8 h-11 rounded-xl payro-gradient shadow-glow flex items-center justify-center gap-2 text-sm font-semibold hover:brightness-105 active:scale-[0.98] transition"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        New expense
      </Link>
      <nav className="relative mt-6 space-y-1">
        {NAV.map(({ to, icon: Icon, label }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className={`h-11 px-3 rounded-xl flex items-center gap-3 text-sm font-medium transition ${
                active
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] ${active ? "text-emerald-300" : ""}`}
                strokeWidth={2}
              />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="relative mt-auto px-2 text-[10px] font-semibold tracking-[0.2em] text-white/30">
        SPLIT SMART · PAY EASY
      </p>
    </aside>
  );
}

/** Desktop-only header for focused flows (sign-in, new expense, pay…) that hide the nav. */
function BrandBar() {
  return (
    <div className="hidden lg:flex h-16 shrink-0 items-center gap-2.5 px-8 border-b border-black/5">
      <PayroLogo className="h-8 w-8" />
      <span className="text-[15px] font-bold tracking-tight text-navy">Payro</span>
    </div>
  );
}

function BottomNav() {
  const isActive = useIsActive();
  const item = ({ to, icon: Icon, label }: (typeof NAV)[number]) => {
    const active = isActive(to);
    return (
      <Link key={to} to={to} className="relative flex flex-col items-center gap-1 flex-1 py-1.5">
        <span
          className={`absolute -top-2 h-[3px] w-6 rounded-full bg-primary transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
        />
        <Icon
          className={`h-[22px] w-[22px] ${active ? "text-primary" : "text-muted-foreground"}`}
          strokeWidth={active ? 2.4 : 1.9}
        />
        <span
          className={`text-[10px] font-semibold ${active ? "text-navy" : "text-muted-foreground"}`}
        >
          {label}
        </span>
      </Link>
    );
  };
  const tabs = NAV.filter((n) => !("desktopOnly" in n));
  return (
    <div className="lg:hidden absolute bottom-0 left-0 right-0 z-30">
      <div className="bg-white/85 backdrop-blur-xl border-t border-black/[0.06] shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.12)] px-2 pt-2.5 pb-[calc(env(safe-area-inset-bottom)_+_0.5rem)]">
        <div className="flex items-end max-w-[640px] mx-auto">
          {tabs.slice(0, 2).map(item)}
          <div className="flex-1 flex justify-center">
            <Link
              to="/expense/new"
              aria-label="New expense"
              className="-mt-7 h-14 w-14 rounded-2xl payro-gradient shadow-glow ring-4 ring-white flex items-center justify-center text-white active:scale-95 transition"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </Link>
          </div>
          {tabs.slice(2).map(item)}
        </div>
      </div>
    </div>
  );
}

export function TopBar({
  title,
  back,
  right,
  subtitle,
}: {
  title?: string;
  back?: string;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="px-5 pt-2 pb-4 flex items-center gap-3">
      {back && (
        <Link
          to={back}
          className="h-10 w-10 rounded-full bg-surface flex items-center justify-center border border-black/5"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      )}
      <div className="flex-1 min-w-0">
        {title && <h1 className="text-[17px] font-semibold text-navy truncate">{title}</h1>}
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
