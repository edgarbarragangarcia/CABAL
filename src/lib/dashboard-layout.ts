"use client";

import * as React from "react";

export type DashboardLayoutState = {
  /** Orden de los ids de widgets, de arriba hacia abajo. */
  order: string[];
  /** Ids de widgets ocultos (quitados del tablero, pero no borrados). */
  hidden: string[];
  /** Ids de widgets en modo "ancho" (ocupan 2 columnas en vez de 1). */
  wide: string[];
};

function loadState(storageKey: string, defaultOrder: string[]): DashboardLayoutState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { order: defaultOrder, hidden: [], wide: [] };
    const parsed = JSON.parse(raw) as Partial<DashboardLayoutState>;
    const savedOrder = Array.isArray(parsed.order) ? parsed.order : [];
    // Widgets nuevos que no existían cuando se guardó el layout se añaden al final;
    // los que ya no existen (renombrados/eliminados) se descartan silenciosamente.
    const known = new Set(defaultOrder);
    const order = [
      ...savedOrder.filter((id) => known.has(id)),
      ...defaultOrder.filter((id) => !savedOrder.includes(id)),
    ];
    return {
      order,
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((id) => known.has(id)) : [],
      wide: Array.isArray(parsed.wide) ? parsed.wide.filter((id) => known.has(id)) : [],
    };
  } catch {
    return { order: defaultOrder, hidden: [], wide: [] };
  }
}

/**
 * Layout de un tablero de widgets (orden, ocultos, anchos) persistido en
 * localStorage — este panel no tiene base de datos todavía (MVP), así que
 * la disposición se recuerda por navegador, igual que el LMS.
 */
export function useDashboardLayout(defaultOrder: string[], storageKey: string) {
  const [state, setState] = React.useState<DashboardLayoutState>({
    order: defaultOrder,
    hidden: [],
    wide: [],
  });
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setState(loadState(storageKey, defaultOrder));
    setMounted(true);
    // Solo se relee al montar; cambios posteriores de defaultOrder no deben
    // pisar lo que el usuario ya organizó.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = React.useCallback(
    (next: DashboardLayoutState) => {
      setState(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // localStorage puede no estar disponible (modo privado, etc.)
      }
    },
    [storageKey]
  );

  const reorder = React.useCallback(
    (activeId: string, overId: string) => {
      if (activeId === overId) return;
      setState((prev) => {
        const from = prev.order.indexOf(activeId);
        const to = prev.order.indexOf(overId);
        if (from === -1 || to === -1) return prev;
        const nextOrder = prev.order.slice();
        nextOrder.splice(from, 1);
        nextOrder.splice(to, 0, activeId);
        const next = { ...prev, order: nextOrder };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignora si no hay localStorage
        }
        return next;
      });
    },
    [storageKey]
  );

  const toggleHidden = React.useCallback(
    (id: string) => {
      const hidden = state.hidden.includes(id)
        ? state.hidden.filter((h) => h !== id)
        : [...state.hidden, id];
      persist({ ...state, hidden });
    },
    [state, persist]
  );

  const toggleWide = React.useCallback(
    (id: string) => {
      const wide = state.wide.includes(id) ? state.wide.filter((w) => w !== id) : [...state.wide, id];
      persist({ ...state, wide });
    },
    [state, persist]
  );

  const reset = React.useCallback(() => {
    persist({ order: defaultOrder, hidden: [], wide: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist]);

  return { ...state, mounted, reorder, toggleHidden, toggleWide, reset };
}
