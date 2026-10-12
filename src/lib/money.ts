// Money is stored as integer minor units (cents). These helpers handle display and parsing.

export function formatMoney(cents: number, currency = "KES"): string {
  const value = cents / 100;
  const hasCents = cents % 100 !== 0;
  return `${currency} ${value.toLocaleString("en-KE", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatSignedMoney(cents: number, currency = "KES"): string {
  if (cents === 0) return formatMoney(0, currency);
  return `${cents > 0 ? "+" : "-"}${formatMoney(Math.abs(cents), currency)}`;
}

// "1,250.50" -> 125050. Returns null for empty/invalid input.
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function avatarColor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 50% 45%)`;
}

export function relativeDay(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-KE", { weekday: "short" });
  return date.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}
