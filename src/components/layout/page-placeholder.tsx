import type { LucideIcon } from "lucide-react";

export function PagePlaceholder({
  kicker,
  title,
  accent,
  blurb,
  icon: Icon,
}: {
  kicker: string;
  title: string;
  accent: string;
  blurb: string;
  icon: LucideIcon;
}) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="label mb-2">{kicker}</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-white sm:text-6xl">
          {title} <span className="serif-italic text-amber/90">{accent}</span>
        </h1>
      </div>
      <div className="card flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white/[0.02]">
          <Icon className="h-6 w-6 text-amber" aria-hidden />
        </div>
        <h2 className="font-display text-2xl font-semibold text-white">Coming next</h2>
        <p className="mt-2 max-w-sm text-sm text-white/45">{blurb}</p>
      </div>
    </div>
  );
}
