import { LandingNav } from "@/components/landing/landing-nav";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { Why } from "@/components/landing/why";
import { CtaFooter } from "@/components/landing/cta-footer";

// Public landing — middleware allows this for anyone, authenticated or not.
export default function LandingPage() {
  return (
    <div className="relative">
      <LandingNav />
      <Hero />
      <Features />
      <Why />
      <CtaFooter />
    </div>
  );
}
