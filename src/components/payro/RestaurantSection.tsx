import { useQuery } from "@tanstack/react-query";
import { RestaurantShell } from "@/components/payro/RestaurantPortal";
import { getRestaurantAccess } from "@/lib/restaurant-auth";
import { getSupabase } from "@/lib/supabase";
import { formatMoney } from "@/lib/money";

export function RestaurantSection({ kind }: { kind: "settlements" | "reports" | "settings" }) {
  const q = useQuery({
    queryKey: ["restaurant-section", kind],
    queryFn: async () => {
      const c = getSupabase()!;
      const access = await getRestaurantAccess();
      if (!access) throw new Error("Restaurant account not found");
      const { data: expenses, error } = await c
        .from("expenses")
        .select("id,merchant,total_cents,status,created_at")
        .eq("restaurant_id", access.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { access, expenses: expenses ?? [] };
    },
  });
  if (q.isLoading) return <p>Loading…</p>;
  if (q.error) return <p role="alert">{q.error.message}</p>;
  const { access, expenses } = q.data!;
  const settled = expenses.filter((e) => e.status === "settled");
  return (
    <RestaurantShell access={access}>
      <h1 className="text-3xl font-semibold">
        {kind === "settlements"
          ? "Settlements"
          : kind === "reports"
            ? "Reports"
            : "Restaurant settings"}
      </h1>
      <p className="mt-2 text-slate-600">
        {kind === "settlements"
          ? "Payment and settlement status from verified Payro transaction records."
          : kind === "reports"
            ? "A summary of bills recorded for your restaurant."
            : "Restaurant profile and application status."}
      </p>
      {kind === "settlements" && (
        <div className="mt-6 rounded-3xl bg-white p-5">
          <p className="text-sm text-slate-500">Bills marked settled</p>
          <p className="mt-2 text-3xl font-semibold">
            {formatMoney(settled.reduce((n, e) => n + Number(e.total_cents), 0))}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Settlement values reflect completed bill records. Transaction transfers are handled by
            Payro payment services.
          </p>
        </div>
      )}
      {kind === "reports" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Total bills" value={String(expenses.length)} />
          <Metric
            label="Open bills"
            value={String(expenses.filter((e) => e.status === "open").length)}
          />
          <Metric
            label="Settled value"
            value={formatMoney(settled.reduce((n, e) => n + Number(e.total_cents), 0))}
          />
        </div>
      )}
      {kind === "settings" && (
        <div className="mt-6 max-w-2xl rounded-3xl bg-white p-6">
          <p className="text-sm text-slate-500">Restaurant</p>
          <p className="mt-1 text-xl font-semibold">{access.name}</p>
          <p className="mt-4 text-sm text-slate-500">Application status</p>
          <p className="mt-1 inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold capitalize text-amber-900">
            {access.status}
          </p>
          <p className="mt-5 text-sm leading-6 text-slate-600">
            PayHero payments are being connected to each restaurant's own Till or Paybill. Payro
            must verify and link the restaurant's registered PayHero channel before customers can
            pay by M-Pesa. Contact Payro support if your restaurant's channel needs to be linked.
          </p>
        </div>
      )}
      <div className="mt-6 overflow-x-auto rounded-3xl bg-white p-5">
        <h2 className="font-semibold">
          {kind === "settlements" ? "Bill settlement history" : "Restaurant bill activity"}
        </h2>
        <table className="mt-4 w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-400">
            <tr>
              <th className="py-3">Bill</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="py-4 font-medium">{e.merchant}</td>
                <td>{formatMoney(Number(e.total_cents))}</td>
                <td className="capitalize">{e.status}</td>
                <td>{new Date(e.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RestaurantShell>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}
