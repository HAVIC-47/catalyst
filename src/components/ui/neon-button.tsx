"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  accent?: "cyan" | "purple";
  variant?: "solid" | "ghost";
}

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(function NeonButton(
  { className, accent = "cyan", variant = "solid", children, ...props },
  ref,
) {
  const accents = {
    cyan: {
      solid:
        "bg-neon-cyan/15 text-neon-cyan border-neon-cyan/40 hover:bg-neon-cyan/25 hover:shadow-neon-cyan",
      ghost: "text-neon-cyan/90 border-transparent hover:bg-neon-cyan/10",
    },
    purple: {
      solid:
        "bg-neon-purple/15 text-neon-purple border-neon-purple/40 hover:bg-neon-purple/25 hover:shadow-neon-purple",
      ghost: "text-neon-purple/90 border-transparent hover:bg-neon-purple/10",
    },
  } as const;

  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        accents[accent][variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
