import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart3,
  Banknote,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Utensils,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/restaurant/preview")({ component: RestaurantPreview });

const sections = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Group sessions", icon: Users },
  { label: "Restaurant bills", icon: ClipboardList },
  { label: "Settlements", icon: Banknote },
  { label: "Reports", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

function RestaurantPreview() {
  const [section, setSection] = useState("Overview");
  return (
    <div className="min-h-dvh bg-[#f5f5f0] text-[#17251d] md:flex">
      <aside className="bg-[#153d2c] px-4 py-5 text-white md:fixed md:inset-y-0 md:w-64 md:px-5">
        <Link to="/restaurant" className="flex items-center gap-3 px-2 text-lg font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Utensils size={19} /></span>
          <span>Payro<small className="block text-xs font-medium text-emerald-200">for Restaurants</small></span>
        </Link>
        <div className="mt-8 rounded-2xl bg-white/10 p-3">
          <p className="truncate text-sm font-semibold">The Green Table</p>
          <p className="mt-1 text-xs text-emerald-100/70">Demo restaurant · Owner</p>
        </div>
        <nav className="mt-7 grid grid-cols-3 gap-1 sm:grid-cols-6 md:grid-cols-1">
          {sections.map(({ label, icon: Icon }) => (
            <button key={label} onClick={() => setSection(label)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${section === label ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10"}`}>
              <Icon size={17} /><span className="hidden md:inline">{label}</span><span className="md:hidden">{label.split(" ")[0]}</span>
            </button>
          ))}
        </nav>
        <Link to="/restaurant" className="mt-8 inline-block px-3 text-sm text-white/65 hover:text-white">Back to restaurant page</Link>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-10 pt-6 sm:px-7 md:ml-64 md:px-9 md:pt-9">
        <div className="mb-7 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          <strong>Demo preview.</strong> Sample data only; changes and payments are not saved.
        </div>
        <p className="text-sm font-medium text-emerald-800">Westlands, Nairobi</p>
        <h1 className="mt-1 text-3xl font-semibold">{section}</h1>
        <p className="mt-2 text-slate-600">Explore the restaurant workspace using sample activity.</p>
        {section === "Overview" && <Overview />}
        {section === "Group sessions" && <DataTable title="Recent group sessions" rows={[["Table 12 · Friday dinner", "6 guests", "KES 8,450", "Active"], ["Garden brunch", "4 guests", "KES 5,200", "Settled"], ["Birthday table", "8 guests", "KES 12,600", "Active"]]} />}
        {section === "Restaurant bills" && <DataTable title="Restaurant bills" rows={[["Dinner · Table 12", "Friday dinner", "KES 8,450", "Open"], ["Brunch · Garden", "Garden brunch", "KES 5,200", "Settled"], ["Birthday menu", "Birthday table", "KES 12,600", "Open"]]} />}
        {section === "Settlements" && <DataTable title="Payment settlements" rows={[["M-Pesa · 4821", "Table 12", "KES 3,200", "Confirmed"], ["M-Pesa · 1904", "Garden brunch", "KES 5,200", "Confirmed"], ["M-Pesa · 7730", "Birthday table", "KES 4,000", "Pending"]]} />}
        {section === "Reports" && <Overview reports />}
        {section === "Settings" && <div className="mt-8 max-w-2xl rounded-3xl border border-black/5 bg-white p-6"><h2 className="text-lg font-semibold">Restaurant profile</h2><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Business name</dt><dd className="mt-1 font-semibold">The Green Table</dd></div><div><dt className="text-slate-500">Category</dt><dd className="mt-1 font-semibold">Restaurant</dd></div><div><dt className="text-slate-500">Location</dt><dd className="mt-1 font-semibold">Westlands, Nairobi</dd></div><div><dt className="text-slate-500">Application status</dt><dd className="mt-1 font-semibold text-emerald-800">Approved</dd></div></dl></div>}
      </main>
    </div>
  );
}

function Overview({ reports = false }: { reports?: boolean }) {
  return <>
    <section className="mt-8 grid gap-4 sm:grid-cols-3">
      <Metric title={reports ? "Bills this month" : "Active group sessions"} value={reports ? "42" : "3"} icon={<Users />} />
      <Metric title={reports ? "Average bill" : "Outstanding balance"} value={reports ? "KES 6,280" : "KES 14,750"} icon={<ClipboardList />} />
      <Metric title={reports ? "Settled this month" : "Settled in Payro"} value={reports ? "KES 186,400" : "KES 186,400"} icon={<Banknote />} />
    </section>
    <DataTable title="Recent restaurant bills" rows={[["Dinner · Table 12", "Friday dinner", "KES 8,450", "Open"], ["Brunch · Garden", "Garden brunch", "KES 5,200", "Settled"], ["Birthday menu", "Birthday table", "KES 12,600", "Open"]]} />
  </>;
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return <article className="rounded-2xl border border-black/5 bg-white p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800">{icon}</span><p className="mt-5 text-sm text-slate-500">{title}</p><p className="mt-1 text-2xl font-semibold">{value}</p></article>;
}

function DataTable({ title, rows }: { title: string; rows: string[][] }) {
  return <section className="mt-8 rounded-3xl border border-black/5 bg-white p-5 sm:p-7"><h2 className="text-lg font-semibold">{title}</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-slate-400"><tr>{["Bill / session", "Details", "Amount", "Status"].map((h) => <th key={h} className="py-3">{h}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]} className="border-t border-slate-100">{row.map((value, i) => <td key={i} className={`py-4 ${i === 0 ? "font-semibold" : ""}`}>{value}</td>)}</tr>)}</tbody></table></div></section>;
}
