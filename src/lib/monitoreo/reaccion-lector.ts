import { aLista, aTexto } from "@/lib/texto-ia";
import type { FuenteWeb } from "@/lib/ia-config";

export type Reaccion = {
  resumen: string;
  muestra: string;
  tono: { positivo: number; neutral: number; negativo: number; lectura: string };
  tonoPrensa: string;
  tonoGente: string;
  temas: { tema: string; tono: string; detalle: string }[];
  reacciones: { grupo: string; reaccion: string; citas: string[] }[];
  momentos: { fecha: string; hecho: string; reaccion: string }[];
  riesgos: string[];
  oportunidades: string[];
  recomendaciones: string[];
};

export type ResultadoReaccion = { analisis: Reaccion | null; texto: string; fuentes: FuenteWeb[]; generadoEn: string; titulares: number };

const cad = aTexto;
const lista = aLista;
const pct = (x: unknown) => Math.max(0, Math.min(100, Number.parseFloat(String(x)) || 0));
const objs = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? (x.filter((o) => o && typeof o === "object") as Record<string, unknown>[]) : []);

export function leerReaccion(texto: string): Reaccion | null {
  const ini = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (ini < 0 || fin <= ini) return null;
  const limpio = texto.slice(ini, fin + 1).replace(/[\u0000-\u001F]+/g, " ").replace(/,\s*([}\]])/g, "$1");
  try {
    const j = JSON.parse(limpio) as Record<string, unknown>;
    const t = (j.tono ?? {}) as Record<string, unknown>;
    // Los tres porcentajes se reescalan a 100 (el modelo a veces no suma exacto).
    const [p, n, g] = [pct(t.positivo), pct(t.neutral), pct(t.negativo)];
    const suma = p + n + g;
    const norm = (v: number) => (suma ? Math.round((100 * v) / suma) : 0);
    return {
      resumen: cad(j.resumen),
      muestra: cad(j.muestra),
      tono: { positivo: norm(p), neutral: norm(n), negativo: norm(g), lectura: cad(t.lectura) },
      tonoPrensa: cad(j.tonoPrensa),
      tonoGente: cad(j.tonoGente),
      temas: objs(j.temas).map((o) => ({ tema: cad(o.tema), tono: cad(o.tono), detalle: cad(o.detalle) })),
      reacciones: objs(j.reacciones).map((o) => ({ grupo: cad(o.grupo), reaccion: cad(o.reaccion), citas: lista(o.citas) })),
      momentos: objs(j.momentos).map((o) => ({ fecha: cad(o.fecha), hecho: cad(o.hecho), reaccion: cad(o.reaccion) })),
      riesgos: lista(j.riesgos),
      oportunidades: lista(j.oportunidades),
      recomendaciones: lista(j.recomendaciones),
    };
  } catch {
    return null;
  }
}

