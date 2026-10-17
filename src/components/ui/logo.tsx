// The Catalyst logo: the light picture on the light theme, the dark one on the
// dark theme. (The favicon follows the system setting instead — public/icon.svg.)
import { cn } from "@/lib/utils";

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-block shrink-0", className)} style={{ width: size, height: size }}>
      <img src="/brand/mark-light.png" alt="" width={size} height={size} className="block dark:hidden" />
      <img src="/brand/mark-dark.png" alt="" width={size} height={size} className="hidden dark:block" />
    </span>
  );
}
