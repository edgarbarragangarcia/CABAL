"use client";

import * as React from "react";
import { CalendarDays, Check, Copy, ExternalLink, Loader2, MapPin, Plus, Trash2, Users, Video, X } from "lucide-react";

import type { DatosEvento, Evento, Inscripcion } from "@/lib/portales/crm/tipos";
import type { Portal } from "@/lib/portales/store";
import { botonPrimario, botonSecundario, campo, etiquetaCampo, mensajeDe, numero, pedir, tarjeta } from "./comun";

/**
 * Agenda del portal: encuentros, charlas, foros y jornadas. Cada evento tiene su página pública con formulario de inscripción;
 * quien se inscribe entra al CRM del portal y, si el equipo marca que asistió, sube de etapa.
 */

type Forma = {
  titulo: string;
  descripcion: string;
  categoria: string;
  inicia: string; // yyyy-MM-ddTHH:mm (hora local de Colombia)
  termina: string;
  modalidad: "presencial" | "virtual" | "mixta";
  lugar: string;
  ciudad: string;
  enlaceVirtual: string;
  cupo: string;
  estado: "borrador" | "publicado" | "cancelado";
};

const VACIA: Forma = { titulo: "", descripcion: "", categoria: "", inicia: "", termina: "", modalidad: "presencial", lugar: "", ciudad: "", enlaceVirtual: "", cupo: "", estado: "borrador" };

/** De un instante UTC al valor de un campo datetime-local en hora de Colombia (UTC-5, sin horario de verano). */
const aCampo = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0, 16) : "");
/** Del campo datetime-local (hora de Colombia) a un instante ISO. */
const deCampo = (v: string) => (v ? new Date(`${v}:00-05:00`).toISOString() : "");

const cuando = (iso: string) => new Date(iso).toLocaleString("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

const ETIQ_ESTADO = { borrador: "Borrador", publicado: "Publicado", cancelado: "Cancelado" } as const;
const CLASE_ESTADO = {
  borrador: "bg-surface-muted text-muted-foreground",
  publicado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelado: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
} as const;

export function EventosPanel({ portal }: { portal: Portal }) {
  const [eventos, setEventos] = React.useState<Evento[] | null>(null);
  const [error, setError] = React.useState("");
  const [editando, setEditando] = React.useState<{ id: string | null; forma: Forma } | null>(null);
  const [verInscritos, setVerInscritos] = React.useState<Evento | null>(null);
  const [recarga, setRecarga] = React.useState(0);
  // «Ahora» se fija al leer la agenda (no al dibujar), para que la pantalla no cambie de un dibujo a otro.
  const [ahora, setAhora] = React.useState(0);
  const recargar = () => setRecarga((n) => n + 1);

  React.useEffect(() => {
    let cancelado = false;
    pedir<{ eventos: Evento[] }>(`/api/admin/portales/${portal.id}/eventos`, "GET")
      .then((r) => {
        if (cancelado) return;
        setEventos(r.eventos);
        setAhora(Date.now());
      })
      .catch((e) => {
        if (!cancelado) setError(mensajeDe(e, "No se pudo leer la agenda. ¿Ya ejecutaste supabase/portales-crm.sql?"));
      });
    return () => {
      cancelado = true;
    };
  }, [portal.id, recarga]);

  const proximos = (eventos ?? []).filter((e) => e.estado !== "cancelado" && Date.parse(e.terminaEn ?? e.iniciaEn) >= ahora - 3 * 3_600_000).sort((a, b) => a.iniciaEn.localeCompare(b.iniciaEn));
  const pasados = (eventos ?? []).filter((e) => !proximos.includes(e));

  const abrir = (e?: Evento) =>
    setEditando(
      e
        ? { id: e.id, forma: { titulo: e.titulo, descripcion: e.descripcion, categoria: e.categoria, inicia: aCampo(e.iniciaEn), termina: aCampo(e.terminaEn), modalidad: e.modalidad, lugar: e.lugar, ciudad: e.ciudad, enlaceVirtual: e.enlaceVirtual, cupo: e.cupo ? String(e.cupo) : "", estado: e.estado } }
        : { id: null, forma: { ...VACIA, ciudad: portal.config.ciudad } }
    );

  const Fila = ({ e }: { e: Evento }) => (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-center text-brand">
        <span className="leading-none"><span className="block text-[10px] font-bold uppercase">{new Date(e.iniciaEn).toLocaleDateString("es-CO", { month: "short", timeZone: "America/Bogota" })}</span><span className="block text-lg font-bold">{new Date(e.iniciaEn).toLocaleDateString("es-CO", { day: "numeric", timeZone: "America/Bogota" })}</span></span>
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate text-sm font-semibold">{e.titulo}</p>
        <p className="truncate text-xs text-muted-foreground">{cuando(e.iniciaEn)} · {e.modalidad === "virtual" ? "Virtual" : [e.lugar, e.ciudad].filter(Boolean).join(", ") || "Sin lugar"}</p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${CLASE_ESTADO[e.estado]}`}>{ETIQ_ESTADO[e.estado]}</span>
      <button type="button" onClick={() => setVerInscritos(e)} className={botonSecundario} title="Ver quién se inscribió"><Users className="size-4" /> {numero(e.inscritos)}{e.cupo ? ` / ${numero(e.cupo)}` : ""}</button>
      <button type="button" onClick={() => abrir(e)} className={botonSecundario}>Editar</button>
    </li>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold">Agenda de eventos</h3>
          <p className="text-sm text-muted-foreground">Encuentros, charlas, foros y jornadas de {portal.nombre}. Quien se inscribe entra a la comunidad del portal.</p>
        </div>
        {portal.estado === "publicado" && <a href={`/p/${portal.slug}/eventos`} target="_blank" rel="noreferrer noopener" className={botonSecundario}>Ver la agenda pública <ExternalLink className="size-4" /></a>}
        <button type="button" onClick={() => abrir()} className={botonPrimario}><Plus className="size-4" /> Nuevo evento</button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
      {!eventos && !error && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>}

      {eventos && (
        <>
          <section className={`${tarjeta} p-5`}>
            <h4 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Próximos</h4>
            {proximos.length === 0 ? (
              <div className="mt-3 grid place-items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                <CalendarDays className="size-8" />
                No hay eventos próximos. Crea el primero: es la forma más directa de que la gente del portal se conozca y participe.
              </div>
            ) : (
              <ul className="mt-1 divide-y divide-border">{proximos.map((e) => <Fila key={e.id} e={e} />)}</ul>
            )}
          </section>
          {pasados.length > 0 && (
            <section className={`${tarjeta} p-5`}>
              <h4 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Pasados y cancelados</h4>
              <ul className="mt-1 divide-y divide-border">{pasados.map((e) => <Fila key={e.id} e={e} />)}</ul>
            </section>
          )}
        </>
      )}

      {editando && <FormaEvento portal={portal} inicial={editando} cerrar={() => setEditando(null)} hecho={() => { setEditando(null); recargar(); }} />}
      {verInscritos && <Inscritos portal={portal} evento={verInscritos} cerrar={() => { setVerInscritos(null); recargar(); }} />}
    </div>
  );
}

function FormaEvento({ portal, inicial, cerrar, hecho }: { portal: Portal; inicial: { id: string | null; forma: Forma }; cerrar: () => void; hecho: () => void }) {
  const [f, setF] = React.useState<Forma>(inicial.forma);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState("");

  async function guardar(estado?: Forma["estado"]) {
    setGuardando(true);
    setError("");
    const cuerpo: DatosEvento = {
      titulo: f.titulo,
      descripcion: f.descripcion,
      categoria: f.categoria,
      iniciaEn: deCampo(f.inicia),
      terminaEn: deCampo(f.termina),
      modalidad: f.modalidad,
      lugar: f.lugar,
      ciudad: f.ciudad,
      enlaceVirtual: f.enlaceVirtual,
      cupo: f.cupo ? Number(f.cupo) : null,
      estado: estado ?? f.estado,
    };
    try {
      if (!f.inicia) throw new Error("Escribe cuándo empieza el evento.");
      if (inicial.id) await pedir(`/api/admin/portales/${portal.id}/eventos/${inicial.id}`, "PUT", cuerpo);
      else await pedir(`/api/admin/portales/${portal.id}/eventos`, "POST", cuerpo);
      hecho();
    } catch (e) {
      setError(mensajeDe(e, "No fue posible guardar el evento."));
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!inicial.id || !window.confirm("¿Eliminar este evento? Se borran también sus inscripciones. No se puede deshacer.")) return;
    try {
      await pedir(`/api/admin/portales/${portal.id}/eventos/${inicial.id}`, "DELETE");
      hecho();
    } catch (e) {
      setError(mensajeDe(e, "No fue posible eliminarlo."));
    }
  }

  const presencial = f.modalidad !== "virtual";
  const virtual = f.modalidad !== "presencial";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={cerrar}>
      <form onSubmit={(e) => { e.preventDefault(); void guardar(); }} onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl bg-surface p-5 shadow-2xl" role="dialog" aria-label="Evento">
        <div className="flex items-center justify-between"><h3 className="font-display text-lg font-semibold">{inicial.id ? "Editar evento" : "Nuevo evento"}</h3><button type="button" aria-label="Cerrar" onClick={cerrar} className="rounded p-1 hover:bg-surface-muted"><X className="size-5" /></button></div>
        <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Título</span><input className={campo} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required minLength={3} maxLength={160} autoFocus /></label>
        <label className="block text-xs font-semibold"><span className={etiquetaCampo}>De qué trata</span><textarea className={campo} rows={4} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} maxLength={5000} placeholder="Qué se va a hacer, quién lo dirige y a quién está dirigido." /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Empieza (hora de Colombia)</span><input type="datetime-local" className={campo} value={f.inicia} onChange={(e) => setF({ ...f, inicia: e.target.value })} required /></label>
          <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Termina (opcional)</span><input type="datetime-local" className={campo} value={f.termina} onChange={(e) => setF({ ...f, termina: e.target.value })} /></label>
          <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Modalidad</span>
            <select className={campo} value={f.modalidad} onChange={(e) => setF({ ...f, modalidad: e.target.value as Forma["modalidad"] })}><option value="presencial">Presencial</option><option value="virtual">Virtual</option><option value="mixta">Mixta</option></select>
          </label>
          <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Cupo (vacío = sin límite)</span><input type="number" min={1} className={campo} value={f.cupo} onChange={(e) => setF({ ...f, cupo: e.target.value })} /></label>
          {presencial && <label className="block text-xs font-semibold"><span className={etiquetaCampo}><MapPin className="mr-1 inline size-3" />Lugar</span><input className={campo} value={f.lugar} onChange={(e) => setF({ ...f, lugar: e.target.value })} maxLength={160} placeholder="Auditorio, dirección…" /></label>}
          {presencial && <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Ciudad</span><input className={campo} value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} maxLength={80} /></label>}
          {virtual && <label className="col-span-2 block text-xs font-semibold"><span className={etiquetaCampo}><Video className="mr-1 inline size-3" />Enlace de la sala (solo lo ven los inscritos que confirmen)</span><input className={campo} value={f.enlaceVirtual} onChange={(e) => setF({ ...f, enlaceVirtual: e.target.value })} placeholder="https://…" /></label>}
          <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Categoría</span><input className={campo} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} maxLength={40} placeholder="Foro, taller, jornada…" /></label>
          <label className="block text-xs font-semibold"><span className={etiquetaCampo}>Estado</span>
            <select className={campo} value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value as Forma["estado"] })}><option value="borrador">Borrador (no se ve)</option><option value="publicado">Publicado</option><option value="cancelado">Cancelado</option></select>
          </label>
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={guardando} className={botonPrimario}>{guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar</button>
          {f.estado !== "publicado" && <button type="button" disabled={guardando} onClick={() => void guardar("publicado")} className={botonSecundario}>Guardar y publicar</button>}
          {inicial.id && <button type="button" onClick={() => void eliminar()} className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:underline dark:text-rose-300"><Trash2 className="size-3.5" /> Eliminar</button>}
        </div>
      </form>
    </div>
  );
}

function Inscritos({ portal, evento, cerrar }: { portal: Portal; evento: Evento; cerrar: () => void }) {
  const [lista, setLista] = React.useState<Inscripcion[] | null>(null);
  const [error, setError] = React.useState("");
  const [copiado, setCopiado] = React.useState(false);
  const [recarga, setRecarga] = React.useState(0);

  React.useEffect(() => {
    let cancelado = false;
    pedir<{ inscripciones: Inscripcion[] }>(`/api/admin/portales/${portal.id}/eventos/${evento.id}`, "GET")
      .then((r) => {
        if (!cancelado) setLista(r.inscripciones);
      })
      .catch((e) => {
        if (!cancelado) setError(mensajeDe(e, "No se pudo leer la lista."));
      });
    return () => {
      cancelado = true;
    };
  }, [portal.id, evento.id, recarga]);

  async function marcar(contactoId: string, estado: Inscripcion["estado"]) {
    setError("");
    try {
      await pedir(`/api/admin/portales/${portal.id}/eventos/${evento.id}/inscripciones`, "PUT", { contactoId, estado });
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(mensajeDe(e, "No fue posible marcar la asistencia."));
    }
  }

  const url = typeof window !== "undefined" ? `${window.location.origin}/p/${portal.slug}/eventos/${evento.slug}` : "";
  const asistieron = (lista ?? []).filter((i) => i.estado === "asistio").length;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={cerrar}>
      <aside className="h-full w-full max-w-lg space-y-4 overflow-y-auto bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Inscritos">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1"><h3 className="font-display text-lg font-semibold [overflow-wrap:anywhere]">{evento.titulo}</h3><p className="text-xs text-muted-foreground">{cuando(evento.iniciaEn)}</p></div>
          <button type="button" aria-label="Cerrar" onClick={cerrar} className="rounded p-1 hover:bg-surface-muted"><X className="size-5" /></button>
        </div>
        {evento.estado === "publicado" && portal.estado === "publicado" && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void navigator.clipboard.writeText(url); setCopiado(true); }} className={botonSecundario}><Copy className="size-4" /> {copiado ? "Enlace copiado" : "Copiar el enlace del evento"}</button>
            <a href={`/p/${portal.slug}/eventos/${evento.slug}`} target="_blank" rel="noreferrer noopener" className={botonSecundario}>Abrir <ExternalLink className="size-4" /></a>
          </div>
        )}
        {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
        {!lista && !error ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>
        ) : lista && lista.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Todavía nadie se ha inscrito.</p>
        ) : lista ? (
          <>
            <p className="text-sm text-muted-foreground">{numero(lista.filter((i) => i.estado !== "cancelado").length)} inscritos · {numero(asistieron)} asistieron. Al marcar «Asistió», la persona sube a «Activo» en el CRM.</p>
            <ul className="divide-y divide-border">
              {lista.map((i) => (
                <li key={i.contactoId} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1 basis-40"><p className="truncate text-sm font-semibold">{i.nombre}</p><p className="truncate text-xs text-muted-foreground">{[i.email, i.telefono].filter(Boolean).join(" · ")}</p></div>
                  <select aria-label={`Estado de ${i.nombre}`} value={i.estado} onChange={(e) => void marcar(i.contactoId, e.target.value as Inscripcion["estado"])} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold">
                    <option value="inscrito">Inscrito</option><option value="asistio">Asistió</option><option value="no_asistio">No asistió</option><option value="cancelado">Canceló</option>
                  </select>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </aside>
    </div>
  );
}
