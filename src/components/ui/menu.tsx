"use client";

// "…" button with a small dropdown of actions. The list renders in a portal at a
// fixed position, so scrolling containers (the board) never clip it. Closes on
// outside click, Escape, scroll, resize, or after a pick.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export function Menu({ label, items, className }: { label: string; items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !button.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    // Move focus into the list so it can be used from the keyboard.
    list.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, pos]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink/45 transition-colors hover:bg-ink/[0.05] hover:text-ink",
          open && "bg-ink/[0.05] text-ink",
          className,
        )}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={list}
            role="menu"
            aria-label={label}
            style={{ top: pos.top, right: pos.right }}
            className="card fixed z-50 min-w-[176px] p-1"
          >
            {items.map(({ label: text, icon: Icon, onSelect, danger, disabled }) => (
              <button
                key={text}
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={() => {
                  setOpen(false);
                  onSelect();
                }}
                className={cn(
                  "flex min-h-[38px] w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors disabled:cursor-default disabled:opacity-35",
                  danger ? "text-expense hover:bg-expense/10" : "text-ink/80 hover:bg-ink/[0.05] hover:text-ink",
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
                {text}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
