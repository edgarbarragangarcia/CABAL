"use client";

import * as React from "react";
import { Check, CheckCircle2, Copy, Database, ExternalLink, Loader2, Play, RefreshCw, Square } from "lucide-react";

/**
 * Datos: la copia de los resultados de Votaciones en Supabase. Muestra qué hay guardado de cada elección y cargo, y guarda lo
 * que falta pidiéndolo a la fuente por lotes (cada lote cabe en una función de Vercel; esta pantalla repite hasta terminar).
 * Lo que ya está guardado se lee desde Supabase; el resto se pide a la fuente y se guarda de paso.
 */

type Niveles = Record<string, number>;
type Par = {
  eleccion: string;
  corporacion: string;
  eleccionNombre: string;
  corporacionNombre: string;
  fecha: string;
  esperados: Niveles;
  guardados: Niveles;
  vacios: Niveles;
  ultima: string | null;
};
type Estado = { configurada: boolean; tabla: boolean; pares: Par[]; sql?: string; editorSql?: string; error?: string };
type Lote = { guardados: number; vacios: number; errores: number; limitada: boolean; errorBase?: string; mensaje?: string; actual: string | null; pendientes: number; total: number; terminado: boolean };
type Profundidad = 2 | 3 | 5;
type Seleccion = { eleccion?: string; corporacion?: string };

const PROFUNDIDADES: { nivel: Profundidad; texto: string }[] = [
  { nivel: 2, texto: "País y departamentos" },
  { nivel: 3, texto: "Hasta municipios" },
  { nivel: 5, texto: "Con zonas, localidades y comunas" },
];

const tarjeta = "rounded-2xl border border-border bg-surface shadow-sm";
const numero = (n: number) => n.toLocaleString("es-CO");
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pedir<T>(url: string, metodo: "GET" | "POST", cuerpo?: unknown): Promise<T> {
  const r = await fetch(url, { method: metodo, headers: cuerpo ? { "Content-Type": "application/json" } : undefined, body: cuerpo ? JSON.stringify(cuerpo) : undefined, cache: "no-store" });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error ?? `No fue posible completar la acción (${r.status}).`);
  return b as T;
}

const suma = (m: Niveles, desde: number, hasta: number) => Object.entries(m).reduce((s, [n, v]) => s + (Number(n) >= desde && Number(n) <= hasta ? v : 0), 0);
/** Territorios guardados (con resultado o como «la fuente no los publica») y esperados de un cargo, hasta cierto nivel. */
const avance = (p: Par, hasta: number) => ({ hechos: Math.min(suma(p.guardados, 0, hasta) + suma(p.vacios, 0, hasta), suma(p.esperados, 0, hasta)), esperados: suma(p.esperados, 0, hasta) });

function hace(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "ahora";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

function duracion(segundos: number) {
  if (segundos < 90) return "un minuto";
  if (segundos < 5400) return `${Math.round(segundos / 60)} min`;
  return `${(segundos / 3600).toFixed(1).replace(".", ",")} h`;
}

function Celda({ hechos, esperados }: { hechos: number; esperados: number }) {
  if (esperados === 0) return <span className="text-muted-foreground/60">—</span>;
  if (hechos >= esperados) return <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300"><Check className="size-3.5" />{numero(esperados)}</span>;
  if (hechos === 0) return <span className="text-muted-foreground">0 / {numero(esperados)}</span>;
  return <span className="font-semibold text-amber-700 dark:text-amber-300">{numero(hechos)} / {numero(esperados)}</span>;
}

export function DatosTab() {
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [profundidad, setProfundidad] = React.useState<Profundidad>(2);
  const [corriendo, setCorriendo] = React.useState<string | null>(null);
  const [lote, setLote] = React.useState<Lote | null>(null);
  const [aviso, setAviso] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = React.useState(false);
  const [ritmo, setRitmo] = React.useState<number | null>(null);
  const parar = React.useRef(false);

  const recargar = React.useCallback(async () => {
    try {
      setEstado(await pedir<Estado>("/api/admin/elecciones/almacen", "GET"));
    } catch (e) {
      setEstado({ configurada: true, tabla: false, pares: [], error: e instanceof Error ? e.message : "No se pudo leer." });
    }
  }, []);
  React.useEffect(() => {
    let cancelado = false;
    pedir<Estado>("/api/admin/elecciones/almacen", "GET")
      .catch((e): Estado => ({ configurada: true, tabla: false, pares: [], error: e instanceof Error ? e.message : "No se pudo leer." }))
      .then((d) => { if (!cancelado) setEstado(d); });
    return () => { cancelado = true; };
  }, []);

  /** Repite lotes hasta terminar (o hasta que se detenga o la fuente se niegue); lo guardado queda, así que se puede seguir otro día. */
  async function sincronizar(sel: Seleccion = {}) {
    parar.current = false;
    setCorriendo(sel.eleccion ? `${sel.eleccion}|${sel.corporacion}` : "todo");
    setAviso(null);
    setLote(null);
    setRitmo(null);
    const inicio = Date.now();
    let hechos = 0;
    let reintentos = 0;
    try {
      while (!parar.current) {
        let r: Lote;
        try {
          r = await pedir<Lote>("/api/admin/elecciones/almacen", "POST", { ...sel, nivelMax: profundidad });
          reintentos = 0;
        } catch (e) {
          // Un lote puede cortarse (la función de Vercel tiene límite de tiempo): lo guardado hasta ahí no se pierde.
          if (++reintentos > 3) throw e;
          await esperar(3000 * reintentos);
          continue;
        }
        setLote(r);
        hechos += r.guardados + r.vacios;
        if (hechos > 0) setRitmo(hechos / ((Date.now() - inicio) / 1000));
        await recargar();
        if (r.terminado) {
          setAviso({ ok: true, texto: "Listo: todo lo pedido quedó guardado en Supabase." });
          break;
        }
        if (r.errorBase) {
          setAviso({ ok: false, texto: r.errorBase });
          break;
        }
        if (r.limitada) {
          setAviso({ ok: false, texto: `${r.mensaje ?? "La fuente está limitando las consultas."} Lo guardado queda; espera unos minutos y pulsa de nuevo.` });
          break;
        }
        if (r.guardados + r.vacios === 0) {
          setAviso({ ok: false, texto: `No se pudo guardar nada en este intento (${r.errores} errores). Vuelve a intentarlo en unos minutos.` });
          break;
        }
      }
      if (parar.current) setAviso({ ok: true, texto: "Detenido. Lo guardado hasta ahora queda en Supabase." });
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible sincronizar." });
    } finally {
      setCorriendo(null);
      await recargar();
    }
  }

  const pares = estado?.pares ?? [];
  const total = pares.reduce((s, p) => s + avance(p, profundidad).esperados, 0);
  const hechos = pares.reduce((s, p) => s + avance(p, profundidad).hechos, 0);
  const faltan = Math.max(0, total - hechos);
  const guardadoTotal = pares.reduce((s, p) => s + suma(p.guardados, 0, 99), 0);
  const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;
  const eleccionesDistintas = [...new Set(pares.map((p) => p.eleccion))];

  return (
    // `contain: inline-size`: el SQL y la tabla (con su desplazamiento propio) no deben ensanchar la página.
    <div className="space-y-5 [contain:inline-size]">
      <div className={`${tarjeta} p-5`}>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Database className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">Resultados electorales en Supabase</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Aquí se guarda la copia de lo que ves en Votaciones: totales, partidos, candidatos y el ganador de cada territorio, de todas las elecciones y cargos. Lo guardado se lee desde Supabase (más rápido y sin depender de que la Registraduría responda); lo que falta se pide a la fuente y se guarda de paso.
            </p>
          </div>
          <button type="button" onClick={recargar} disabled={!!corriendo} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-border hover:bg-surface-muted disabled:opacity-50"><RefreshCw className="size-4" /> Actualizar</button>
        </div>
      </div>

      {!estado && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Consultando Supabase…</p>}
      {estado?.error && <p className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{estado.error}</p>}
      {estado && !estado.configurada && (
        <p className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">Falta conectar Supabase: define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.</p>
      )}

      {estado && estado.configurada && !estado.tabla && !estado.error && (
        <section className={`${tarjeta} space-y-3 border-amber-400/50 p-5`}>
          <h3 className="font-display text-lg font-semibold">Un paso para guardar los resultados</h3>
          <p className="text-sm text-muted-foreground">Hace falta crear las tablas en tu base de Supabase (una sola vez): copia este SQL y ejecútalo en el editor SQL. Crea las tablas, tres vistas para consultar partidos, candidatos y ganadores, y deja todo cerrado a la llave pública.</p>
          <pre className="max-h-56 overflow-auto rounded-xl bg-[#0f1613] p-4 text-xs leading-relaxed text-emerald-100">{estado.sql}</pre>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { navigator.clipboard?.writeText(estado.sql ?? ""); setCopiado(true); setTimeout(() => setCopiado(false), 1600); }} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">{copiado ? <Check className="size-4" /> : <Copy className="size-4" />}{copiado ? "Copiado" : "Copiar SQL"}</button>
            {estado.editorSql && <a href={estado.editorSql} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Abrir el editor SQL de Supabase <ExternalLink className="size-4" /></a>}
            <button type="button" onClick={recargar} className="ml-auto rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-border hover:bg-surface-muted">Ya la ejecuté, comprobar</button>
          </div>
        </section>
      )}

      {estado?.tabla && (
        <>
          <section className={`${tarjeta} space-y-4 p-5`}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" /> Conectado: tablas listas</span>
              <span className="text-muted-foreground">{eleccionesDistintas.length} elecciones · {pares.length} cargos · <b className="text-foreground">{numero(guardadoTotal)}</b> territorios con resultado guardado</span>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Hasta dónde guardar</p>
              <div role="radiogroup" aria-label="Profundidad" className="inline-flex flex-wrap gap-1 rounded-full bg-surface-muted p-1 text-sm">
                {PROFUNDIDADES.map((o) => (
                  <button key={o.nivel} type="button" role="radio" aria-checked={profundidad === o.nivel} disabled={!!corriendo} onClick={() => setProfundidad(o.nivel)} className={`rounded-full px-4 py-1.5 font-semibold transition disabled:opacity-60 ${profundidad === o.nivel ? "bg-brand text-brand-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>{o.texto}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {profundidad === 2 && "Lo esencial: lo que se ve al abrir una elección y su mapa por departamentos (cada departamento trae al ganador de sus municipios). Son pocas consultas."}
                {profundidad === 3 && "Agrega el detalle de cada municipio. Son muchísimas consultas (decenas de miles): tarda horas, ocupa bastante espacio en Supabase y la Registraduría puede limitar el ritmo. Se puede parar y seguir cuando quieras."}
                {profundidad === 5 && "Agrega también zonas, localidades de Bogotá y comunas (las JAL se eligen por comuna). Es muy pesado: úsalo solo si de verdad hace falta."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {corriendo ? (
                <button type="button" onClick={() => { parar.current = true; }} className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"><Square className="size-4" /> Detener</button>
              ) : (
                <button type="button" onClick={() => sincronizar()} disabled={faltan === 0} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:brightness-110 disabled:opacity-50"><Play className="size-4" /> {faltan === 0 ? "Todo guardado" : `Guardar lo que falta (${numero(faltan)})`}</button>
              )}
              <span className="text-sm text-muted-foreground">{numero(hechos)} de {numero(total)} territorios · {pct}%</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${pct}%` }} /></div>

            {corriendo && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" />
                {lote?.actual ? `Guardando ${lote.actual}…` : "Empezando…"}
                {ritmo ? <span>· {ritmo.toFixed(1).replace(".", ",")} territorios por segundo{faltan > 0 ? ` · faltan unos ${duracion(faltan / ritmo)}` : ""}</span> : null}
              </p>
            )}
            {aviso && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${aviso.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-rose-500/10 text-rose-800 dark:text-rose-300"}`}>{aviso.texto}</p>}
          </section>

          <section className={`${tarjeta} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="border-b border-border bg-surface-muted/60 text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Elección</th>
                    <th className="px-3 py-3 font-semibold">Cargo</th>
                    <th className="px-3 py-3 font-semibold">País</th>
                    <th className="px-3 py-3 font-semibold">Departamentos</th>
                    <th className="px-3 py-3 font-semibold">Municipios</th>
                    <th className="px-3 py-3 font-semibold">Zonas y comunas</th>
                    <th className="px-3 py-3 font-semibold">Puestos y mesas</th>
                    <th className="px-3 py-3 font-semibold">Actualizado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pares.map((p, i) => {
                    const clave = `${p.eleccion}|${p.corporacion}`;
                    const aqui = corriendo === clave;
                    const nivel = (n: number) => ({ hechos: (p.guardados[n] ?? 0) + (p.vacios[n] ?? 0), esperados: p.esperados[n] ?? 0 });
                    const zonas = { hechos: nivel(4).hechos + nivel(5).hechos, esperados: nivel(4).esperados + nivel(5).esperados };
                    const hondo = suma(p.guardados, 6, 99) + suma(p.vacios, 6, 99);
                    const primera = i === 0 || pares[i - 1].eleccion !== p.eleccion;
                    return (
                      <tr key={clave} className={`border-b border-border/60 last:border-0 ${primera && i > 0 ? "border-t border-t-border" : ""}`}>
                        <td className="px-4 py-2.5 align-middle font-medium">{primera ? p.eleccionNombre : <span className="text-muted-foreground/40">″</span>}</td>
                        <td className="px-3 py-2.5 align-middle">{p.corporacionNombre}</td>
                        <td className="px-3 py-2.5 align-middle"><Celda {...nivel(1)} /></td>
                        <td className="px-3 py-2.5 align-middle"><Celda {...nivel(2)} /></td>
                        <td className="px-3 py-2.5 align-middle"><Celda {...nivel(3)} /></td>
                        <td className="px-3 py-2.5 align-middle"><Celda {...zonas} /></td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground">{hondo > 0 ? numero(hondo) : "—"}</td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground">{p.ultima ? hace(p.ultima) : "—"}</td>
                        <td className="px-4 py-2.5 text-right align-middle">
                          <button type="button" disabled={!!corriendo || avance(p, profundidad).hechos >= avance(p, profundidad).esperados} onClick={() => sincronizar({ eleccion: p.eleccion, corporacion: p.corporacion })} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-border hover:bg-surface-muted disabled:opacity-40">
                            {aqui ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Guardar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border bg-surface-muted/40 px-4 py-3 text-xs text-muted-foreground">
              Los puestos y las mesas no se descargan en bloque (son más de cien mil por elección): se guardan solos cuando los consultas en Votaciones. En el Senado y la Cámara, los municipios y niveles inferiores guardan solo los candidatos con votos.
            </p>
          </section>

          <details className={`${tarjeta} p-5 text-sm`}>
            <summary className="cursor-pointer font-semibold">Cómo consultarlos con SQL en Supabase</summary>
            <p className="mt-3 text-muted-foreground">Además de la tabla <code className="rounded bg-surface-muted px-1.5 py-0.5">resultados_electorales</code> (un resultado completo por elección, cargo y territorio) hay tres vistas, con una fila por partido, por candidato y por ganador de cada territorio:</p>
            <ul className="mt-2 list-inside list-disc text-muted-foreground">
              <li><code className="rounded bg-surface-muted px-1.5 py-0.5">partidos_electorales</code></li>
              <li><code className="rounded bg-surface-muted px-1.5 py-0.5">candidatos_electorales</code></li>
              <li><code className="rounded bg-surface-muted px-1.5 py-0.5">ganadores_electorales</code></li>
            </ul>
            <pre className="mt-3 overflow-auto rounded-xl bg-[#0f1613] p-4 text-xs leading-relaxed text-emerald-100">{`select ambito_nombre, candidato, votos, porcentaje
from candidatos_electorales
where eleccion = 'presidencia-2022-2v' and nivel = 2
order by ambito_nombre, votos desc;`}</pre>
          </details>
        </>
      )}
    </div>
  );
}
