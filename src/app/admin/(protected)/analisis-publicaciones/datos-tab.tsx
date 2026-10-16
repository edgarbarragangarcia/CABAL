"use client";

import * as React from "react";
import { Check, CheckCircle2, Copy, Database, ExternalLink, Loader2, Play, RefreshCw, Square, TriangleAlert } from "lucide-react";

/**
 * Datos: la copia de los resultados de Votaciones en Supabase. Muestra qué hay guardado de cada elección y cargo y lo carga
 * pidiéndolo a la fuente. La carga principal corre en segundo plano en el servidor (por tramos que se llaman unos a otros): se
 * pulsa una vez y sigue aunque se cierre esta pantalla. Sin la tabla que la anota, o a mano para un solo cargo, esta pantalla
 * puede hacerla por lotes (cada lote cabe en una función de Vercel; repite hasta terminar mientras siga abierta).
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
/** La carga en segundo plano (ver src/lib/gov-data/elecciones/carga.ts). */
type VistaCarga = {
  activa: boolean;
  enMarcha: boolean;
  ultimoLoteEn: string | null;
  nivelMax?: number;
  eleccion?: string;
  corporacion?: string;
  iniciadaEn?: string;
  terminadaEn?: string;
  fin?: "listo" | "detenida" | "pausa" | "error";
  lotes?: number;
  guardados?: number;
  vacios?: number;
  errores?: number;
  transitorios?: number;
  actual?: string | null;
  mensaje?: string | null;
  pendientes?: number | null;
  total?: number | null;
};
type EstadoCarga = { disponible: boolean; /** El aviso automático entre tramos (pg_net) está instalado. */ aviso?: boolean; carga: VistaCarga | null; sql?: string; /** SQL de índices: se ofrece cuando Supabase ha agotado el tiempo. */ sqlIndices?: string; editorSql?: string; error?: string };
type Estado = { configurada: boolean; tabla: boolean; pares: Par[]; sql?: string; editorSql?: string; error?: string; carga?: EstadoCarga };
type Lote = { guardados: number; vacios: number; errores: number; limitada: boolean; errorBase?: string; mensaje?: string; actual: string | null; pendientes: number; total: number; terminado: boolean };
type Profundidad = 2 | 3 | 5 | 6;
type Seleccion = { eleccion?: string; corporacion?: string };

const PROFUNDIDADES: { nivel: Profundidad; texto: string }[] = [
  { nivel: 2, texto: "País y departamentos" },
  { nivel: 3, texto: "Hasta municipios" },
  { nivel: 5, texto: "Con zonas, localidades y comunas" },
  { nivel: 6, texto: "Con puestos de votación" },
];

const tarjeta = "rounded-2xl border border-border bg-surface shadow-sm";
const numero = (n: number) => n.toLocaleString("es-CO");
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pedir<T>(url: string, metodo: "GET" | "POST", cuerpo?: unknown): Promise<T> {
  const r = await fetch(url, { method: metodo, headers: cuerpo ? { "Content-Type": "application/json" } : undefined, body: cuerpo ? JSON.stringify(cuerpo) : undefined, cache: "no-store" });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || `No fue posible completar la acción (${r.status}).`);
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

/** Territorios guardados por segundo desde que arrancó la carga en segundo plano (o `null` si aún no hay base para calcularlo). */
function ritmoDe(c: VistaCarga): number | null {
  if (!c.iniciadaEn) return null;
  const segundos = ((c.terminadaEn ? Date.parse(c.terminadaEn) : Date.now()) - Date.parse(c.iniciadaEn)) / 1000;
  const hechos = (c.guardados ?? 0) + (c.vacios ?? 0);
  return segundos > 20 && hechos > 0 ? hechos / segundos : null;
}

function Celda({ hechos, esperados }: { hechos: number; esperados: number }) {
  if (esperados === 0) return <span className="text-muted-foreground/60">—</span>;
  if (hechos >= esperados) return <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300"><Check className="size-3.5" />{numero(esperados)}</span>;
  if (hechos === 0) return <span className="text-muted-foreground">0 / {numero(esperados)}</span>;
  return <span className="font-semibold text-amber-700 dark:text-amber-300">{numero(hechos)} / {numero(esperados)}</span>;
}

export function DatosTab() {
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [profundidadElegida, setProfundidad] = React.useState<Profundidad>(3);
  const [corriendo, setCorriendo] = React.useState<string | null>(null);
  const [iniciando, setIniciando] = React.useState(false);
  const [copiadoCarga, setCopiadoCarga] = React.useState(false);
  const [copiadoIndices, setCopiadoIndices] = React.useState(false);
  const [lote, setLote] = React.useState<Lote | null>(null);
  const [aviso, setAviso] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = React.useState(false);
  const [ritmo, setRitmo] = React.useState<number | null>(null);
  const parar = React.useRef(false);

  const recargar = React.useCallback(async () => {
    try {
      setEstado(await pedir<Estado>("/api/admin/elecciones/almacen", "GET"));
    } catch (e) {
      setEstado({ configurada: true, tabla: false, pares: [], error: (e instanceof Error && e.message) || "Supabase no respondió. Vuelve a intentar en un momento." });
    }
  }, []);
  React.useEffect(() => {
    let cancelado = false;
    // Si Supabase tropieza al abrir, se vuelve a preguntar unas veces antes de mostrar un error (casi siempre es pasajero).
    (async () => {
      let ultimo = "";
      for (let intento = 0; intento < 4 && !cancelado; intento++) {
        try {
          const d = await pedir<Estado>("/api/admin/elecciones/almacen", "GET");
          if (!cancelado) setEstado(d);
          return;
        } catch (e) {
          ultimo = (e instanceof Error && e.message) || "Supabase no respondió. Vuelve a intentar en un momento.";
          await esperar(2500 * (intento + 1));
        }
      }
      if (!cancelado) setEstado({ configurada: true, tabla: false, pares: [], error: ultimo });
    })();
    return () => { cancelado = true; };
  }, []);

  // Mientras la carga en segundo plano trabaja, se consulta su avance cada pocos segundos (y la tabla de cobertura cada cuatro veces).
  const enMarcha = estado?.carga?.carga?.enMarcha === true;
  // Mientras una carga en segundo plano trabaja, la pantalla muestra la profundidad con la que se lanzó (aunque se haya abierto después).
  const nivelEnMarcha = estado?.carga?.carga?.nivelMax;
  const profundidad: Profundidad = enMarcha && PROFUNDIDADES.some((o) => o.nivel === nivelEnMarcha) ? (nivelEnMarcha as Profundidad) : profundidadElegida;
  React.useEffect(() => {
    if (!enMarcha) return;
    let cancelado = false;
    let veces = 0;
    const id = setInterval(() => {
      const completo = ++veces % 4 === 0;
      pedir<Estado | { carga: EstadoCarga }>(`/api/admin/elecciones/almacen${completo ? "" : "?solo=carga"}`, "GET")
        .then(async (d) => {
          if (cancelado) return;
          if (completo) return setEstado(d as Estado);
          const carga = (d as { carga: EstadoCarga }).carga;
          // Si la carga acaba de terminar (o se cortó), se trae también la tabla de cobertura: que no quede con cifras viejas.
          let todo = carga.carga?.enMarcha === false ? await pedir<Estado>("/api/admin/elecciones/almacen", "GET") : null;
          // Pausa por el límite de cinco tramos seguidos de Vercel: con la pantalla abierta, se retoma sola.
          const pausada = todo?.carga?.carga;
          if (pausada?.fin === "pausa" && pausada.nivelMax) {
            try {
              await pedir("/api/admin/elecciones/almacen", "POST", {
                accion: "iniciar",
                nivelMax: pausada.nivelMax,
                ...(pausada.eleccion ? { eleccion: pausada.eleccion } : {}),
                ...(pausada.corporacion ? { corporacion: pausada.corporacion } : {}),
              });
              todo = await pedir<Estado>("/api/admin/elecciones/almacen", "GET");
            } catch {
              /* no se pudo retomar: queda la pausa a la vista, con su botón */
            }
          }
          if (!cancelado) setEstado((prev) => todo ?? (prev ? { ...prev, carga } : prev));
        })
        .catch(() => { /* un fallo suelto no importa: el siguiente intento lo corrige */ });
    }, 5000);
    return () => { cancelado = true; clearInterval(id); };
  }, [enMarcha]);

  /** Lanza la carga en segundo plano: sigue en el servidor aunque se cierre esta pantalla. */
  async function iniciarSegundoPlano() {
    setAviso(null);
    setIniciando(true);
    try {
      await pedir("/api/admin/elecciones/almacen", "POST", { accion: "iniciar", nivelMax: profundidad });
      await recargar();
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible iniciar la carga." });
    } finally {
      setIniciando(false);
    }
  }

  /**
   * Quita las marcas de «no publicado» y vuelve a cargar: solo quedan así las que la fuente confirma (tres intentos). Así se corrigen
   * las que se guardaron por un fallo pasajero (p. ej. un departamento entero que sí existe).
   */
  async function revisarNoPublicados() {
    setAviso(null);
    setIniciando(true);
    try {
      await pedir("/api/admin/elecciones/almacen", "POST", { accion: "revisar-no-publicados" });
      await recargar();
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible revisar los no publicados." });
      setIniciando(false);
      return;
    }
    setIniciando(false);
    if (cargaDisponible) await iniciarSegundoPlano();
    else await sincronizar();
  }

  async function detenerSegundoPlano() {
    setAviso(null);
    setIniciando(true);
    try {
      await pedir("/api/admin/elecciones/almacen", "POST", { accion: "detener" });
      await recargar();
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible detener la carga." });
    } finally {
      setIniciando(false);
    }
  }

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
  /** Territorios guardados como «la fuente no los publica»: algunos pueden ser fallos pasajeros de la descarga. */
  const noPublicados = pares.reduce((s, p) => s + suma(p.vacios, 0, 99), 0);
  /** Cargos que ya se leen de Supabase sin tocar la fuente hasta el municipio (lo que se recorre navegando Votaciones). */
  const completosHastaMunicipios = pares.filter((p) => { const a = avance(p, 3); return a.esperados > 0 && a.hechos >= a.esperados; }).length;
  const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;
  const eleccionesDistintas = [...new Set(pares.map((p) => p.eleccion))];
  const cargaDisponible = estado?.carga?.disponible === true;
  const c = estado?.carga?.carga ?? null;
  const ocupado = !!corriendo || iniciando || enMarcha;
  const ritmoCarga = c && enMarcha ? ritmoDe(c) : null;
  /** La última carga quedó a medias (la cortó un error o la cadena se interrumpió): se retoma con «Continuar». */
  const aMedias = !!c && !enMarcha && (c.activa || c.fin === "error" || c.fin === "pausa");

  return (
    // `contain: inline-size`: el SQL y la tabla (con su desplazamiento propio) no deben ensanchar la página.
    <div className="space-y-5 [contain:inline-size]">
      <div className={`${tarjeta} p-5`}>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Database className="size-6" /></span>
          {/* En pantallas angostas el texto pasa a su propia fila en vez de quedar en una columna estrecha junto al icono. */}
          <div className="min-w-[min(100%,16rem)] flex-1">
            <h2 className="font-display text-lg font-semibold">Resultados electorales en Supabase</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Votaciones lee solo de Supabase, sin consultar a la Registraduría al mostrar: aquí se guarda la copia de totales, partidos, candidatos y el ganador de cada territorio, de todas las elecciones y cargos. Lo que no esté guardado no se muestra y se avisa. La Registraduría solo se consulta para llenar esta copia, con la carga de abajo, que corre en el servidor sin que tengas que dejar esta pantalla abierta.
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

      {estado && estado.configurada && !estado.tabla && !estado.error && !!estado.sql && (
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
              <span className="text-muted-foreground">{eleccionesDistintas.length} elecciones · {pares.length} cargos · <b className="text-foreground">{numero(guardadoTotal)}</b> territorios con resultado guardado · <b className="text-foreground">{completosHastaMunicipios} de {pares.length}</b> cargos completos hasta municipios</span>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Hasta dónde guardar</p>
              <div role="radiogroup" aria-label="Profundidad" className="inline-flex flex-wrap gap-1 rounded-3xl bg-surface-muted p-1 text-sm sm:rounded-full">
                {PROFUNDIDADES.map((o) => (
                  <button key={o.nivel} type="button" role="radio" aria-checked={profundidad === o.nivel} disabled={ocupado} onClick={() => setProfundidad(o.nivel)} className={`rounded-full px-4 py-1.5 font-semibold transition disabled:opacity-60 ${profundidad === o.nivel ? "bg-brand text-brand-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>{o.texto}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {profundidad === 2 && "Lo esencial: lo que se ve al abrir una elección y su mapa por departamentos (cada departamento trae al ganador de sus municipios). Son pocas consultas."}
                {profundidad === 3 && "Agrega el detalle de cada municipio: con esto, Votaciones muestra completo cualquier país, departamento o municipio. Son decenas de miles de consultas: tarda horas, ocupa bastante espacio en Supabase y la Registraduría puede limitar el ritmo. Se puede detener y seguir cuando quieras."}
                {profundidad === 5 && "Agrega también zonas, localidades de Bogotá y comunas (las JAL se eligen por comuna). Es muy pesado: úsalo solo si de verdad hace falta."}
                {profundidad === 6 && "Agrega los puestos de votación (unos 13.000 por elección): sirven para el análisis por puesto y para ver el detalle dentro de cada municipio. Es lo más pesado: úsalo cargo por cargo con el botón «Guardar» de cada fila, no con «Cargar todo»."}
              </p>
              {profundidad === 6 && faltan > 30_000 && (
                <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                  Con puestos de votación faltan {numero(faltan)} consultas: a unos 2 territorios por segundo son más de {numero(Math.round(faltan / 2 / 3600))} horas seguidas, y la Registraduría no deja ir más rápido (corta a quien pide más de unas 13.000 por hora). Para terminar en horas: deja «Con zonas, localidades y comunas» para todo y carga los puestos solo de los cargos que necesites, uno por uno con «Guardar».
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {enMarcha ? (
                <button type="button" onClick={detenerSegundoPlano} disabled={iniciando} className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"><Square className="size-4" /> Detener la carga</button>
              ) : corriendo ? (
                <button type="button" onClick={() => { parar.current = true; }} className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"><Square className="size-4" /> Detener</button>
              ) : cargaDisponible ? (
                <button type="button" onClick={iniciarSegundoPlano} disabled={faltan === 0 || iniciando} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:brightness-110 disabled:opacity-50">
                  {iniciando ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {faltan === 0 ? "Todo guardado" : `${aMedias ? "Continuar la carga" : "Cargar todo en segundo plano"} (${numero(faltan)})`}
                </button>
              ) : (
                <button type="button" onClick={() => sincronizar()} disabled={faltan === 0} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:brightness-110 disabled:opacity-50"><Play className="size-4" /> {faltan === 0 ? "Todo guardado" : `Guardar lo que falta (${numero(faltan)})`}</button>
              )}
              {cargaDisponible && !ocupado && faltan > 0 && (
                <button type="button" onClick={() => sincronizar()} title="Lo hace esta pantalla, lote por lote: hay que dejarla abierta." className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold ring-1 ring-border hover:bg-surface-muted">Guardar desde esta pantalla</button>
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
            {c && enMarcha && (
              <div role="status" className="space-y-1 rounded-xl bg-sky-500/10 px-4 py-3 text-sm text-sky-900 dark:text-sky-200">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <Loader2 className="size-4 animate-spin" />
                  {c.actual ? `Cargando ${c.actual}…` : "Empezando la carga…"}
                </p>
                <p className="text-xs">
                  Corre en el servidor: con esta pantalla abierta sigue sola hasta terminar; si la cierras, avanza unos minutos y queda en pausa hasta que vuelvas. Tramo {numero(c.lotes ?? 0)} · {numero((c.guardados ?? 0) + (c.vacios ?? 0))} territorios guardados en esta carga
                  {ritmoCarga ? ` · ${ritmoCarga.toFixed(1).replace(".", ",")} por segundo${faltan > 0 ? ` · faltan unos ${duracion(faltan / ritmoCarga)}` : ""}` : ""}.
                </p>
              </div>
            )}
            {aMedias && c && (
              <div role="status" className="flex flex-wrap items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <p className="min-w-0 flex-1">{(c.fin === "error" || c.fin === "pausa") && c.mensaje ? c.mensaje : `La carga se interrumpió${c.ultimoLoteEn ? ` (${hace(c.ultimoLoteEn)})` : ""}. Lo guardado queda en Supabase; pulsa «Continuar la carga» para seguir donde iba.`}</p>
              </div>
            )}
            {c && !enMarcha && !aMedias && c.fin && c.mensaje && (
              <p role="status" className={`rounded-xl px-4 py-3 text-sm ${c.fin === "listo" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-surface-muted text-muted-foreground"}`}>{c.mensaje}</p>
            )}
            {noPublicados > 0 && !ocupado && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-muted/70 px-4 py-3 text-sm">
                <TriangleAlert className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                <p className="min-w-0 flex-1 text-muted-foreground">
                  <b className="text-foreground">{numero(noPublicados)}</b> territorios figuran como «no publicados» por la Registraduría. Algunos pueden ser fallos pasajeros de la descarga (por ejemplo, un departamento que sí tiene resultados): al revisarlos se piden de nuevo, tres veces cada uno, y solo quedan así los que la fuente confirma.
                </p>
                <button type="button" onClick={revisarNoPublicados} className="rounded-full px-4 py-2 text-xs font-semibold ring-1 ring-border hover:bg-surface-muted">Revisarlos</button>
              </div>
            )}
            {aviso && <p role="status" className={`rounded-xl px-4 py-3 text-sm ${aviso.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-rose-500/10 text-rose-800 dark:text-rose-300"}`}>{aviso.texto}</p>}
          </section>

          {estado.carga && (!estado.carga.disponible || estado.carga.aviso === false) && (
            <section className={`${tarjeta} space-y-3 border-amber-400/50 p-5`}>
              <h3 className="font-display text-lg font-semibold">{estado.carga.disponible ? "Para que la carga siga sola, sin pausas" : "Un paso más para cargar sin dejar esta pantalla abierta"}</h3>
              {estado.carga.error ? (
                <p className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-300">{estado.carga.error}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {estado.carga.disponible
                      ? "Vercel solo deja que cinco tramos seguidos se llamen entre sí, así que sin esto la carga avanza unos minutos y se pausa (se retoma sola mientras esta pantalla esté abierta). Este SQL activa el aviso automático de Supabase (pg_net): la carga sigue sola hasta terminar, aunque cierres la pantalla. Se ejecuta una sola vez en el editor SQL de Supabase."
                      : "Falta una tabla pequeña donde el servidor anota el avance de la carga y el aviso automático de Supabase (pg_net) que la hace seguir sola hasta terminar. Copia este SQL y ejecútalo una sola vez en el editor SQL de Supabase. Mientras tanto puedes guardar desde esta pantalla, que debe quedar abierta."}
                  </p>
                  <pre className="max-h-48 overflow-auto rounded-xl bg-[#0f1613] p-4 text-xs leading-relaxed text-emerald-100">{estado.carga.sql}</pre>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(estado.carga?.sql ?? ""); setCopiadoCarga(true); setTimeout(() => setCopiadoCarga(false), 1600); }} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">{copiadoCarga ? <Check className="size-4" /> : <Copy className="size-4" />}{copiadoCarga ? "Copiado" : "Copiar SQL"}</button>
                    {estado.carga.editorSql && <a href={estado.carga.editorSql} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Abrir el editor SQL de Supabase <ExternalLink className="size-4" /></a>}
                    <button type="button" onClick={recargar} className="ml-auto rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-border hover:bg-surface-muted">Ya la ejecuté, comprobar</button>
                  </div>
                </>
              )}
            </section>
          )}

          {estado.carga?.sqlIndices && (
            <section className={`${tarjeta} space-y-3 border-amber-400/50 p-5`}>
              <h3 className="font-display text-lg font-semibold">Para que la carga no se detenga por «statement timeout»</h3>
              <p className="text-sm text-muted-foreground">
                Supabase agota el tiempo al contar lo guardado porque lee toda la tabla. La carga ya reintenta sola (espera y sigue), pero este SQL crea un índice que lo resuelve de raíz. Cópialo y ejecútalo una vez en el editor SQL de Supabase: tarda uno o dos minutos y se puede repetir sin problema.
              </p>
              <pre className="max-h-48 overflow-auto rounded-xl bg-[#0f1613] p-4 text-xs leading-relaxed text-emerald-100">{estado.carga.sqlIndices}</pre>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => { navigator.clipboard?.writeText(estado.carga?.sqlIndices ?? ""); setCopiadoIndices(true); setTimeout(() => setCopiadoIndices(false), 1600); }} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">{copiadoIndices ? <Check className="size-4" /> : <Copy className="size-4" />}{copiadoIndices ? "Copiado" : "Copiar SQL"}</button>
                {estado.carga.editorSql && <a href={estado.carga.editorSql} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">Abrir el editor SQL de Supabase <ExternalLink className="size-4" /></a>}
              </div>
            </section>
          )}

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
                          <button type="button" disabled={ocupado || avance(p, profundidad).hechos >= avance(p, profundidad).esperados} onClick={() => sincronizar({ eleccion: p.eleccion, corporacion: p.corporacion })} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-border hover:bg-surface-muted disabled:opacity-40">
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
              Los puestos y las mesas no se descargan en bloque (son más de cien mil por elección), así que Votaciones no los muestra mientras no estén guardados; lo mismo pasa con el análisis por puesto. En el Senado y la Cámara, los municipios y niveles inferiores guardan solo los candidatos con votos.
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
