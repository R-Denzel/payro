import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { MobileFrame, TopBar, PayroLogo } from "@/components/payro/Frame";
import { Check, Copy } from "lucide-react";
import { useProfile } from "@/lib/data";
import { requireProfileComplete } from "@/lib/route-guards";

export const Route = createFileRoute("/qr")({
  ssr: false,
  beforeLoad: requireProfileComplete,
  component: QR,
});

function QR() {
  const profile = useProfile();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const phone = profile.data?.phone ? `+${profile.data.phone}` : "";

  useEffect(() => {
    if (!profile.data?.phone) return;
    // Encodes the phone number so friends can add you to a group or send you money.
    QRCode.toDataURL(`tel:${phone}`, { margin: 1, width: 448, color: { dark: "#0f172a" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [profile.data?.phone, phone]);

  const copy = async () => {
    await navigator.clipboard.writeText(phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <MobileFrame showNav={false}>
      <TopBar back="/home" title="My QR code" />
      <div className="px-5">
        <div className="rounded-3xl payro-gradient-dark p-6 text-center relative overflow-hidden">
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
              {qr ? (
                <img src={qr} alt="Your QR code" className="w-full h-full" />
              ) : (
                <div className="h-full w-full animate-pulse rounded-xl bg-surface" />
              )}
            </div>
            <p className="mt-4 text-white text-lg font-bold">{profile.data?.full_name}</p>
            <p className="text-white/60 text-xs">{phone}</p>
            <button
              onClick={copy}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy my number"}
            </button>
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-muted-foreground px-4">
          Friends can scan this with their phone camera to get your number, then add you to a group
          in Payro.
        </p>
      </div>
    </MobileFrame>
  );
}
