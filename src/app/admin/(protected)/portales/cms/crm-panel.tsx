"use client";

import * as React from "react";
import { Check, Copy, Download, ExternalLink, Loader2, Mail, MessageCircle, Phone, Plus, Search, ShieldCheck, Trash2, TriangleAlert, Upload, UserPlus, Users, X } from "lucide-react";

import { Kpis } from "@/components/admin/estilo-cabal";
import { ETAPAS, ORIGENES, TIPOS_INTERACCION, resumenCrmVacio, type Contacto, type Etapa, type Interaccion, type ResumenCrm } from "@/lib/portales/crm/tipos";
import type { Portal } from "@/lib/portales/store";
import { botonPrimario, botonSecundario, campo, etiquetaCampo, hace, mensajeDe, numero, pedir, tarjeta } from "./comun";

/**
 * CRM del portal: la gente que se suma a su comunidad. Cada persona tiene su etapa (de «nuevo» a «líder»), su historial y su
 * autorización para ser contactada; llegan por el formulario del portal, por inscripción a eventos o los agrega el equipo.
 * Es propio de cada portal: lo que ves aquí no se mezcla con los demás portales.
 */

type Estado =
  | { fase: "cargando" }
  | { fase: "sin-tablas"; sql: string; editorSql?: string }
  | { fase: "listo"; resumen: ResumenCrm };
type Lista = { contactos: Contacto[]; total: number; pagina: number; porPagina: number };
type Ficha = { contacto: Contacto; interacciones: Interaccion[]; eventos: { eventoId: string; titulo: string; iniciaEn: string; estado: string }[] };

const COLOR_ETAPA: Record<Etapa, string> = {
  nuevo: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  interesado: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  activo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  lider: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  inactivo: "bg-surface-muted text-muted-foreground",
};
const nombreEtapa = (e: string) => ETAPAS.find((x) => x.id === e)?.nombre ?? e;
const nombreOrigen = (o: string) => ORIGENES.find((x) => x.id === o)?.nombre ?? o;
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }) : "—");

/** Un número colombiano para WhatsApp: con 10 dígitos se le antepone el 57. */
function whatsapp(tel: string): string | null {
  const d = tel.replace(/\D/g, "");
  if (d.length === 10) return `https://wa.me/57${d}`;
  if (d.length >= 11 && d.length <= 15) return `https://wa.me/${d}`;
  return null;
}

export function CrmPanel({ portal }: { portal: Portal }) {
  const [estado, setEstado] = React.useState<Estado>({ fase: "cargando" });
  const [version, setVersion] = React.useState(0);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelado = false;
    pedir<{ disponible: boolean; sql?: string; editorSql?: string; resumen?: ResumenCrm }>(`/api/admin/portales/${portal.id}/crm`, "GET")
      .then((r) => {
        if (cancelado) return;
        setEstado(r.disponible ? { fase: "listo", resumen: r.resumen ?? resumenCrmVacio } : { fase: "sin-tablas", sql: r.sql ?? "", editorSql: r.editorSql });
      })
      .catch((e) => {
        if (!cancelado) setError(mensajeDe(e, "No se pudo abrir el CRM."));
      });
    return () => {
      cancelado = true;
    };
  }, [portal.id, version]);

  if (error) return <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>;
  if (estado.fase === "cargando") return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Abriendo el CRM…</p>;
  if (estado.fase === "sin-tablas") return <SinTablas sql={estado.sql} editorSql={estado.editorSql} recargar={() => setVersion((v) => v + 1)} />;
  return <Contactos portal={portal} resumen={estado.resumen} cambio={() => setVersion((v) => v + 1)} />;
}

function SinTablas({ sql, editorSql, recargar }: { sql: string; editorSql?: string; recargar: () => void }) {
  const [copiado, setCopiado] = React.useState(false);
  return (
    <div className={`${tarjeta} space-y-3 p-5`}>
      <p className="flex items-start gap-2 text-sm"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" /> Falta un paso en Supabase para activar el CRM de los portales: ejecutar este SQL una sola vez (se puede repetir sin problema).</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { void navigator.clipboard.writeText(sql); setCopiado(true); }} className={botonSecundario}><Copy className="size-4" /> {copiado ? "Copiado" : "Copiar el SQL"}</button>
        {editorSql && <a href={editorSql} target="_blank" rel="noreferrer noopener" className={botonSecundario}>Abrir el editor SQL de Supabase <ExternalLink className="size-4" /></a>}
        <button type="button" onClick={recargar} className={botonPrimario}>Ya lo ejecuté</button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-xl bg-surface-muted p-3 text-[11px]">{sql}</pre>
    </div>
  );
}

/* ----------------------------------------------------------------- lista ---- */

type Filtros = { q: string; etapa: string; origen: string; etiqueta: string; ciudad: string; sinConsentimiento: boolean };
const SIN_FILTROS: Filtros = { q: "", etapa: "", origen: "", etiqueta: "", ciudad: "", sinConsentimiento: false };

function queryDe(f: Filtros, pagina: number) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.etapa) p.set("etapa", f.etapa);
  if (f.origen) p.set("origen", f.origen);
  if (f.etiqueta) p.set("etiqueta", f.etiqueta);
  if (f.ciudad) p.set("ciudad", f.ciudad);
  if (f.sinConsentimiento) p.set("sinConsentimiento", "1");
  p.set("pagina", String(pagina));
  return p.toString();
}

function Contactos({ portal, resumen, cambio }: { portal: Portal; resumen: ResumenCrm; cambio: () => void }) {
  const [filtros, setFiltros] = React.useState<Filtros>(SIN_FILTROS);
  const [busqueda, setBusqueda] = React.useState("");
  const [pagina, setPagina] = React.useState(1);
  const [lista, setLista] = React.useState<Lista | null>(null);
  const [recarga, setRecarga] = React.useState(0);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const [modal, setModal] = React.useState<"nuevo" | "importar" | null>(null);
  const [aviso, setAviso] = React.useState<{ ok: boolean; texto: string } | null>(null);

  // La búsqueda espera a que se deje de escribir.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setFiltros((f) => (f.q === busqueda.trim() ? f : { ...f, q: busqueda.trim() }));
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const consulta = queryDe(filtros, pagina);
  React.useEffect(() => {
    let cancelado = false;
    pedir<Lista>(`/api/admin/portales/${portal.id}/contactos?${consulta}`, "GET")
      .then((r) => {
        if (!cancelado) setLista(r);
      })
      .catch((e) => {
        if (!cancelado) setAviso({ ok: false, texto: mensajeDe(e, "No se pudo leer la lista.") });
      });
    return () => {
      cancelado = true;
    };
  }, [portal.id, consulta, recarga]);

  const refrescar = () => {
    setRecarga((n) => n + 1);
    cambio();
  };
  const fijar = (c: Partial<Filtros>) => {
    setFiltros((f) => ({ ...f, ...c }));
    setPagina(1);
    setSel(new Set());
  };
  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(SIN_FILTROS);
  const paginas = lista ? Math.max(1, Math.ceil(lista.total / lista.porPagina)) : 1;

  async function masivo(cuerpo: Record<string, unknown>, ok: string) {
    setAviso(null);
    try {
      await pedir(`/api/admin/portales/${portal.id}/contactos/masivo`, "POST", { ids: [...sel], ...cuerpo });
      setAviso({ ok: true, texto: ok });
      setSel(new Set());
      refrescar();
    } catch (e) {
      setAviso({ ok: false, texto: mensajeDe(e, "No fue posible aplicar el cambio.") });
    }
  }

  const exportar = () => {
    const q = queryDe(filtros, 1);
    window.open(`/api/admin/portales/${portal.id}/contactos/exportar?${q}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-5">
      <Kpis
        items={[
          { etiqueta: "Personas en la comunidad", valor: numero(resumen.total), detalle: `${numero(resumen.nuevos30d)} nuevas en 30 días`, icono: Users },
          { etiqueta: "Participan", valor: numero(resumen.porEtapa.activo + resumen.porEtapa.lider), detalle: `${numero(resumen.porEtapa.lider)} líderes`, icono: UserPlus },
          { etiqueta: "Autorizaron comunicaciones", valor: numero(resumen.conConsentimiento), detalle: resumen.total > 0 ? `${Math.round((resumen.conConsentimiento / resumen.total) * 100)} % de la base` : "—", icono: ShieldCheck },
          { etiqueta: "Ya son afiliados", valor: numero(resumen.afiliados), detalle: "a la comunidad de María Fernanda Cabal", icono: Mail },
        ]}
      />

      <section className={`${tarjeta} space-y-4 p-5`}>
        <div>
          <h3 className="font-display text-lg font-semibold">Embudo de la comunidad</h3>
          <p className="text-sm text-muted-foreground">De la persona que llega a la que lidera. Pulsa una etapa para ver quiénes son.</p>
        </div>
        <ol className="grid gap-2 sm:grid-cols-5">
          {ETAPAS.map((e) => {
            const n = resumen.porEtapa[e.id];
            const activa = filtros.etapa === e.id;
            return (
              <li key={e.id}>
                <button type="button" onClick={() => fijar({ etapa: activa ? "" : e.id })} title={e.ayuda} className={`w-full rounded-xl border p-3 text-left transition ${activa ? "border-brand bg-brand-soft" : "border-border hover:bg-surface-muted"}`}>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${COLOR_ETAPA[e.id]}`}>{e.nombre}</span>
                  <span className="mt-1 block font-display text-2xl font-semibold tabular-nums">{numero(n)}</span>
                  <span className="text-[11px] text-muted-foreground">{resumen.total > 0 ? `${Math.round((n / resumen.total) * 100)} %` : "—"}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {(resumen.porOrigen.length > 0 || resumen.ciudades.length > 0) && (
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">De dónde llegan</p>
              <ul className="space-y-1.5">
                {resumen.porOrigen.map((o) => (
                  <li key={o.origen}>
                    <button type="button" onClick={() => fijar({ origen: filtros.origen === o.origen ? "" : o.origen })} className="grid w-full grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-2 text-left text-xs">
                      <span className={`truncate ${filtros.origen === o.origen ? "font-bold" : ""}`}>{nombreOrigen(o.origen)}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface-muted"><span className="block h-full rounded-full bg-brand" style={{ width: `${(o.n / resumen.total) * 100}%` }} /></span>
                      <span className="tabular-nums text-muted-foreground">{numero(o.n)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Ciudades con más gente</p>
              <ul className="flex flex-wrap gap-1.5">
                {resumen.ciudades.map((c) => (
                  <li key={c.ciudad}>
                    <button type="button" onClick={() => fijar({ ciudad: filtros.ciudad === c.ciudad ? "" : c.ciudad })} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${filtros.ciudad === c.ciudad ? "bg-brand text-brand-foreground ring-brand" : "ring-border hover:bg-surface-muted"}`}>
                      {c.ciudad} · {c.n}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className={`${tarjeta} space-y-3 p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 focus-within:border-brand">
            <Search className="size-4 text-muted-foreground" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, correo, teléfono o ciudad…" aria-label="Buscar personas" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <select aria-label="Origen" value={filtros.origen} onChange={(e) => fijar({ origen: e.target.value })} className="rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold">
            <option value="">Todos los orígenes</option>
            {ORIGENES.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" checked={filtros.sinConsentimiento} onChange={(e) => fijar({ sinConsentimiento: e.target.checked })} /> Sin autorización</label>
          {hayFiltros && <button type="button" onClick={() => { setBusqueda(""); fijar({ ...SIN_FILTROS }); }} className="text-xs font-semibold text-brand hover:underline">Quitar filtros</button>}
          <span className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => setModal("nuevo")} className={botonPrimario}><UserPlus className="size-4" /> Agregar persona</button>
            <button type="button" onClick={() => setModal("importar")} className={botonSecundario}><Upload className="size-4" /> Importar lista</button>
            <button type="button" onClick={exportar} className={botonSecundario}><Download className="size-4" /> Exportar CSV</button>
          </span>
        </div>

        {aviso && <p role="status" className={`flex items-start justify-between gap-3 rounded-xl p-3 text-sm ${aviso.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-rose-500/10 text-rose-800 dark:text-rose-300"}`}>{aviso.texto}<button type="button" aria-label="Cerrar" onClick={() => setAviso(null)}><X className="size-4" /></button></p>}

        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-soft p-2 text-xs font-semibold">
            <span>{sel.size} seleccionada{sel.size === 1 ? "" : "s"}</span>
            <select aria-label="Cambiar etapa" value="" onChange={(e) => e.target.value && void masivo({ etapa: e.target.value }, "Etapa actualizada.")} className="rounded-full border border-border bg-surface px-3 py-1.5">
              <option value="">Cambiar etapa…</option>
              {ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <button type="button" onClick={() => { const t = window.prompt("Etiquetas a agregar, separadas por coma")?.split(",").map((x) => x.trim()).filter(Boolean); if (t?.length) void masivo({ agregarEtiquetas: t }, "Etiquetas agregadas."); }} className="rounded-full bg-surface px-3 py-1.5">Etiquetar</button>
            <button type="button" onClick={() => { if (window.confirm(`¿Eliminar a ${sel.size} persona${sel.size === 1 ? "" : "s"} del portal? No se puede deshacer.`)) void masivo({ eliminar: true }, "Se eliminaron."); }} className="rounded-full bg-surface px-3 py-1.5 text-rose-700 dark:text-rose-300">Eliminar</button>
            <button type="button" onClick={() => setSel(new Set())} className="ml-auto">Quitar selección</button>
          </div>
        )}

        {!lista ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>
        ) : lista.contactos.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            <Users className="size-8" />
            {hayFiltros ? "Nadie coincide con esos filtros." : "Todavía no hay personas en este portal. Llegarán por el formulario del portal o por la inscripción a eventos, o puedes agregarlas tú."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="w-8 px-3 py-2.5"><input type="checkbox" aria-label="Seleccionar todas" checked={lista.contactos.every((c) => sel.has(c.id))} onChange={(e) => setSel(e.target.checked ? new Set(lista.contactos.map((c) => c.id)) : new Set())} /></th>
                  <th className="px-3 py-2.5 font-semibold">Persona</th>
                  <th className="px-3 py-2.5 font-semibold">Etapa</th>
                  <th className="px-3 py-2.5 font-semibold">Ciudad</th>
                  <th className="px-3 py-2.5 font-semibold">Origen</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Autoriza</th>
                  <th className="px-3 py-2.5 font-semibold">Se sumó</th>
                </tr>
              </thead>
              <tbody>
                {lista.contactos.map((c) => (
                  <tr key={c.id} onClick={() => setAbierto(c.id)} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted/60">
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Seleccionar a ${c.nombre}`} checked={sel.has(c.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} /></td>
                    <td className="max-w-[18rem] px-3 py-2.5">
                      <p className="truncate font-semibold">{c.nombre}{c.esAfiliado && <span title="Afiliado a la comunidad de María Fernanda Cabal" className="ml-1.5 rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand">AFILIADO</span>}</p>
                      <p className="truncate text-xs text-muted-foreground">{[c.email, c.telefono].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COLOR_ETAPA[c.etapa]}`}>{nombreEtapa(c.etapa)}</span></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{c.ciudad || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{nombreOrigen(c.origen)}</td>
                    <td className="px-3 py-2.5 text-center">{c.aceptaComunicaciones ? <ShieldCheck className="mx-auto size-4 text-emerald-600" aria-label="Autorizó" /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{hace(c.creadoEn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lista && lista.total > lista.porPagina && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{numero(lista.total)} personas · página {lista.pagina} de {paginas}</span>
            <span className="flex gap-2">
              <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className={botonSecundario}>Anterior</button>
              <button type="button" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)} className={botonSecundario}>Siguiente</button>
            </span>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Cada persona autorizó el tratamiento de sus datos al sumarse (Ley 1581 de 2012). Solo escribe a quien tiene la marca de autorización; las listas importadas empiezan sin ella.</p>
      </section>

      {abierto && <FichaContacto key={abierto} portalId={portal.id} id={abierto} cerrar={() => setAbierto(null)} cambio={refrescar} />}
      {modal === "nuevo" && <NuevaPersona portalId={portal.id} cerrar={() => setModal(null)} hecho={() => { setModal(null); refrescar(); }} />}
      {modal === "importar" && <Importar portalId={portal.id} cerrar={() => setModal(null)} hecho={() => { refrescar(); }} />}
    </div>
  );
}

/* ---------------------------------------------------------------- ficha ---- */

type Edicion = { nombre: string; email: string; telefono: string; ciudad: string; departamento: string; etapa: Etapa; intereses: string; etiquetas: string; aceptaComunicaciones: boolean; notas: string };

function FichaContacto({ portalId, id, cerrar, cambio }: { portalId: string; id: string; cerrar: () => void; cambio: () => void }) {
  const [ficha, setFicha] = React.useState<Ficha | null>(null);
  const [f, setF] = React.useState<Edicion | null>(null);
  const [error, setError] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  const [tipo, setTipo] = React.useState<"nota" | "llamada" | "mensaje" | "reunion">("nota");
  const [texto, setTexto] = React.useState("");
  const [recarga, setRecarga] = React.useState(0);

  React.useEffect(() => {
    let cancelado = false;
    pedir<Ficha>(`/api/admin/portales/${portalId}/contactos/${id}`, "GET")
      .then((r) => {
        if (cancelado) return;
        setFicha(r);
        const c = r.contacto;
        setF({ nombre: c.nombre, email: c.email ?? "", telefono: c.telefono, ciudad: c.ciudad, departamento: c.departamento, etapa: c.etapa, intereses: c.intereses.join(", "), etiquetas: c.etiquetas.join(", "), aceptaComunicaciones: c.aceptaComunicaciones, notas: c.notas });
      })
      .catch((e) => {
        if (!cancelado) setError(mensajeDe(e, "No se pudo abrir la ficha."));
      });
    return () => {
      cancelado = true;
    };
  }, [portalId, id, recarga]);

  const lista = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  async function guardar() {
    if (!f) return;
    setGuardando(true);
    setError("");
    try {
      await pedir(`/api/admin/portales/${portalId}/contactos/${id}`, "PUT", { ...f, intereses: lista(f.intereses), etiquetas: lista(f.etiquetas) });
      cambio();
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(mensajeDe(e, "No fue posible guardar."));
    } finally {
      setGuardando(false);
    }
  }

  async function anotar() {
    if (!texto.trim()) return;
    setError("");
    try {
      await pedir(`/api/admin/portales/${portalId}/contactos/${id}/interacciones`, "POST", { tipo, texto: texto.trim() });
      setTexto("");
      cambio();
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(mensajeDe(e, "No fue posible anotar."));
    }
  }

  async function eliminar() {
    if (!window.confirm("¿Eliminar a esta persona del portal? Se borra también su historial. No se puede deshacer.")) return;
    try {
      await pedir(`/api/admin/portales/${portalId}/contactos/${id}`, "DELETE");
      cambio();
      cerrar();
    } catch (e) {
      setError(mensajeDe(e, "No fue posible eliminar."));
    }
  }

  const c = ficha?.contacto;
  const wa = c ? whatsapp(c.telefono) : null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={cerrar}>
      <aside className="h-full w-full max-w-lg space-y-5 overflow-y-auto bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Ficha de la persona">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-semibold [overflow-wrap:anywhere]">{c?.nombre ?? "Cargando…"}</h3>
            {c && <p className="text-xs text-muted-foreground">En la comunidad desde {fecha(c.creadoEn)} · {nombreOrigen(c.origen)}{c.esAfiliado ? " · afiliado a la comunidad de María Fernanda Cabal" : ""}</p>}
          </div>
          <button type="button" aria-label="Cerrar" onClick={cerrar} className="rounded p-1 hover:bg-surface-muted"><X className="size-5" /></button>
        </div>

        {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
        {!f || !c ? (
          !error && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {c.email && <a href={`mailto:${c.email}`} className={botonSecundario}><Mail className="size-4" /> Escribir</a>}
              {wa && <a href={wa} target="_blank" rel="noreferrer noopener" className={botonSecundario}><MessageCircle className="size-4" /> WhatsApp</a>}
              {c.telefono && <a href={`tel:${c.telefono.replace(/[^\d+]/g, "")}`} className={botonSecundario}><Phone className="size-4" /> Llamar</a>}
            </div>
            {!c.aceptaComunicaciones && <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> Esta persona no ha autorizado comunicaciones: no le escribas campañas ni mensajes masivos hasta que lo haga.</p>}

            <form onSubmit={(e) => { e.preventDefault(); void guardar(); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 block text-xs font-semibold"><span className={etiquetaCampo}>Nombre</span><input className={campo} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} maxLength={120} /></label>
                <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Correo</span><input type="email" className={campo} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
                <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Teléfono</span><input className={campo} value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} maxLength={30} /></label>
                <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Ciudad</span><input className={campo} value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} maxLength={80} /></label>
                <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Departamento</span><input className={campo} value={f.departamento} onChange={(e) => setF({ ...f, departamento: e.target.value })} maxLength={80} /></label>
                <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Etapa</span>
                  <select className={campo} value={f.etapa} onChange={(e) => setF({ ...f, etapa: e.target.value as Etapa })}>{ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
                </label>
                <label className="flex items-end gap-2 pb-2.5 text-xs font-semibold"><input type="checkbox" checked={f.aceptaComunicaciones} onChange={(e) => setF({ ...f, aceptaComunicaciones: e.target.checked })} /> Autoriza comunicaciones</label>
                <label className="col-span-2 block text-xs font-semibold"><span className={etiquetaCampo}>Intereses (separados por coma)</span><input className={campo} value={f.intereses} onChange={(e) => setF({ ...f, intereses: e.target.value })} /></label>
                <label className="col-span-2 block text-xs font-semibold"><span className={etiquetaCampo}>Etiquetas (separadas por coma)</span><input className={campo} value={f.etiquetas} onChange={(e) => setF({ ...f, etiquetas: e.target.value })} placeholder="voluntario, periodista, líder barrial…" /></label>
                <label className="col-span-2 block text-xs font-semibold"><span className={etiquetaCampo}>Notas internas</span><textarea className={campo} rows={3} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} maxLength={2000} /></label>
              </div>
              <button type="submit" disabled={guardando} className={botonPrimario}>{guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar cambios</button>
            </form>

            {ficha!.eventos.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Eventos</h4>
                <ul className="space-y-1.5">
                  {ficha!.eventos.map((e) => (
                    <li key={e.eventoId} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                      <span className="min-w-0 flex-1 truncate font-semibold">{e.titulo}</span>
                      <span className="text-muted-foreground">{fecha(e.iniciaEn)}</span>
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold">{{ inscrito: "Inscrito", asistio: "Asistió", no_asistio: "No asistió", cancelado: "Canceló" }[e.estado] ?? e.estado}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Historial</h4>
              <div className="space-y-2 rounded-xl border border-border p-3">
                <div className="flex flex-wrap gap-1.5">
                  {TIPOS_INTERACCION.map((t) => <button key={t.id} type="button" onClick={() => setTipo(t.id)} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tipo === t.id ? "bg-brand text-brand-foreground ring-brand" : "ring-border"}`}>{t.nombre}</button>)}
                </div>
                <textarea className={campo} rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Qué pasó, qué acordaron, qué sigue…" maxLength={2000} />
                <button type="button" onClick={() => void anotar()} disabled={!texto.trim()} className={botonSecundario}><Plus className="size-4" /> Anotar en el historial</button>
              </div>
              <ul className="space-y-2">
                {ficha!.interacciones.length === 0 && <li className="text-xs text-muted-foreground">Sin movimientos todavía.</li>}
                {ficha!.interacciones.map((i) => (
                  <li key={i.id} className="rounded-lg bg-surface-muted/70 px-3 py-2 text-xs">
                    <p className="flex flex-wrap items-baseline gap-2"><span className="font-bold">{{ nota: "Nota", llamada: "Llamada", mensaje: "Mensaje", reunion: "Reunión", etapa: "Cambio de etapa", evento: "Evento", sistema: "Sistema" }[i.tipo]}</span><span className="text-muted-foreground">{hace(i.creadoEn)}{i.autor ? ` · ${i.autor}` : ""}</span></p>
                    <p className="mt-0.5 whitespace-pre-wrap">{i.texto}</p>
                  </li>
                ))}
              </ul>
            </div>

            <button type="button" onClick={() => void eliminar()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:underline dark:text-rose-300"><Trash2 className="size-3.5" /> Eliminar a esta persona</button>
          </>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------- agregar / importar ---- */

function Ventana({ titulo, cerrar, children }: { titulo: string; cerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={cerrar}>
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={titulo}>
        <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-semibold">{titulo}</h3><button type="button" aria-label="Cerrar" onClick={cerrar} className="rounded p-1 hover:bg-surface-muted"><X className="size-5" /></button></div>
        {children}
      </div>
    </div>
  );
}

function NuevaPersona({ portalId, cerrar, hecho }: { portalId: string; cerrar: () => void; hecho: () => void }) {
  const [f, setF] = React.useState({ nombre: "", email: "", telefono: "", ciudad: "", etiquetas: "", aceptaComunicaciones: false });
  const [error, setError] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      await pedir(`/api/admin/portales/${portalId}/contactos`, "POST", { ...f, etiquetas: f.etiquetas.split(",").map((x) => x.trim()).filter(Boolean), origen: "manual" });
      hecho();
    } catch (err) {
      setError(mensajeDe(err, "No fue posible agregar a la persona."));
    } finally {
      setGuardando(false);
    }
  }
  return (
    <Ventana titulo="Agregar una persona" cerrar={cerrar}>
      <form onSubmit={guardar} className="space-y-3">
        <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Nombre</span><input className={campo} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required minLength={2} maxLength={120} autoFocus /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Correo</span><input type="email" className={campo} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Teléfono</span><input className={campo} value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} maxLength={30} /></label>
          <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Ciudad</span><input className={campo} value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} maxLength={80} /></label>
          <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Etiquetas</span><input className={campo} value={f.etiquetas} onChange={(e) => setF({ ...f, etiquetas: e.target.value })} placeholder="voluntario, líder…" /></label>
        </div>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={f.aceptaComunicaciones} onChange={(e) => setF({ ...f, aceptaComunicaciones: e.target.checked })} /> La persona me autorizó a tratar sus datos y a escribirle (déjalo sin marcar si no lo tienes).</label>
        {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
        <div className="flex gap-2"><button type="submit" disabled={guardando} className={botonPrimario}>{guardando ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Agregar</button><button type="button" onClick={cerrar} className={botonSecundario}>Cancelar</button></div>
      </form>
    </Ventana>
  );
}

type FilaImport = { nombre: string; email: string; telefono: string; ciudad: string; etiquetas: string };

/** Lee texto pegado de una hoja de cálculo (o un CSV): detecta el separador y, si hay encabezados, los usa. */
function leerLista(texto: string): FilaImport[] {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lineas.length === 0) return [];
  const sep = lineas[0].includes("\t") ? "\t" : lineas[0].includes(";") ? ";" : ",";
  const partir = (l: string) => l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
  const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const cab = partir(lineas[0]).map(normal);
  const tieneCab = cab.some((c) => /^(nombre|name|correo|email|e-mail|telefono|celular|ciudad)/.test(c));
  const idx = (re: RegExp, def: number) => { const i = cab.findIndex((c) => re.test(c)); return tieneCab ? i : def; };
  const col = { nombre: idx(/^(nombre|name)/, 0), email: idx(/^(correo|email|e-mail)/, 1), telefono: idx(/^(telefono|celular|movil|whatsapp)/, 2), ciudad: idx(/^(ciudad|municipio)/, 3), etiquetas: idx(/^(etiqueta|tag)/, 4) };
  return (tieneCab ? lineas.slice(1) : lineas).map((l) => {
    const c = partir(l);
    const g = (i: number) => (i >= 0 ? (c[i] ?? "") : "");
    return { nombre: g(col.nombre), email: g(col.email), telefono: g(col.telefono), ciudad: g(col.ciudad), etiquetas: g(col.etiquetas) };
  });
}

function Importar({ portalId, cerrar, hecho }: { portalId: string; cerrar: () => void; hecho: () => void }) {
  const [texto, setTexto] = React.useState("");
  const [autoriza, setAutoriza] = React.useState(false);
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState("");
  const [resultado, setResultado] = React.useState<{ creados: number; omitidos: { fila: number; motivo: string }[] } | null>(null);
  const filas = React.useMemo(() => leerLista(texto), [texto]);

  async function enviar() {
    setEnviando(true);
    setError("");
    try {
      const r = await pedir<{ creados: number; omitidos: { fila: number; motivo: string }[] }>(`/api/admin/portales/${portalId}/contactos/importar`, "POST", { filas: filas.slice(0, 1000), confirmaAutorizacion: autoriza });
      setResultado(r);
      hecho();
    } catch (e) {
      setError(mensajeDe(e, "No fue posible importar la lista."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Ventana titulo="Importar una lista de personas" cerrar={cerrar}>
      {resultado ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">Se agregaron {numero(resultado.creados)} personas{resultado.omitidos.length > 0 ? ` y se omitieron ${numero(resultado.omitidos.length)}` : ""}.</p>
          {resultado.omitidos.length > 0 && (
            <ul className="max-h-48 space-y-1 overflow-auto rounded-xl bg-surface-muted p-3 text-xs">
              {resultado.omitidos.slice(0, 100).map((o) => <li key={o.fila}>Fila {o.fila}: {o.motivo}</li>)}
            </ul>
          )}
          <button type="button" onClick={cerrar} className={botonPrimario}>Listo</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Pega aquí las filas desde Excel o Google Sheets, o un CSV. Con encabezados <b>Nombre, Correo, Teléfono, Ciudad, Etiquetas</b> (o en ese orden). Hasta 1.000 filas por vez.</p>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} placeholder={"Nombre\tCorreo\tTeléfono\tCiudad\nAna Pérez\tana@correo.com\t3001234567\tMedellín"} className={`${campo} font-mono text-xs`} />
          <p className="text-xs text-muted-foreground">{filas.length > 0 ? `${numero(filas.length)} filas leídas${filas.length > 1000 ? " (se importarán las primeras 1.000)" : ""}.` : "Todavía no hay filas."}</p>
          <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={autoriza} onChange={(e) => setAutoriza(e.target.checked)} /> Confirmo que tengo autorización de estas personas para tratar sus datos y contactarlas. Quedan <b>sin</b> la marca de «autoriza comunicaciones» hasta que ellas la den.</label>
          {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={enviando || filas.length === 0 || !autoriza} onClick={() => void enviar()} className={botonPrimario}>{enviando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Importar</button>
            <button type="button" onClick={cerrar} className={botonSecundario}>Cancelar</button>
          </div>
        </div>
      )}
    </Ventana>
  );
}
