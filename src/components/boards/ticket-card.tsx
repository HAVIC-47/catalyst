import { parseISO } from "date-fns";
import { AlignLeft, CalendarClock, ChevronsDown, ChevronsUp, Equal } from "lucide-react";
import type { BoardKind, Ticket, TicketPriority } from "@/types";
import { cn, formatCurrency, toDateKey, fmt } from "@/lib/utils";
import { tr } from "@/lib/i18n";

const PRIORITY: Record<TicketPriority, { icon: typeof ChevronsUp; color: string; label: string }> = {
  high: { icon: ChevronsUp, color: "rgb(var(--c-expense))", label: "High priority" },
  medium: { icon: Equal, color: "#B59A3C", label: "Medium priority" },
  low: { icon: ChevronsDown, color: "rgb(var(--c-saving))", label: "Low priority" },
};

export function PriorityIcon({ priority, className }: { priority: TicketPriority; className?: string }) {
  const { icon: Icon, color, label } = PRIORITY[priority];
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", className)} style={{ color }} aria-label={tr(label)} role="img" />;
}

/** A ticket as it sits on the board (also the floating copy while dragging). */
export function TicketCard({
  ticket,
  kind,
  done,
  lifted,
}: {
  ticket: Ticket;
  kind: BoardKind;
  done: boolean; // in the board's last column
  lifted?: boolean;
}) {
  const overdue = !done && !!ticket.dueOn && ticket.dueOn < toDateKey(new Date());
  return (
    <div
      className={cn(
        "card p-3 text-left transition-shadow",
        lifted ? "rotate-[1.5deg] ring-1 ring-amber/40 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.45)]" : "hover:border-ink/25",
      )}
    >
      <p className={cn("break-words text-sm leading-snug text-ink/90", done && "text-ink/50 line-through decoration-ink/30")}>
        {ticket.title}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-ink/45">
        <PriorityIcon priority={ticket.priority} />
        <span>#{ticket.number}</span>
        {ticket.dueOn && (
          <span className={cn("inline-flex items-center gap-1", overdue && "text-expense")}>
            <CalendarClock className="h-3 w-3" aria-hidden />
            <span className="sr-only">{overdue ? tr("Overdue, due") : tr("Due")}</span>
            {fmt(parseISO(ticket.dueOn), "MMM d")}
          </span>
        )}
        {ticket.description && <AlignLeft className="h-3 w-3" aria-label={tr("Has a description")} role="img" />}
        {kind === "shopping" && ticket.amount !== null && (
          <span className="ml-auto tabular text-ink/75">{formatCurrency(ticket.amount)}</span>
        )}
      </div>
    </div>
  );
}
