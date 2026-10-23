function defaultKeyFromJson(name: string): string | undefined {
  const raw = Deno.env.get(name);
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return typeof value.default === "string" ? value.default : undefined;
  } catch {
    return undefined;
  }
}

export function supabasePublishableKey(): string | undefined {
  return Deno.env.get("SUPABASE_ANON_KEY") ?? defaultKeyFromJson("SUPABASE_PUBLISHABLE_KEYS");
}

export function supabaseSecretKey(): string | undefined {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? defaultKeyFromJson("SUPABASE_SECRET_KEYS");
}
