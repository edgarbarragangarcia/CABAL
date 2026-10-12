"use client";

import * as React from "react";
import { Check, Copy, Database, ExternalLink, Loader2, Play, TriangleAlert } from "lucide-react";

/**
 * Las fuentes de las cifras de conflicto y problemas: de datos.gov.co se traen al servidor y se guardan en Supabase; la sección
 * Territorio lee de ahí. Cada fuente se puede cargar o actualizar con un botón (son unos segundos).
 */

type Fuente = { clave: string; nombre: string; indicadores: string[]; filas: number; corte: string | null; actualizadoEn: string | null };
type Estado = { tabla: boolean; fuentes: Fuente[]; sql?: string; editorSql?: string; error?: string };
type Resultado = { filas: number; omitidos: number; corte: string };

const numero = (n: number) => n.toLocaleString("es-CO");

function hace(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "ahora";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

async function pedir<T>(url: string, metodo: "GET" | "POST", cuerpo?: unknown): Promise<T> {
  const r = await fetch(url, { method: metodo, headers: cuerpo ? { "Content-Type": "application/json" } : undefined, body: cuerpo ? JSON.stringify(cuerpo) : undefined, cache: "no-store" });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error ?? (r.status === 504 ? "La carga tardó demasiado: vuelve a intentarlo." : `No fue posible completar la acción (${r.status}).`));
  return b as T;
}

export function FuentesTerritorio({ alCargar }: { alCargar: () => void }) {
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [cargando, setCargando] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = React.useState(false);

  const recargar = React.useCallback(async () => {
    try {
      setEstado(await pedir<Estado>("/api/admin/territorio/fuentes", "GET"));
    } catch (e) {
      setEstado({ tabla: true, fuentes: [], error: e instanceof Error ? e.message : "No se pudo leer." });
    }
  }, []);
  React.useEffect(() => {
    let cancelado = false;
    pedir<Estado>("/api/admin/territorio/fuentes", "GET")
      .catch((e): Estado => ({ tabla: true, fuentes: [], error: e instanceof Error ? e.message : "No se pudo leer." }))
      .then((d) => { if (!cancelado) setEstado(d); });
    return () => { cancelado = true; };
  }, []);

  async function cargar(claves: string[]) {
    setAviso(null);
    const resumen: string[] = [];
    try {
      for (const clave of claves) {
        setCargando(clave);
        const r = await pedir<Resultado>("/api/admin/territorio/fuentes", "POST", { fuente: clave });
        resumen.push(`${numero(r.filas)} filas`);
        await recargar();
      }
      setAviso({ ok: true, texto: `Listo: ${claves.length === 1 ? resumen[0] : `${claves.length} fuentes, ${resumen.join(" · ")}`} guardadas en Supabase.` });
      alCargar();
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible cargar la fuente." });
    } finally {
      setCargando(null);
      await recargar();
    }
  }

  if (!estado) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Consultando Supabase…</p>;
  if (estado.error) return <p className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{estado.error}</p>;

  if (!estado.tabla) {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-400/50 p-4">
        <h4 className="font-display text-base font-semibold">Un paso para guardar las cifras</h4>
        <p className="text-sm text-muted-foreground">Hace falta crear una tabla en tu Supabase (una sola vez): copia este SQL y ejecútalo en el editor SQL. Después podrás cargar las fuentes con un botón.</p>
        <pre className="max-h-48 overflow-auto rounded-xl bg-[#0f1613] p-4 text-xs leading-relaxed text-emerald-100">{estado.sql}</pre>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => { navigator.clipboard?.writeText(estado.sql ?? ""); setCopiado(true); setTimeout(() => setCopiado(false), 1600); }} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">{copiado ? <Check className="size-4" /> : <Copy className="size-4" />}{copiado ? "Copiado" : "Copiar SQL"}</button>
          {estado.editorSql && <a href={estado.editorSql} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Abrir el editor SQL de Supabase <ExternalLink className="size-4" /></a>}
          <button type="button" onClick={recargar} className="ml-auto rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-border hover:bg-surface-muted">Ya la ejecuté, comprobar</button>
        </div>
      </div>
    );
  }

  const faltan = estado.fuentes.filter((f) => f.filas === 0).map((f) => f.clave);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!!cargando} onClick={() => cargar(estado.fuentes.map((f) => f.clave))} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60">
          {cargando ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {faltan.length === estado.fuentes.length ? "Cargar todas las fuentes" : "Actualizar todas"}
        </button>
        <span className="text-xs text-muted-foreground">Cada fuente tarda unos segundos. Los datos salen de datos.gov.co (portal oficial de datos abiertos) y se guardan en Supabase.</span>
      </div>
      {aviso && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${aviso.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-rose-500/10 text-rose-800 dark:text-rose-300"}`}>{aviso.texto}</p>}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
            <tr><th className="px-4 py-2.5 font-semibold">Fuente</th><th className="px-3 py-2.5 font-semibold">Filas</th><th className="px-3 py-2.5 font-semibold">Corte</th><th className="px-3 py-2.5 font-semibold">Guardado</th><th className="px-4 py-2.5" /></tr>
          </thead>
          <tbody>
            {estado.fuentes.map((f) => (
              <tr key={f.clave} className="border-b border-border/60 align-top last:border-0">
                <td className="px-4 py-2.5"><p className="font-medium">{f.nombre}</p><p className="text-xs text-muted-foreground">{f.indicadores.join(" · ")}</p></td>
                <td className="px-3 py-2.5 text-muted-foreground">{f.filas > 0 ? numero(f.filas) : <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"><TriangleAlert className="size-3.5" /> sin cargar</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{f.corte ?? "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{f.actualizadoEn ? hace(f.actualizadoEn) : "—"}</td>
                <td className="px-4 py-2.5 text-right">
                  <button type="button" disabled={!!cargando} onClick={() => cargar([f.clave])} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-border hover:bg-surface-muted disabled:opacity-50">
                    {cargando === f.clave ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" />} {f.filas > 0 ? "Actualizar" : "Cargar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
