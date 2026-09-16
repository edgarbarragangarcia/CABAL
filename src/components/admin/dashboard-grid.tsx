"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EyeOff, GripVertical, Maximize2, Minimize2, Plus, RotateCcw } from "lucide-react";

import { useDashboardLayout } from "@/lib/dashboard-layout";

export type DashboardWidget = {
  id: string;
  title: string;
  icon: LucideIcon;
  /** Si true, el widget ocupa 2 columnas por defecto (antes de que el usuario lo cambie). */
  defaultWide?: boolean;
  content: React.ReactNode;
};

function SortableWidgetCard({
  widget,
  wide,
  onToggleWide,
  onHide,
}: {
  widget: DashboardWidget;
  wide: boolean;
  onToggleWide: () => void;
  onHide: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });
  const Icon = widget.icon;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        "rounded-2xl border border-border bg-surface p-5 shadow-sm " +
        (wide ? "lg:col-span-2 " : "") +
        (isDragging ? "opacity-50" : "")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Mover ${widget.title}`}
            className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" aria-hidden="true" />
          </button>
          <Icon className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
          <span className="truncate">{widget.title}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onToggleWide}
            aria-label={wide ? "Achicar widget" : "Ampliar widget"}
            title={wide ? "Achicar" : "Ampliar"}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {wide ? (
              <Minimize2 className="size-3.5" aria-hidden="true" />
            ) : (
              <Maximize2 className="size-3.5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={onHide}
            aria-label={`Quitar ${widget.title}`}
            title="Quitar del tablero"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <EyeOff className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mt-4">{widget.content}</div>
    </div>
  );
}

/**
 * Tablero de widgets reordenable: arrastrar para mover, ampliar/achicar,
 * quitar y volver a agregar. El layout se recuerda en localStorage
 * (`storageKey`) — este panel es "el centro de decisiones", así que cada
 * quien lo organiza como le sirve, en vez de un orden fijo para todos.
 */
export function DashboardGrid({
  widgets,
  storageKey,
}: {
  widgets: DashboardWidget[];
  storageKey: string;
}) {
  const defaultOrder = React.useMemo(() => widgets.map((w) => w.id), [widgets]);
  const { order, hidden, wide, mounted, reorder, toggleHidden, toggleWide, reset } =
    useDashboardLayout(defaultOrder, storageKey);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const byId = React.useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets]);
  const visibleIds = order.filter((id) => byId.has(id) && !hidden.includes(id));
  const hiddenWidgets = order.filter((id) => byId.has(id) && hidden.includes(id)).map((id) => byId.get(id)!);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorder(String(active.id), String(over.id));
    }
  }

  // Antes de montar en cliente, se renderiza el orden por defecto sin
  // interactividad de arrastre, para que el HTML del servidor coincida.
  if (!mounted) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {widgets.map((w) => (
          <div
            key={w.id}
            className={`rounded-2xl border border-border bg-surface p-5 shadow-sm ${
              w.defaultWide ? "lg:col-span-2" : ""
            }`}
          >
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <w.icon className="size-3.5 text-brand" aria-hidden="true" />
              {w.title}
            </p>
            <div className="mt-4">{w.content}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Arrastra el ícono <GripVertical className="inline size-3 align-text-bottom" aria-hidden="true" />{" "}
          para reordenar, o usa los botones de cada widget para ampliarlo o quitarlo.
        </p>
        <div className="flex items-center gap-2">
          {hiddenWidgets.length > 0 && (
            <div className="group relative">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-muted"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Agregar widget ({hiddenWidgets.length})
              </button>
              <div className="invisible absolute right-0 z-10 mt-1 w-56 rounded-xl border border-border bg-surface p-1.5 opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                {hiddenWidgets.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleHidden(w.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors hover:bg-surface-muted"
                  >
                    <w.icon className="size-3.5 text-brand" aria-hidden="true" />
                    {w.title}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Restablecer
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleIds.map((id) => {
              const widget = byId.get(id)!;
              return (
                <SortableWidgetCard
                  key={id}
                  widget={widget}
                  wide={wide.includes(id)}
                  onToggleWide={() => toggleWide(id)}
                  onHide={() => toggleHidden(id)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {visibleIds.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Quitaste todos los widgets. Usa "Agregar widget" para volver a mostrarlos.
        </p>
      )}
    </div>
  );
}
