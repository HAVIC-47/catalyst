import { LandingNav } from "@/components/landing/landing-nav";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LandingNav />
      <div className="flex min-h-screen items-center justify-center px-4 pb-12 pt-28">
        {children}
      </div>
    </>
  );
}
