import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Activity, User, Plus } from "lucide-react";
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
    <div
      className="min-h-screen w-full flex items-center justify-center py-6 px-4"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, #d8f5e9 0%, transparent 60%), linear-gradient(180deg,#eef1f6,#e6ebf3)",
      }}
    >
      <div className="relative w-full max-w-[400px] h-[860px] rounded-[44px] bg-background shadow-[0_40px_80px_-30px_rgba(15,23,42,0.35)] border border-black/5 overflow-hidden flex flex-col">
        {/* Status bar */}
        <div className="absolute top-0 left-0 right-0 h-11 z-40 flex items-center justify-between px-7 text-[13px] font-semibold text-navy pointer-events-none">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor">
              <rect x="0" y="6" width="3" height="4" rx="0.5" />
              <rect x="4" y="4" width="3" height="6" rx="0.5" />
              <rect x="8" y="2" width="3" height="8" rx="0.5" />
              <rect x="12" y="0" width="3" height="10" rx="0.5" />
            </svg>
            <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
              <rect
                x="0.5"
                y="0.5"
                width="20"
                height="10"
                rx="2.5"
                stroke="currentColor"
                opacity="0.5"
              />
              <rect x="2" y="2" width="17" height="7" rx="1.2" fill="currentColor" />
              <rect
                x="21.5"
                y="3.5"
                width="1.5"
                height="4"
                rx="0.5"
                fill="currentColor"
                opacity="0.5"
              />
            </svg>
          </div>
        </div>
        {/* Dynamic island */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[110px] h-[30px] rounded-full bg-black z-50" />

        <div
          className={`flex-1 overflow-y-auto no-scrollbar pt-11 ${showNav ? "pb-24" : ""} ${contentClassName}`}
        >
          {children}
        </div>

        {showNav && <BottomNav />}
      </div>
    </div>
  );
}

function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const item = (to: string, Icon: typeof Home, label: string) => {
    const active = path === to;
    return (
      <Link to={to} className="flex flex-col items-center gap-1 flex-1 py-2">
        <Icon
          className={`h-[22px] w-[22px] ${active ? "text-primary" : "text-muted-foreground"}`}
          strokeWidth={active ? 2.5 : 2}
        />
        <span
          className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
        >
          {label}
        </span>
      </Link>
    );
  };
  return (
    <div className="absolute bottom-0 left-0 right-0 z-30">
      <div className="relative glass border-t border-black/5 px-2 pt-2 pb-5">
        <div className="flex items-end">
          {item("/home", Home, "Home")}
          {item("/groups", Users, "Groups")}
          <div className="flex-1 flex justify-center">
            <Link
              to="/expense/new"
              className="-mt-8 h-16 w-16 rounded-2xl payro-gradient shadow-glow flex items-center justify-center text-white active:scale-95 transition"
            >
              <Plus className="h-7 w-7" strokeWidth={2.5} />
            </Link>
          </div>
          {item("/activity", Activity, "Activity")}
          {item("/profile", User, "Profile")}
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
