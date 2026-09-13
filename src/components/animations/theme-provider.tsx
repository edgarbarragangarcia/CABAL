"use client";

import * as React from "react";

/**
 * Selector de tema propio — reemplaza `next-themes`.
 *
 * `next-themes` inyecta su script anti-parpadeo como hijo de un componente
 * cliente (`React.createElement("script", ...)` en medio del árbol), y eso
 * es justo el patrón que React 19 / Next 16 marcan con "Encountered a
 * script tag while rendering React component". La librería sigue en 0.4.6
 * (última estable) sin corregirlo.
 *
 * Aquí el script anti-parpadeo va aparte, en el <head> de
 * `src/app/layout.tsx` — HTML de documento, no un hijo renderizado por
 * este componente — así que ese aviso no aplica.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

type ThemeContextValue = {
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("dark");

  // Sincroniza con lo que el script del <head> ya aplicó al <html>, para
  // que el primer render en cliente coincida (sin depender de leer
  // localStorage otra vez aquí).
  React.useEffect(() => {
    // Lee lo que el script anti-parpadeo del <head> ya aplicó al <html>
    // (fuente externa, no estado de React) para que coincida el primer
    // render en cliente.
    const isDark = document.documentElement.classList.contains("dark");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(isDark ? "dark" : "light");
  }, []);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    const root = document.documentElement;
    root.classList.toggle("dark", next === "dark");
    root.style.colorScheme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage puede no estar disponible (modo privado, etc.)
    }
  }, []);

  const value = React.useMemo(() => ({ resolvedTheme: theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    // Fuera del provider (no debería pasar): tema oscuro por defecto, sin op.
    return { resolvedTheme: "dark", setTheme: () => {} };
  }
  return ctx;
}
