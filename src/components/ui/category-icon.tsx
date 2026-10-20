// A category's icon on a tint of its color — used everywhere a category shows
// (the entry picker, the ledger, budgets, settings) instead of its first letter.
import { categoryIcon } from "@/lib/category-icons";
import { cn, tintText, vivid, withAlpha } from "@/lib/utils";

const SIZES = {
  sm: { box: "h-7 w-7", icon: "h-3.5 w-3.5" },
  md: { box: "h-8 w-8", icon: "h-4 w-4" },
  lg: { box: "h-9 w-9", icon: "h-[18px] w-[18px]" },
} as const;

export function CategoryIcon({
  name,
  icon,
  color,
  size = "md",
  className,
}: {
  name: string; // the stored (English) name — icons are picked from it
  icon?: string | null;
  color: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = categoryIcon(name, icon);
  const s = SIZES[size];
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-lg", s.box, className)}
      style={{ backgroundColor: withAlpha(vivid(color), 0.15), color: tintText(color) }}
    >
      <Icon className={s.icon} strokeWidth={2.25} />
    </span>
  );
}
