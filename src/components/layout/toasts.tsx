"use client";

// Short notices at the bottom of the screen: budget alerts, "Paid — Undo" and the
// like. They clear themselves after a few seconds.
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Info, X } from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

export function Toasts() {
  const { toasts, dismissToast } = useAppData();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottomnav-h)+12px)] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "card pointer-events-auto flex w-full max-w-md items-center gap-3 bg-card px-4 py-3 text-sm shadow-2xl",
              t.tone === "warn" && "border-amber/40",
            )}
          >
            {t.tone === "warn" ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber" aria-hidden />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-ink/50" aria-hidden />
            )}
            <span className="min-w-0 flex-1 text-ink/85">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  dismissToast(t.id);
                  void t.action!.run();
                }}
                className="shrink-0 cursor-pointer rounded-lg px-2 py-1 font-mono text-[11px] uppercase tracking-widest text-amber transition-colors hover:bg-amber/10"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label={tr("Dismiss")}
              className="shrink-0 cursor-pointer rounded-lg p-1 text-ink/35 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
