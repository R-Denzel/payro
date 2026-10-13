import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MobileFrame, PayroLogo } from "@/components/payro/Frame";
import { FieldError } from "@/components/payro/States";
import { getStoredSession } from "@/lib/auth-store";
import { useUpdateProfile } from "@/lib/data";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/setup")({
  ssr: false,
  beforeLoad: requireAuth,
  component: Setup,
});

function Setup() {
  const [name, setName] = useState(getStoredSession()?.fullName ?? "");
  const update = useUpdateProfile();
  const nav = useNavigate();

  const save = () => {
    if (name.trim().length < 2) return;
    update.mutate({ full_name: name }, { onSuccess: () => nav({ to: "/home" }) });
  };

  return (
    <MobileFrame showNav={false}>
      <div className="px-6 pt-4 flex flex-col h-full">
        <PayroLogo className="h-10 w-10 lg:hidden" />
        <h1 className="mt-10 text-3xl font-bold text-navy leading-tight">What's your name?</h1>
        <p className="mt-2 text-muted-foreground">
          Friends see this when you split bills with them.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="e.g. Amara Kimani"
          className="mt-8 h-14 rounded-2xl border border-border bg-surface px-4 text-[15px] font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
        <FieldError error={update.error} />
        <button
          onClick={save}
          disabled={name.trim().length < 2 || update.isPending}
          className="mt-6 w-full h-14 rounded-2xl payro-gradient text-white font-semibold shadow-glow disabled:opacity-60"
        >
          {update.isPending ? "Saving…" : "Continue"}
        </button>
      </div>
    </MobileFrame>
  );
}
