"use client";

// A list whose rows can be put in any order: drag a row by its handle (mouse, or
// press and hold on touch), pick it up with Space and move it with the arrow keys,
// or use its up / down buttons — a one-tap way that needs no dragging at all.
import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { tr } from "@/lib/i18n";

export interface RowTools {
  /** The drag handle (put it at the start of the row). */
  handle: ReactNode;
  /** Up / down buttons (put them at the end of the row). */
  arrows: ReactNode;
  dragging: boolean;
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  label,
  itemLabel,
  renderItem,
  className,
}: {
  items: T[];
  onReorder: (ids: string[]) => void;
  label: string; // what the list is, for screen readers
  itemLabel: (item: T) => string; // a row's name, for its buttons
  renderItem: (item: T, tools: RowTools) => ReactNode;
  className?: string;
}) {
  const ids = items.map((i) => i.id);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return;
    onReorder(arrayMove(ids, from, to));
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) move(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  };
  const nameOf = (id: string | number) => {
    const item = items.find((i) => i.id === String(id));
    return item ? itemLabel(item) : "";
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: tr("To move a row, press Space, use the arrow keys, then press Space again."),
        },
        announcements: {
          onDragStart: ({ active }) => tr("Picked up {name}.", { name: nameOf(active.id) }),
          onDragOver: ({ active, over }) =>
            over ? tr("{name} is now at position {n} of {total}.", { name: nameOf(active.id), n: ids.indexOf(String(over.id)) + 1, total: ids.length }) : "",
          onDragEnd: ({ active, over }) =>
            over ? tr("{name} placed at position {n} of {total}.", { name: nameOf(active.id), n: ids.indexOf(String(over.id)) + 1, total: ids.length }) : "",
          onDragCancel: ({ active }) => tr("Moving {name} was cancelled.", { name: nameOf(active.id) }),
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul aria-label={label} className={className}>
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id}>
              {(handleProps, dragging) =>
                renderItem(item, {
                  dragging,
                  handle: (
                    <button
                      type="button"
                      {...handleProps}
                      aria-label={tr("Move {name}", { name: itemLabel(item) })}
                      className="flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-ink/35 hover:text-ink/70 active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" aria-hidden />
                    </button>
                  ),
                  arrows: (
                    <span className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        onClick={() => move(index, index - 1)}
                        disabled={index === 0}
                        aria-label={tr("Move {name} up", { name: itemLabel(item) })}
                        className="flex h-5 w-7 cursor-pointer items-center justify-center rounded text-ink/40 hover:bg-ink/5 hover:text-ink disabled:cursor-default disabled:opacity-25"
                      >
                        <ChevronUp className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, index + 1)}
                        disabled={index === items.length - 1}
                        aria-label={tr("Move {name} down", { name: itemLabel(item) })}
                        className="flex h-5 w-7 cursor-pointer items-center justify-center rounded text-ink/40 hover:bg-ink/5 hover:text-ink disabled:cursor-default disabled:opacity-25"
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      </button>
                    </span>
                  ),
                })
              }
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handleProps: Record<string, unknown>, dragging: boolean) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-90 shadow-lg")}
    >
      {children({ ...attributes, ...listeners }, isDragging)}
    </li>
  );
}
