import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MobileFrame, TopBar, PayroLogo } from "@/components/payro/Frame";
import { ScanLine, Share2, Copy } from "lucide-react";

export const Route = createFileRoute("/qr")({ component: QR });

function QR() {
  const [tab, setTab] = useState<"receive" | "scan">("receive");
  return (
    <MobileFrame showNav={false}>
      <TopBar
        back="/home"
        title="QR Payment"
        right={
          <button className="h-10 w-10 rounded-full bg-surface border border-black/5 flex items-center justify-center">
            <Share2 className="h-4 w-4" />
          </button>
        }
      />

      <div className="px-5">
        <div className="rounded-2xl bg-surface p-1 flex">
          {(["receive", "scan"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-10 rounded-xl text-sm font-semibold capitalize transition ${tab === t ? "bg-white shadow-soft text-navy" : "text-muted-foreground"}`}
            >
              {t === "receive" ? "My QR" : "Scan"}
            </button>
          ))}
        </div>

        {tab === "receive" ? (
          <div className="mt-5 rounded-3xl payro-gradient-dark p-6 text-center relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: "radial-gradient(400px 300px at 50% 20%, #10B981 0%, transparent 60%)",
              }}
            />
            <div className="relative">
              <div className="flex items-center justify-center gap-2 mb-4">
                <PayroLogo className="h-6 w-6" />
                <span className="text-white font-bold">Payro</span>
              </div>
              <div className="mx-auto w-56 h-56 bg-white rounded-2xl p-3 flex items-center justify-center">
                <FakeQR />
              </div>
              <p className="mt-4 text-white text-lg font-bold">Amara Kimani</p>
              <p className="text-white/60 text-xs">@amara.k · +254 712 345 678</p>
              <button className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold">
                <Copy className="h-3.5 w-3.5" />
                payro.me/amara.k
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-3xl bg-black aspect-square relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-40"
              style={{ background: "radial-gradient(circle at center, #333 0%, #000 60%)" }}
            />
            {[
              "top-6 left-6 border-t-2 border-l-2 rounded-tl-2xl",
              "top-6 right-6 border-t-2 border-r-2 rounded-tr-2xl",
              "bottom-6 left-6 border-b-2 border-l-2 rounded-bl-2xl",
              "bottom-6 right-6 border-b-2 border-r-2 rounded-br-2xl",
            ].map((c) => (
              <div key={c} className={`absolute h-14 w-14 border-primary ${c}`} />
            ))}
            <div
              className="absolute inset-x-6 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_theme(colors.emerald.400)]"
              style={{ animation: "scanY 2s ease-in-out infinite", top: "50%" }}
            />
            <style>{`@keyframes scanY {0%,100%{top:20%}50%{top:80%}}`}</style>
            <div className="absolute inset-x-0 bottom-6 text-center text-white/70 text-sm flex items-center justify-center gap-2">
              <ScanLine className="h-4 w-4" />
              Align QR code inside the frame
            </div>
          </div>
        )}

        <Link
          to="/pay"
          className="mt-5 flex items-center gap-3 p-4 rounded-2xl bg-white border border-border"
        >
          <div className="h-10 w-10 rounded-xl bg-emerald-100 text-primary flex items-center justify-center text-xs font-bold">
            ₽
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-navy">Or send instantly</p>
            <p className="text-xs text-muted-foreground">Search by name, phone, or @handle</p>
          </div>
          <span className="text-primary text-lg">›</span>
        </Link>
      </div>
    </MobileFrame>
  );
}

function FakeQR() {
  // simple stylized QR mock (deterministic pattern)
  const cells = Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21,
      y = Math.floor(i / 21);
    const corner = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    if (corner) return null;
    return (x * 7 + y * 3 + ((x * y) % 5)) % 3 === 0;
  });
  return (
    <div
      className="grid grid-cols-21 gap-[1px] w-full h-full"
      style={{ gridTemplateColumns: "repeat(21,1fr)" }}
    >
      {cells.map((c, i) => {
        const x = i % 21,
          y = Math.floor(i / 21);
        const corner = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
        if (corner) {
          const inFinder =
            x === 0 ||
            x === 6 ||
            y === 0 ||
            y === 6 ||
            (x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
            (x >= 13 &&
              x <= 20 &&
              (x === 14 ||
                x === 20 ||
                y === 0 ||
                y === 6 ||
                (x >= 16 && x <= 18 && y >= 2 && y <= 4))) ||
            (y >= 14 &&
              (x === 0 ||
                x === 6 ||
                y === 14 ||
                y === 20 ||
                (x >= 2 && x <= 4 && y >= 16 && y <= 18)));
          return <div key={i} className={inFinder ? "bg-navy" : "bg-transparent"} />;
        }
        return <div key={i} className={c ? "bg-navy" : "bg-transparent"} />;
      })}
    </div>
  );
}
