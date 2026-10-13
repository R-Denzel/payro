import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { MobileFrame } from "@/components/payro/Frame";
import { completeOAuthSignIn } from "@/lib/supabase-auth";

// Google (via Supabase) redirects here with ?code=… or ?error_description=….
export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  component: AuthCallback,
});

function AuthCallback() {
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // The code is single-use; don't exchange it twice (StrictMode double effects).
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setError(params.get("error_description") ?? "Google sign-in was cancelled.");
      return;
    }
    completeOAuthSignIn(code)
      .then((s) => nav({ to: s.fullName ? "/home" : "/setup", replace: true }))
      .catch((e) => setError(e instanceof Error ? e.message : "Google sign-in failed"));
  }, [nav]);

  return (
    <MobileFrame showNav={false}>
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        {error ? (
          <>
            <h1 className="text-xl font-bold text-navy">Couldn't sign you in</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Link
              to="/auth"
              className="mt-6 inline-flex h-12 px-6 items-center rounded-2xl payro-gradient text-white font-semibold"
            >
              Back to sign in
            </Link>
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
