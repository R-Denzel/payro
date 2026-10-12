import {
  getPendingPhone,
  normalizePhone,
  persistSession,
  signOut as clearLocalSession,
  type AuthSession,
} from "./auth-store";
import { getSupabase } from "./supabase";

// Supabase expects E.164 (+2547...); auth-store keeps digits only.
function toE164(phone: string): string {
  return `+${normalizePhone(phone)}`;
}

export async function sendOtp(phone: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return; // mock mode: any 6 digits are accepted

  const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) });
  if (error) throw error;
}

export async function verifyOtp(code: string): Promise<AuthSession> {
  const phone = getPendingPhone();
  if (!phone) throw new Error("No phone number pending verification");
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code");

  const supabase = getSupabase();
  if (!supabase) {
    const session: AuthSession = {
      userId: `mock-${phone}`,
      fullName: "",
      phone,
      country: "KE",
      currency: "KES",
      isAuthenticated: true,
    };
    persistSession(session);
    return session;
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone: toE164(phone),
    token: code,
    type: "sms",
  });
  if (error) throw error;
  if (!data.user) throw new Error("Verification failed");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, country, currency")
    .eq("id", data.user.id)
    .maybeSingle();

  const session: AuthSession = {
    userId: data.user.id,
    fullName: profile?.full_name ?? "",
    phone,
    country: profile?.country ?? "KE",
    currency: profile?.currency ?? "KES",
    isAuthenticated: true,
  };
  persistSession(session);
  return session;
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut();
  clearLocalSession();
}

// Keep the local session cache in sync if Supabase drops the session (expiry, sign-out elsewhere).
if (typeof window !== "undefined") {
  getSupabase()?.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") clearLocalSession();
  });
}
