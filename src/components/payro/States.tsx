import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { avatarColor, initials } from "@/lib/money";

export function Avatar({
  name,
  seed,
  className = "h-10 w-10 text-sm",
}: {
  name: string;
  seed?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-full text-white font-bold flex items-center justify-center shrink-0 ${className}`}
      style={{ background: avatarColor(seed ?? name) }}
    >
      {initials(name)}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="rounded-2xl border border-destructive/30 bg-red-50 p-4 text-sm">
      <p className="text-destructive font-semibold">Couldn't load this</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-primary font-semibold">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-border p-6 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-accent flex items-center justify-center text-primary">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-navy">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function FieldError({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return <p className="mt-2 text-sm text-destructive">{message}</p>;
}
