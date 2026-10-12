"use client";

import * as React from "react";
import { ArrowLeft, Check, Eye, Loader2, Mail, MailWarning, Plus, Send, Trash2, Users } from "lucide-react";

import type { Boletin, Segmento } from "@/lib/portales/crm/boletines-tipos";
import { ETAPAS, ORIGENES, type Etapa, type Origen } from "@/lib/portales/crm/tipos";
import type { Portal } from "@/lib/portales/store";
import { botonPrimario, botonSecundario, campo, cuandoLargo, etiquetaCampo, hace, mensajeDe, numero, pedir, tarjeta } from "./comun";
import { EditorMarkdown } from "./editor-markdown";

/**
 * Boletines: correos a la comunidad del portal. Se arman con el mismo editor de los artículos, se envían solo a quienes
 * autorizaron comunicaciones (y a ningún «inactivo» salvo que se elija), llevan enlace para darse de baja y quedan anotados en el
 * historial de cada persona. El envío necesita un proveedor de correo (Resend); sin él se puede preparar y ver cómo queda.
 */

type Forma = { asunto: string; cuerpo: string; segmento: Segmento };
const vacia: Forma = { asunto: "", cuerpo: "", segmento: {} };

const ESTADO: Record<Boletin["estado"], { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "bg-surface-muted text-muted-foreground" },
  enviando: { texto: "Enviando…", clase: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  enviada: { texto: "Enviado", clase: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  fallida: { texto: "Falló", clase: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
};

export function BoletinesPanel({ portal, avisar }: { portal: Portal; avisar: (t: string, ok?: boolean) => void }) {
  const [lista, setLista] = React.useState<Boletin[] | null>(null);
  const [correo, setCorreo] = React.useState<{ listo: boolean; desde: string | null } | null>(null);
  const [error, setError] = React.useState("");
  const [editor, setEditor] = React.useState<{ id: string | null; forma: Forma; estado: Boletin["estado"] } | null>(null);
  const [recarga, setRecarga] = React.useState(0);

  React.useEffect(() => {
    let cancelado = false;
    pedir<{ boletines: Boletin[]; correo: { listo: boolean; desde: string | null } }>(`/api/admin/portales/${portal.id}/boletines`, "GET")
      .then((r) => {
        if (cancelado) return;
        setLista(r.boletines);
        setCorreo(r.correo);
      })
      .catch((e) => {
        if (!cancelado) {
          setError(mensajeDe(e, "No se pudieron leer los boletines. ¿Ya ejecutaste supabase/portales-cms-pro.sql?"));
          setLista([]);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [portal.id, recarga]);

  if (editor) return <EditorBoletin portal={portal} correoListo={!!correo?.listo} id={editor.id} inicial={editor.forma} estadoInicial={editor.estado} avisar={avisar} volver={() => { setEditor(null); setRecarga((n) => n + 1); }} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold">Boletines</h3>
          <p className="text-sm text-muted-foreground">Escríbele a la comunidad de {portal.nombre}: novedades, invitaciones a eventos, las mejores lecturas.</p>
        </div>
        <button type="button" onClick={() => setEditor({ id: null, forma: vacia, estado: "borrador" })} className={botonPrimario}><Plus className="size-4" /> Nuevo boletín</button>
      </div>

      {correo && !correo.listo && (
        <div className="space-y-2 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
          <p className="flex items-center gap-2 font-semibold"><MailWarning className="size-4" /> Falta conectar el envío de correos</p>
          <p className="text-xs leading-relaxed">Puedes preparar boletines y ver cómo quedan, pero para enviarlos hace falta un proveedor de correo. Se usa <b>Resend</b>: crea una cuenta, verifica tu dominio y agrega en Vercel las variables <code className="rounded bg-black/10 px-1">RESEND_API_KEY</code> y <code className="rounded bg-black/10 px-1">CORREO_DESDE</code> (por ejemplo <i>Salud en Comunidad &lt;hola@tudominio.com&gt;</i>). Mientras tanto, desde «Comunidad» puedes exportar los contactos y escribirles con tu propio correo.</p>
        </div>
      )}
      {correo?.listo && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="size-4" /> Los correos salen desde <b className="text-foreground">{correo.desde}</b>.</p>}

      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
      {!lista && !error && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</p>}
      {lista && lista.length === 0 && !error && <div className={`${tarjeta} grid place-items-center gap-2 p-12 text-center text-sm text-muted-foreground`}><Mail className="size-8" />Todavía no has enviado boletines.</div>}
      {lista && lista.length > 0 && (
        <ul className={`${tarjeta} divide-y divide-border overflow-hidden`}>
          {lista.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1 basis-60">
                <button type="button" onClick={() => setEditor({ id: b.id, forma: { asunto: b.asunto, cuerpo: b.cuerpo, segmento: b.segmento }, estado: b.estado })} className="block max-w-full truncate text-left font-semibold hover:text-brand">{b.asunto}</button>
                <p className="text-xs text-muted-foreground">{b.estado === "enviada" || b.estado === "fallida" ? `${numero(b.enviados)} enviados${b.fallidos ? ` · ${numero(b.fallidos)} fallidos` : ""} · ${b.enviadaEn ? cuandoLargo(b.enviadaEn) : ""}` : `Creado ${hace(b.creadoEn)}`}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${ESTADO[b.estado].clase}`}>{ESTADO[b.estado].texto}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditorBoletin({ portal, correoListo, id, inicial, estadoInicial, avisar, volver }: { portal: Portal; correoListo: boolean; id: string | null; inicial: Forma; estadoInicial: Boletin["estado"]; avisar: (t: string, ok?: boolean) => void; volver: () => void }) {
  const [f, setF] = React.useState<Forma>(inicial);
  const [idActual, setIdActual] = React.useState(id);
  const [estado, setEstado] = React.useState(estadoInicial);
  const [ocupado, setOcupado] = React.useState<null | "guardar" | "vista" | "prueba" | "enviar">(null);
  const [vista, setVista] = React.useState<{ html: string } | null>(null);
  const [destinatarios, setDestinatarios] = React.useState<{ total: number; muestra: string[] } | null>(null);
  const [confirmar, setConfirmar] = React.useState(false);
  const bloqueado = estado !== "borrador";
  const clave = JSON.stringify(f.segmento);

  // Cuántas personas lo recibirían, con el segmento actual.
  React.useEffect(() => {
    let cancelado = false;
    const t = setTimeout(() => {
      pedir<{ total: number; muestra: string[] }>(`/api/admin/portales/${portal.id}/boletines/destinatarios`, "POST", JSON.parse(clave))
        .then((r) => {
          if (!cancelado) setDestinatarios(r);
        })
        .catch(() => {
          if (!cancelado) setDestinatarios(null);
        });
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [portal.id, clave]);

  const alternar = <T extends string>(lista: T[] | undefined, v: T): T[] | undefined => {
    const s = new Set(lista ?? []);
    if (s.has(v)) s.delete(v);
    else s.add(v);
    return s.size ? [...s] : undefined;
  };

  async function guardar(): Promise<string | null> {
    setOcupado("guardar");
    try {
      const r = idActual
        ? await pedir<{ boletin: Boletin }>(`/api/admin/portales/${portal.id}/boletines/${idActual}`, "PUT", f)
        : await pedir<{ boletin: Boletin }>(`/api/admin/portales/${portal.id}/boletines`, "POST", f);
      setIdActual(r.boletin.id);
      setEstado(r.boletin.estado);
      return r.boletin.id;
    } catch (e) {
      avisar(mensajeDe(e, "No se pudo guardar el boletín."), false);
      return null;
    } finally {
      setOcupado(null);
    }
  }

  async function verVistaPrevia() {
    const bid = bloqueado ? idActual : await guardar();
    if (!bid) return;
    setOcupado("vista");
    try {
      setVista(await pedir<{ html: string }>(`/api/admin/portales/${portal.id}/boletines/${bid}/vista`, "GET"));
    } catch (e) {
      avisar(mensajeDe(e, "No se pudo armar la vista previa."), false);
    } finally {
      setOcupado(null);
    }
  }

  async function prueba() {
    const para = window.prompt("¿A qué correo te lo mando de prueba?");
    if (!para) return;
    const bid = await guardar();
    if (!bid) return;
    setOcupado("prueba");
    try {
      await pedir(`/api/admin/portales/${portal.id}/boletines/${bid}/prueba`, "POST", { correo: para.trim() });
      avisar(`Prueba enviada a ${para.trim()}.`);
    } catch (e) {
      avisar(mensajeDe(e, "No se pudo enviar la prueba."), false);
    } finally {
      setOcupado(null);
    }
  }

  async function enviar() {
    const bid = await guardar();
    if (!bid) return;
    setOcupado("enviar");
    try {
      const r = await pedir<{ boletin: Boletin }>(`/api/admin/portales/${portal.id}/boletines/${bid}/enviar`, "POST", { confirmar: true });
      setEstado(r.boletin.estado);
      setConfirmar(false);
      avisar(r.boletin.estado === "enviada" ? `Boletín enviado a ${numero(r.boletin.enviados)} personas${r.boletin.fallidos ? ` (${numero(r.boletin.fallidos)} fallaron)` : ""}.` : "El envío falló: revisa la configuración del correo.", r.boletin.estado === "enviada");
    } catch (e) {
      avisar(mensajeDe(e, "No se pudo enviar el boletín."), false);
      setConfirmar(false);
    } finally {
      setOcupado(null);
    }
  }

  async function eliminar() {
    if (!idActual || !window.confirm("¿Eliminar este boletín?")) return;
    try {
      await pedir(`/api/admin/portales/${portal.id}/boletines/${idActual}`, "DELETE");
      volver();
    } catch (e) {
      avisar(mensajeDe(e, "No se pudo eliminar."), false);
    }
  }

  const chip = (activo: boolean) => `rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${activo ? "bg-brand text-brand-foreground ring-brand" : "ring-border hover:bg-surface-muted"}`;
  return (
    <div className="space-y-4">
      <div className={`${tarjeta} sticky top-2 z-30 flex flex-wrap items-center gap-3 px-4 py-3`}>
        <button type="button" onClick={volver} className={botonSecundario}><ArrowLeft className="size-4" /> Boletines</button>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${ESTADO[estado].clase}`}>{ESTADO[estado].texto}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => void verVistaPrevia()} disabled={!!ocupado || f.asunto.trim().length < 3} className={botonSecundario}>{ocupado === "vista" ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />} Vista previa</button>
          {!bloqueado && <button type="button" onClick={() => void guardar().then((b) => b && avisar("Boletín guardado."))} disabled={!!ocupado || f.asunto.trim().length < 3} className={botonSecundario}>{ocupado === "guardar" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar</button>}
          {!bloqueado && correoListo && <button type="button" onClick={() => void prueba()} disabled={!!ocupado || f.asunto.trim().length < 3} className={botonSecundario}>{ocupado === "prueba" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Enviarme una prueba</button>}
          {!bloqueado && <button type="button" onClick={() => setConfirmar(true)} disabled={!!ocupado || !correoListo || f.asunto.trim().length < 3 || f.cuerpo.trim().length < 20 || !destinatarios?.total} title={correoListo ? "Enviar a la comunidad" : "Falta conectar el proveedor de correo"} className={botonPrimario}><Send className="size-4" /> Enviar{destinatarios ? ` a ${numero(destinatarios.total)}` : ""}</button>}
        </div>
      </div>

      {bloqueado && <p className="rounded-xl bg-surface-muted p-4 text-sm text-muted-foreground">Este boletín ya se envió y no se puede editar. Crea uno nuevo para escribir otro.</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className={`${tarjeta} space-y-4 p-5`}>
          <label className="block"><span className={etiquetaCampo}>Asunto</span><input className={`${campo} text-base font-semibold`} value={f.asunto} maxLength={150} disabled={bloqueado} onChange={(e) => setF({ ...f, asunto: e.target.value })} placeholder="Lo que verán en su bandeja de entrada" /></label>
          <EditorMarkdown valor={f.cuerpo} alCambiar={(v) => !bloqueado && setF({ ...f, cuerpo: v })} maxLength={20_000} alto="min-h-[22rem]" etiqueta="Mensaje" placeholder={"Hola,\n\nTe contamos lo nuevo en la comunidad…\n\n## Próximo encuentro\n\n- Sábado, 9:00 a. m.\n\nUn abrazo."} />
          <p className="text-xs text-muted-foreground">Al final del correo se agregan solos el botón del portal, el aviso de por qué lo reciben y el enlace para darse de baja.</p>
        </div>

        <aside className="space-y-3">
          <section className={`${tarjeta} space-y-3 p-4`}>
            <p className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4 text-brand" /> A quién le llega</p>
            <div>
              <span className={etiquetaCampo}>Etapa (vacío = todas menos «inactivo»)</span>
              <div className="flex flex-wrap gap-1.5">{ETAPAS.map((e) => <button key={e.id} type="button" disabled={bloqueado} onClick={() => setF({ ...f, segmento: { ...f.segmento, etapas: alternar<Etapa>(f.segmento.etapas, e.id) } })} className={chip(!!f.segmento.etapas?.includes(e.id))}>{e.nombre}</button>)}</div>
            </div>
            <div>
              <span className={etiquetaCampo}>Origen</span>
              <div className="flex flex-wrap gap-1.5">{ORIGENES.map((o) => <button key={o.id} type="button" disabled={bloqueado} onClick={() => setF({ ...f, segmento: { ...f.segmento, origenes: alternar<Origen>(f.segmento.origenes, o.id) } })} className={chip(!!f.segmento.origenes?.includes(o.id))}>{o.nombre}</button>)}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block"><span className={etiquetaCampo}>Etiqueta</span><input className={campo} value={f.segmento.etiqueta ?? ""} disabled={bloqueado} maxLength={40} onChange={(e) => setF({ ...f, segmento: { ...f.segmento, etiqueta: e.target.value || undefined } })} /></label>
              <label className="block"><span className={etiquetaCampo}>Ciudad</span><input className={campo} value={f.segmento.ciudad ?? ""} disabled={bloqueado} maxLength={80} onChange={(e) => setF({ ...f, segmento: { ...f.segmento, ciudad: e.target.value || undefined } })} /></label>
            </div>
            <div className="rounded-xl bg-surface-muted p-3 text-xs">
              <p className="text-2xl font-semibold tabular-nums">{destinatarios ? numero(destinatarios.total) : "—"}</p>
              <p className="text-muted-foreground">personas con correo y autorización para recibirlo{destinatarios?.muestra.length ? `: ${destinatarios.muestra.join(", ")}…` : "."}</p>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">Nunca se le escribe a quien no autorizó comunicaciones ni a quien ya se dio de baja.</p>
          </section>
          {idActual && !bloqueado && <button type="button" onClick={() => void eliminar()} className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:underline dark:text-rose-300"><Trash2 className="size-3.5" /> Eliminar este boletín</button>}
        </aside>
      </div>

      {vista && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal aria-label="Vista previa del boletín" onClick={() => setVista(null)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3"><h3 className="text-sm font-semibold">Así llegará al correo</h3><button type="button" onClick={() => setVista(null)} className={botonSecundario}>Cerrar</button></div>
            <iframe title="Vista previa del boletín" sandbox="" srcDoc={vista.html} className="h-[70dvh] w-full bg-white" />
          </div>
        </div>
      )}

      {confirmar && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" role="alertdialog" aria-modal aria-label="Confirmar el envío">
          <div className="w-full max-w-md space-y-4 rounded-3xl bg-surface p-6 shadow-2xl">
            <h3 className="font-display text-xl font-semibold">¿Enviar este boletín?</h3>
            <p className="text-sm text-muted-foreground">Le llegará a <b className="text-foreground">{destinatarios ? numero(destinatarios.total) : 0} personas</b> con el asunto «<b className="text-foreground">{f.asunto}</b>». Un correo enviado no se puede deshacer.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void enviar()} disabled={ocupado === "enviar"} className={botonPrimario}>{ocupado === "enviar" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Sí, enviar ahora</button>
              <button type="button" onClick={() => setConfirmar(false)} disabled={ocupado === "enviar"} className={botonSecundario}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
