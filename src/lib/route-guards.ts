import { redirect } from "@tanstack/react-router";
import { getStoredSession, signOut as clearLocalSession } from "./auth-store";
import { getSupabase } from "./supabase";

// beforeLoad for signed-in screens. Routes using it must set `ssr: false`
// because the session lives in browser storage.
export async function requireAuth() {
  const local = getStoredSession();
  const supabase = getSupabase();

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (!data.session || !local || local.userId !== data.session.user.id) {
      clearLocalSession();
      throw redirect({ to: "/auth" });
    }
  } else if (!local) {
    throw redirect({ to: "/auth" });
  }
}

// Signed in but no name yet -> ask for it first.
export async function requireProfileComplete() {
  await requireAuth();
  if (!getStoredSession()?.fullName) {
    throw redirect({ to: "/setup" });
  }
}
