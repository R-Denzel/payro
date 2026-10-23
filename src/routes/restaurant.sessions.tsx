import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RestaurantShell } from "@/components/payro/RestaurantPortal";
import { requireRestaurant } from "@/lib/restaurant-auth";
import { getSupabase } from "@/lib/supabase";
import { Check, Copy, QrCode, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { copyText } from "@/lib/utils";

export const Route = createFileRoute("/restaurant/sessions")({
  ssr: false,
  beforeLoad: requireRestaurant,
  component: Sessions,
});
function Sessions() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["restaurant-groups"],
    queryFn: async () => {
      const c = getSupabase()!;
      const {
        data: { user },
      } = await c.auth.getUser();
      const { data: m, error: me } = await c
        .from("restaurant_members")
        .select("role,restaurants(id,name,status)")
        .eq("user_id", user!.id)
        .limit(1)
        .single();
      if (me) throw me;
      const r = Array.isArray(m.restaurants) ? m.restaurants[0] : m.restaurants;
      const { data: sessionRows, error: sessionError } = await c
        .from("restaurant_sessions")
        .select("group_id")
        .eq("restaurant_id", r.id);
      if (sessionError) throw sessionError;
      const sessionIds = (sessionRows ?? []).map((row) => row.group_id);
      const { data: groups, error } = sessionIds.length
        ? await c
            .from("groups")
            .select("id,name,created_at,group_members(user_id)")
            .in("id", sessionIds)
            .order("created_at", { ascending: false })
        : { data: [], error: null };
      if (error) throw error;
      return { r, role: m.role, groups: groups ?? [] };
    },
  });
  if (q.isLoading) return <p>Loading group sessions…</p>;
  if (q.error) return <p>{q.error.message}</p>;
  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const c = getSupabase()!;
      if (q.data!.r.status === "rejected")
        throw new Error("This restaurant account is not eligible to create sessions.");
      const { data, error } = await c.rpc("create_restaurant_session", {
        _restaurant_id: q.data!.r.id,
        _name: name.trim(),
      });
      if (error) throw error;
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["restaurant-groups"] });
      if (data) await navigate({ to: "/restaurant/bills", search: { session: data } });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not create a session.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <RestaurantShell
      access={{
        id: q.data!.r.id,
        name: q.data!.r.name,
        role: q.data!.role,
        status: q.data!.r.status,
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Group sessions</h1>
          <p className="mt-2 text-slate-600">
            Create a restaurant session, invite guests who use Payro, then add their bill.
          </p>
        </div>
        <form onSubmit={createSession} className="flex gap-2">
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Session name"
            className="h-11 rounded-xl border bg-white px-3 text-sm"
          />
          <button
            disabled={busy || q.data!.r.status === "rejected"}
            className="rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "New session"}
          </button>
        </form>
      </div>
      {q.data!.r.status === "pending" && (
        <p className="mt-4 text-sm text-amber-800" role="status">
          Your restaurant is awaiting confirmation. You can create sessions now; bill publishing will be available after approval.
        </p>
      )}
      {q.data!.r.status === "rejected" && (
        <p className="mt-4 text-sm text-red-800" role="status">
          This restaurant account was not approved, so new sessions are unavailable.
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm text-emerald-900">
          {message}
        </p>
      )}
      <div className="mt-6 grid gap-3">
        {q.data!.groups.map((g) => (
          <article
            key={g.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5"
          >
            <div className="min-w-48 flex-1">
              <h2 className="font-semibold">{g.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {Math.max((g.group_members?.length ?? 0) - 1, 0)} guests · Started{" "}
                {new Date(g.created_at).toLocaleDateString()}
              </p>
              <InviteGuest groupId={g.id} />
              <SessionShare groupId={g.id} />
            </div>
            <a
              href={`/restaurant/bills?session=${g.id}`}
              className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900"
            >
              Add restaurant bill
            </a>
          </article>
        ))}
      </div>
      {!q.data!.groups.length && (
        <p className="mt-8 text-sm text-slate-500">
          No restaurant sessions yet. Create one above to start inviting guests and add a bill.
        </p>
      )}
    </RestaurantShell>
  );
}

function SessionShare({ groupId }: { groupId: string }) {
  const [inviteUrl, setInviteUrl] = useState("");
  const [qr, setQr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!inviteUrl) return;
    QRCode.toDataURL(inviteUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 360,
      color: { dark: "#153d2c", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setNotice("Could not create the QR code. You can still copy the invite link."));
  }, [inviteUrl]);

  async function createInvite() {
    setBusy(true);
    setNotice("");
    setQr("");
    try {
      const { data: token, error } = await getSupabase()!.rpc(
        "create_restaurant_session_invite",
        { _group_id: groupId },
      );
      if (error) throw error;
      if (!token) throw new Error("Could not create a session invite.");
      setInviteUrl(`${window.location.origin}/restaurant/join/${token}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create a session invite.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    try {
      await copyText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setNotice("Could not copy the link. Select and copy it below.");
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={createInvite}
        disabled={busy}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-900/10 bg-white px-3 text-xs font-semibold text-emerald-900 disabled:opacity-60"
      >
        <Share2 size={14} />
        {busy ? "Preparing invite…" : inviteUrl ? "Refresh session invite" : "Share session QR"}
      </button>
      {inviteUrl && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
          {qr ? (
            <img src={qr} alt="QR code to join this Payro session" className="h-28 w-28 rounded-lg bg-white p-1" />
          ) : (
            <span className="grid h-28 w-28 place-items-center rounded-lg bg-white text-emerald-800">
              <QrCode size={30} />
            </span>
          )}
          <div className="min-w-52 flex-1">
            <p className="text-xs font-semibold text-slate-700">Scan or share this invite link</p>
            <input
              readOnly
              aria-label="Session invite link"
              value={inviteUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-2 h-9 w-full rounded-lg border bg-white px-2 text-xs text-slate-600"
            />
            <button
              type="button"
              onClick={copyInvite}
              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-900 px-3 text-xs font-semibold text-white"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy invite link"}
            </button>
            <p className="mt-2 text-[11px] text-slate-500">Expires in 14 days; up to 100 guests can join.</p>
          </div>
        </div>
      )}
      {notice && <p role="status" className="mt-2 text-xs text-amber-800">{notice}</p>}
    </div>
  );
}

function InviteGuest({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function addGuest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const { error } = await getSupabase()!.rpc("add_group_member_by_phone", {
        _group_id: groupId,
        _phone: phone,
      });
      if (error) throw error;
      setPhone("");
      setNotice("Guest added. They can find this session in their Payro app.");
      await queryClient.invalidateQueries({ queryKey: ["restaurant-groups"] });
    } catch (e) {
      const detail = e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e && typeof e.message === "string"
          ? e.message
          : "";
      setNotice(detail || "Could not add guest.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={addGuest} className="mt-3 flex flex-wrap items-center gap-2">
      <input
        required
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Guest phone number"
        className="h-9 rounded-lg border px-3 text-xs"
      />
      <button
        disabled={busy}
        className="h-9 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-emerald-900"
      >
        {busy ? "Adding…" : "Add guest"}
      </button>
      {notice && (
        <span role="status" className="text-xs text-slate-600">
          {notice}
        </span>
      )}
      {!notice && (
        <span className="basis-full text-[11px] text-slate-500">
          Add an existing Payro account by phone, or use Share session QR to invite someone new.
        </span>
      )}
    </form>
  );
}
