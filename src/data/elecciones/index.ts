// Generado por scripts/snapshot-elecciones.mjs — no editar a mano.

export const ELECCIONES_DATA = {
  "presidencia-2026-2v": () => import("./presidencia-2026-2v.json"),
  "presidencia-2026-1v": () => import("./presidencia-2026-1v.json"),
  "congreso-2026": () => import("./congreso-2026.json"),
  "territoriales-2023": () => import("./territoriales-2023.json"),
  "presidencia-2022-2v": () => import("./presidencia-2022-2v.json"),
  "presidencia-2022-1v": () => import("./presidencia-2022-1v.json"),
  "congreso-2022": () => import("./congreso-2022.json"),
} as const;

export const GEOS: Record<string, () => Promise<{ default: unknown }>> = {
  "04cf03331f": () => import("./geo/04cf03331f.json"),
  "15c64fcb8f": () => import("./geo/15c64fcb8f.json"),
  "25c73b4ec1": () => import("./geo/25c73b4ec1.json"),
  "5ead237227": () => import("./geo/5ead237227.json"),
  "7999e3f490": () => import("./geo/7999e3f490.json"),
  "7ae5850935": () => import("./geo/7ae5850935.json"),
  "b2948b7407": () => import("./geo/b2948b7407.json"),
  "d85ef91517": () => import("./geo/d85ef91517.json"),
  "fd866c44ac": () => import("./geo/fd866c44ac.json"),
};
