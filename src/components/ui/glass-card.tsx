"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  /** Stagger index for the orchestrated dashboard reveal. */
  delay?: number;
  /** Adds a hover lift + border brighten. */
  interactive?: boolean;
}

export function GlassCard({
  className,
  children,
  delay = 0,
  interactive = false,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "glass rounded-2xl p-5",
        interactive && "glass-hover cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
