import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, QrCode, ShieldCheck, Utensils } from "lucide-react";

export const Route = createFileRoute("/restaurant/")({ component: RestaurantLanding });

function RestaurantLanding() {
  return (
    <main className="min-h-dvh bg-[#f5f5f0] text-[#17251d]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2 font-black text-xl">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-700 text-white">
            <Utensils size={18} />
          </span>
          Payro <span className="font-medium text-emerald-800">for Restaurants</span>
        </Link>
        <Link
          to="/restaurant/login"
          className="rounded-full border border-emerald-900/15 px-5 py-2.5 text-sm font-semibold"
        >
          Partner login
        </Link>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-800">
            A smoother close to every meal
          </p>
          <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Your table. Your bill. Everyone settled.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
            Bring your group dining bills into Payro. Guests split and pay in their usual app while
            your team keeps track in one place.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/restaurant/register"
              className="flex items-center gap-2 rounded-full bg-emerald-800 px-6 py-3.5 font-semibold text-white"
            >
              Register your restaurant <ArrowRight size={17} />
            </Link>
            <Link
              to="/restaurant/login"
              className="rounded-full bg-white px-6 py-3.5 font-semibold"
            >
              Sign in
            </Link>
            <Link
              to="/restaurant/preview"
              className="rounded-full border border-emerald-900/15 px-6 py-3.5 font-semibold text-emerald-900"
            >
              Explore demo portal
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck size={17} className="text-emerald-700" />
            Private access for your restaurant team
          </div>
        </div>
        <div className="rounded-[2rem] bg-[#153d2c] p-7 text-white shadow-2xl sm:p-10">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-emerald-100/70">YOUR RESTAURANT</p>
              <h2 className="mt-1 text-2xl font-semibold">Group bill workflow</h2>
            </div>
            <span className="h-fit rounded-full bg-emerald-200/15 px-3 py-1.5 text-xs text-emerald-100">
              Payro sessions
            </span>
          </div>
          <div className="mt-8 rounded-2xl bg-white p-5 text-[#17251d]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Publish a bill to a group</p>
                <p className="mt-1 text-xl font-semibold">Track guest payments</p>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#eff5ef] text-emerald-800">
                <QrCode />
              </div>
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/2 rounded-full bg-emerald-600" />
            </div>
            <div className="mt-3 flex justify-between text-xs text-slate-500">
              <span>Confirmed payments</span>
              <span>Remaining balance</span>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-white/65">Bill status</p>
              <p className="mt-2 text-xl font-semibold">Live updates</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-white/65">Guest experience</p>
              <p className="mt-2 text-xl font-semibold">Regular Payro app</p>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 sm:grid-cols-3">
        {[
          [
            CheckCircle2,
            "Keep the floor moving",
            "Share the bill without gathering everyone around one card machine.",
          ],
          [
            QrCode,
            "Guests stay in Payro",
            "Your guests join from a QR code or link and pay in the familiar customer app.",
          ],
          [
            ShieldCheck,
            "See confirmed payments",
            "Track verified payment records and remaining balances for each bill.",
          ],
        ].map(([Icon, title, body]) => {
          const I = Icon as typeof CheckCircle2;
          return (
            <article
              key={title as string}
              className="rounded-3xl border border-emerald-900/10 bg-white p-6"
            >
              <I className="text-emerald-800" />
              <h3 className="mt-4 font-semibold">{title as string}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body as string}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}

