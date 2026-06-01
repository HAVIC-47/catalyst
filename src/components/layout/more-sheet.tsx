"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  LayoutGrid,
  Receipt,
  PiggyBank,
  Target,
  Bell,
  NotebookPen,
  Settings,
  Sun,
  Moon,
  LogOut,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ALL_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/app", label: "Calendar", icon: CalendarDays },
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/app/transactions", label: "Transactions", icon: Receipt },
  { href: "/app/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/app/goals", label: "Goals", icon: Target },
  { href: "/app/bills", label: "Bills", icon: Bell },
  { href: "/app/journal", label: "Journal", icon: NotebookPen },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    setDark(next);
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    onClose();
    router.push("/login");
    router.refresh();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="All sections"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="card relative z-10 w-full rounded-b-none rounded-t-2xl p-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="label">All sections</span>
              <button
                onClick={onClose}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-1 text-ink/45 transition-colors hover:bg-ink/[0.05] hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {/* nav grid */}
            <div className="grid grid-cols-4 gap-2">
              {ALL_NAV.map(({ href, label, icon: Icon }) => {
                const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      "flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border text-[11px] font-medium transition-colors duration-200",
                      active
                        ? "border-amber/40 bg-amber/[0.08] text-amber"
                        : "border-line text-ink/60 hover:bg-ink/[0.04] hover:text-ink",
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                    {label}
                  </Link>
                );
              })}
            </div>

            {/* theme + sign out */}
            <div className="mt-4 space-y-2 border-t border-line pt-4">
              <button
                onClick={toggleTheme}
                className="flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-xl border border-line px-4 text-sm text-ink/80 transition-colors hover:bg-ink/[0.04]"
              >
                {dark ? <Sun className="h-4 w-4 text-amber" aria-hidden /> : <Moon className="h-4 w-4 text-amber" aria-hidden />}
                {dark ? "Light mode" : "Dark mode"}
              </button>
              <button
                onClick={signOut}
                className="flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-xl border border-line px-4 text-sm text-ink/80 transition-colors hover:border-expense/40 hover:text-expense"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
                {email && <span className="ml-auto truncate text-xs text-ink/40">{email}</span>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
