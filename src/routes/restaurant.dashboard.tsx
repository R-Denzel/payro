import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Banknote, ClipboardList, Users } from "lucide-react";
import { RestaurantShell } from "@/components/payro/RestaurantPortal";
import { requireRestaurant } from "@/lib/restaurant-auth";
import { getSupabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/money";

export const Route = createFileRoute("/restaurant/dashboard")({
  ssr: false,
  beforeLoad: requireRestaurant,
  component: Dashboard,
});
function Dashboard() {
  const access = Route.useRouteContext() as unknown as { access?: never };
  void access;
  const q = useQuery({
    queryKey: ["restaurant-dashboard"],
    queryFn: async () => {
      const c = getSupabase()!;
      const {
        data: { user },
      } = await c.auth.getUser();
      const { data: member, error } = await c
        .from("restaurant_members")
        .select("role,restaurants(id,name,status,location)")
        .eq("user_id", user!.id)
        .limit(1)
        .single();
      if (error) throw error;
      const r = Array.isArray(member.restaurants) ? member.restaurants[0] : member.restaurants;
      const { data: expenses, error: e } = await c
        .from("expenses")
        .select(
          "id,merchant,group_id,total_cents,status,created_at,expense_participants(amount_due_cents,amount_paid_cents)",
        )
        .eq("restaurant_id", r.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (e) throw e;
      return { restaurant: r, role: member.role, expenses: expenses ?? [] };
    },
  });
  if (q.isLoading) return <p className="text-slate-500">Loading your restaurant…</p>;
  if (q.error)
    return (
      <p role="alert" className="text-red-700">
        {q.error.message}
      </p>
    );
  const { restaurant, role, expenses } = q.data!;
  const active = expenses.filter((e) => e.status === "open");
  const awaiting = active.length;
  const settled = expenses
    .filter((e) => e.status === "settled")
    .reduce((n, e) => n + Number(e.total_cents), 0);
  const outstanding = active.reduce(
    (n, e) =>
      n +
      Math.max(
        0,
        Number(e.total_cents) -
          (e.expense_participants ?? []).reduce((s, p) => s + Number(p.amount_paid_cents), 0),
      ),
    0,
  );
  return (
    <RestaurantShell
      access={{ id: restaurant.id, name: restaurant.name, role, status: restaurant.status }}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-800">{restaurant.location}</p>
          <h1 className="mt-1 text-3xl font-semibold">Good service starts here.</h1>
          <p className="mt-2 text-slate-600">Here’s what’s happening at {restaurant.name}.</p>
        </div>
        <a
          href="/restaurant/bills"
          className="rounded-full bg-emerald-800 px-5 py-3 text-sm font-semibold text-white"
        >
          Create a bill
        </a>
      </div>
      {restaurant.status !== "approved" && (
        <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Application {restaurant.status}.</strong>{" "}
          {restaurant.status === "pending"
            ? "Your profile is under review. You can explore the portal while approval is pending; publishing bills is disabled until approval."
            : "Contact Payro support to discuss your application."}
        </div>
      )}
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Metric title="Active group sessions" value={String(awaiting)} icon={<Users />} />
        <Metric
          title="Outstanding balance"
          value={formatMoney(outstanding)}
          icon={<ClipboardList />}
        />
        <Metric title="Settled in Payro" value={formatMoney(settled)} icon={<Banknote />} />
      </section>
      <section className="mt-8 rounded-3xl border border-black/5 bg-white p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Recent restaurant bills</h2>
            <p className="mt-1 text-sm text-slate-500">Your latest Payro group activity</p>
          </div>
          <a className="text-sm font-semibold text-emerald-800" href="/restaurant/bills">
            View all
          </a>
        </div>
        {expenses.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Bills linked to your restaurant will show up here.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3">Bill</th>
                  <th>Session</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.slice(0, 8).map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="py-4 font-semibold">{e.merchant || "Restaurant bill"}</td>
                    <td>{e.group_id ? "Payro group session" : "Standalone bill"}</td>
                    <td>{formatMoney(Number(e.total_cents))}</td>
                    <td>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-800">
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="mt-5 text-xs text-slate-400">
        Signed in as {role}. Only records authorised for this restaurant are shown.
      </p>
    </RestaurantShell>
  );
}
function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-black/5 bg-white p-5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
        {icon}
      </span>
      <p className="mt-5 text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </article>
  );
}
