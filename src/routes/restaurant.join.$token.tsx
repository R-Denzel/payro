import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LoaderCircle, Users } from "lucide-react";
import { MobileFrame, PayroLogo, TopBar } from "@/components/payro/Frame";
import {
  clearPendingSessionInvite,
  getStoredSession,
  setPendingSessionInvite,
  setSetupSessionGroup,
} from "@/lib/auth-store";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/restaurant/join/$token")({
  ssr: false,
  component: JoinRestaurantSession,
});

type InvitePreview = {
  session_name: string;
  restaurant_name: string;
  expires_at: string;
};

function JoinRestaurantSession() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const preview = useQuery({
    queryKey: ["restaurant-session-invite", token],
    queryFn: async () => {
      const client = getSupabase();
      if (!client) throw new Error("Payro is not connected to its backend yet.");
      const [{ data: inviteRows, error: inviteError }, { data: authData }] = await Promise.all([
        client.rpc("get_restaurant_session_invite", { _token: token }),
        client.auth.getUser(),
      ]);
      if (inviteError) throw inviteError;
      const invite = (inviteRows as InvitePreview[] | null)?.[0] ?? null;
      if (!invite) clearPendingSessionInvite();
      const localSession = getStoredSession();
      return {
        invite,
        userId: authData.user?.id ?? null,
        hasPayroProfile: Boolean(authData.user && localSession?.userId === authData.user.id),
      };
    },
  });

  async function join() {
    setBusy(true);
    setError("");
    try {
      const client = getSupabase();
      if (!client) throw new Error("Payro is not connected to its backend yet.");
      const { data: authData } = await client.auth.getUser();
      const localSession = getStoredSession();
      if (!authData.user || localSession?.userId !== authData.user.id) {
        setPendingSessionInvite(token);
        await navigate({ to: "/auth" });
        return;
      }

      const { data: groupId, error: joinError } = await client.rpc("join_restaurant_session", {
        _token: token,
      });
      if (joinError) throw joinError;
      if (!groupId) throw new Error("Could not join this session.");
      clearPendingSessionInvite();
      if (!localSession.fullName) {
        setSetupSessionGroup(groupId);
        await navigate({ to: "/setup" });
      } else {
        await navigate({ to: "/groups/$id", params: { id: groupId } });
      }
    } catch (cause) {
      clearPendingSessionInvite();
      setError(cause instanceof Error ? cause.message : "Could not join this session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MobileFrame showNav={false}>
      <TopBar back="/restaurant" title="Join a session" />
      <main className="px-5 pb-8">
        <div className="mx-auto mt-8 max-w-md rounded-3xl border border-border bg-white p-6 text-center shadow-sm">
          <PayroLogo className="mx-auto h-11 w-11" />
          {preview.isLoading ? (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading invite…
            </div>
          ) : preview.error || !preview.data?.invite ? (
            <>
              <h1 className="mt-5 text-xl font-bold text-navy">Invite unavailable</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This invite may have expired or been replaced. Ask the restaurant to share a new one.
              </p>
            </>
          ) : (
            <>
              <span className="mx-auto mt-5 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-900">
                <Users size={22} />
              </span>
              <p className="mt-4 text-xs font-bold uppercase tracking-wider text-emerald-800">
                You’re invited to
              </p>
              <h1 className="mt-2 text-2xl font-bold text-navy">
                {preview.data.invite.session_name}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Hosted by {preview.data.invite.restaurant_name}
              </p>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                Join this Payro group to view the restaurant bill and your share.
              </p>
              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </p>
              )}
              <button
                onClick={join}
                disabled={busy}
                className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-emerald-900 font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Joining…" : preview.data.hasPayroProfile ? "Join session" : "Sign in to join"}
              </button>
              <p className="mt-4 text-xs text-slate-500">
                By joining, you’ll share this group with its members.
              </p>
            </>
          )}
          <Link to="/restaurant" className="mt-6 inline-block text-sm font-semibold text-emerald-900">
            Payro for Restaurants
          </Link>
        </div>
      </main>
    </MobileFrame>
  );
}
