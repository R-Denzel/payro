import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { MobileFrame } from "@/components/payro/Frame";
import {
  clearPendingOAuthIntent,
  clearPendingRestaurantSignup,
  getPendingOAuthIntent,
  getPendingSessionInvite,
  persistSession,
  takePendingRestaurantSignup,
} from "@/lib/auth-store";
import { getRestaurantAccess } from "@/lib/restaurant-auth";
import { completeOAuthSignIn } from "@/lib/supabase-auth";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  component: AuthCallback,
});

function AuthCallback() {
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState(getPendingOAuthIntent());
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const currentIntent =
      params.get("intent") === "restaurant-signup" ? "restaurant-signup" : getPendingOAuthIntent();
    setIntent(currentIntent);
    if (!code) {
      setError(params.get("error_description") ?? "Google sign-in was cancelled.");
      clearPendingOAuthIntent();
      clearPendingRestaurantSignup();
      return;
    }

    completeOAuthSignIn(code)
      .then(async (session) => {
        const inviteToken = getPendingSessionInvite();
        if (inviteToken) {
          clearPendingOAuthIntent();
          clearPendingRestaurantSignup();
          nav({ to: "/restaurant/join/$token", params: { token: inviteToken }, replace: true });
          return;
        }

        if (currentIntent === "restaurant-login") {
          const access = await getRestaurantAccess();
          clearPendingOAuthIntent();
          if (!access)
            throw new Error(
              "This Google account is not linked to a restaurant yet. Register your restaurant or use the Google account invited by your team.",
            );
          nav({ to: "/restaurant/dashboard", replace: true });
          return;
        }

        if (currentIntent === "restaurant-signup") {
          const access = await getRestaurantAccess();
          if (access) {
            clearPendingOAuthIntent();
            clearPendingRestaurantSignup();
            nav({ to: "/restaurant/dashboard", replace: true });
            return;
          }
          const draft = takePendingRestaurantSignup();
          if (!draft)
            throw new Error(
              "Your restaurant details were missing when Google returned. Please start registration again.",
            );
          const client = getSupabase();
          if (!client) throw new Error("Supabase is not configured.");
          const { error: registerError } = await client.rpc("register_restaurant", {
            _name: draft.name,
            _owner_name: draft.owner,
            _category: draft.category,
            _location: draft.location,
            _phone: draft.phone,
          });
          if (registerError) throw registerError;
          persistSession({ ...session, fullName: draft.owner });
          clearPendingOAuthIntent();
          nav({ to: "/restaurant/dashboard", replace: true });
          return;
        }

        clearPendingOAuthIntent();
        clearPendingRestaurantSignup();
        nav({ to: session.fullName ? "/home" : "/setup", replace: true });
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Google sign-in failed");
        clearPendingOAuthIntent();
        clearPendingRestaurantSignup();
      });
  }, [nav]);

  const restaurantFlow = intent === "restaurant-login" || intent === "restaurant-signup";
  return (
    <MobileFrame showNav={false}>
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        {error ? (
          <>
            <h1 className="text-xl font-bold text-navy">Couldn't finish signing in</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Link
              to={restaurantFlow ? "/restaurant/login" : "/auth"}
              className="mt-6 inline-flex h-12 px-6 items-center rounded-2xl payro-gradient text-white font-semibold"
            >
              {restaurantFlow ? "Back to restaurant portal" : "Back to sign in"}
            </Link>
            {intent === "restaurant-login" && (
              <Link
                to="/restaurant/register"
                className="mt-4 text-sm font-semibold text-emerald-800"
              >
                Register a restaurant
              </Link>
            )}
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing you in…
          </div>
        )}
      </div>
    </MobileFrame>
  );
}
