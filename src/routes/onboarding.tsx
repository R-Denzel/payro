import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MobileFrame } from "@/components/payro/Frame";
import { Users, Zap, ScanLine } from "lucide-react";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

const slides = [
  {
    icon: Users,
    title: "Split expenses effortlessly",
    body: "Share bills with friends, family, and groups. Payro tracks who owes what — down to the last cent.",
    tint: "from-emerald-100 to-emerald-50",
  },
  {
    icon: Zap,
    title: "Pay instantly with Mobile Money",
    body: "M-Pesa, Airtel Money, MTN MoMo — settle up in seconds without leaving the app.",
    tint: "from-amber-100 to-amber-50",
  },
  {
    icon: ScanLine,
    title: "Scan receipts with AI",
    body: "Snap a photo. Our AI reads the receipt, itemizes it, and suggests a fair split.",
    tint: "from-sky-100 to-sky-50",
  },
];

function Onboarding() {
  const [i, setI] = useState(0);
  const nav = useNavigate();
  const s = slides[i];
  const Icon = s.icon;
  const next = () => (i < 2 ? setI(i + 1) : nav({ to: "/auth" }));
  return (
    <MobileFrame showNav={false}>
      <div className="flex flex-col h-full px-6 pt-4">
        <div className="flex justify-between items-center">
          <div className="flex gap-1.5">
            {slides.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-8 bg-primary" : "w-1.5 bg-border"}`}
              />
            ))}
          </div>
          <button
            onClick={() => nav({ to: "/auth" })}
            className="text-sm text-muted-foreground font-medium"
          >
            Skip
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div
            className={`h-56 w-56 rounded-[40px] bg-gradient-to-br ${s.tint} flex items-center justify-center relative`}
          >
            <div className="absolute inset-4 rounded-[32px] bg-white/60 backdrop-blur border border-white shadow-soft flex items-center justify-center">
              <Icon className="h-20 w-20 text-primary" strokeWidth={1.5} />
            </div>
            <div className="absolute -top-2 -right-2 h-10 w-10 rounded-2xl payro-gradient shadow-glow" />
            <div className="absolute -bottom-3 -left-3 h-8 w-8 rounded-xl bg-navy" />
          </div>
          <h2
            className="mt-12 text-2xl font-bold text-navy leading-tight px-4 animate-fade-in"
            key={i}
          >
            {s.title}
          </h2>
          <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed px-2">{s.body}</p>
        </div>

        <div className="pb-8">
          <button
            onClick={next}
            className="w-full h-14 rounded-2xl payro-gradient text-white font-semibold text-[15px] shadow-glow active:scale-[0.99] transition"
          >
            {i < 2 ? "Continue" : "Get Started"}
          </button>
          <Link to="/auth" className="block text-center mt-4 text-sm text-muted-foreground">
            Already have an account? <span className="text-primary font-semibold">Sign in</span>
          </Link>
        </div>
      </div>
    </MobileFrame>
  );
}
