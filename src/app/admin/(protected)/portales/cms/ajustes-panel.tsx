"use client";

import * as React from "react";
import { Check, Copy, Loader2 } from "lucide-react";

import { CajaUnete } from "@/components/portales/cms";
import { construirAmbiente } from "@/components/portales/marco";
import type { AjustesPortal } from "@/lib/portales/cms/tipos";
import type { Portal } from "@/lib/portales/store";
import { botonPrimario, campo, datosVistaPrevia, etiquetaCampo, mensajeDe, pedir, tarjeta } from "./comun";

/**
 * Ajustes del portal: cómo invita a sumarse a la comunidad de María Fernanda Cabal (se ve al final de cada artículo y en el
 * inicio), quién lo edita, si lo ven los buscadores y cómo debe escribir la IA para este portal.
 */
export function AjustesPanel({ portal, ajustes, guardado }: { portal: Portal; ajustes: AjustesPortal; guardado: (a: AjustesPortal) => void }) {
  const [v, setV] = React.useState<AjustesPortal>(ajustes);
  const [ocupado, setOcupado] = React.useState(false);
  const [mensaje, setMensaje] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = React.useState(false);
  const { a, vars } = construirAmbiente({ plantilla: portal.plantilla, config: portal.config, demo: false, enlaces: false, idBase: "ajustes", cms: datosVistaPrevia(v) });
  const enlaceUnete = `/p/${portal.slug}/unete`;

  async function guardar() {
    setOcupado(true);
    setMensaje(null);
    try {
      const r = await pedir<{ ajustes: AjustesPortal }>(`/api/admin/portales/${portal.id}/ajustes`, "PUT", v);
      guardado(r.ajustes);
      setMensaje({ ok: true, texto: "Ajustes guardados." });
    } catch (e) {
      setMensaje({ ok: false, texto: mensajeDe(e, "No se pudieron guardar los ajustes.") });
    } finally {
      setOcupado(false);
    }
  }

  const union = (k: keyof AjustesPortal["union"], valor: string) => setV((x) => ({ ...x, union: { ...x.union, [k]: valor } }));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-5">
        <section className={`${tarjeta} space-y-4 p-5`}>
          <div>
            <h3 className="font-display text-lg font-semibold">Llamado a sumarse a la comunidad</h3>
            <p className="text-sm text-muted-foreground">Es el cuadro que invita a afiliarse a la comunidad de María Fernanda Cabal: sale al final de cada artículo, en su columna lateral y en el inicio del portal.</p>
          </div>
          <label className="block"><span className={etiquetaCampo}>Título</span><input className={campo} value={v.union.titulo} maxLength={90} onChange={(e) => union("titulo", e.target.value)} /></label>
          <label className="block"><span className={etiquetaCampo}>Texto</span><textarea className={`${campo} resize-none`} rows={3} value={v.union.texto} maxLength={240} onChange={(e) => union("texto", e.target.value)} /></label>
          <label className="block sm:max-w-xs"><span className={etiquetaCampo}>Texto del botón</span><input className={campo} value={v.union.boton} maxLength={30} onChange={(e) => union("boton", e.target.value)} /></label>
          <label className="block"><span className={etiquetaCampo}>Quién edita el portal (se muestra junto al llamado y en el pie)</span><input className={campo} value={v.editor} maxLength={120} onChange={(e) => setV((x) => ({ ...x, editor: e.target.value }))} /></label>
          <p className="text-xs text-muted-foreground">Dejarlo claro es lo honesto con quien lee y además da confianza: la gente sabe quién está detrás del portal.</p>
        </section>

        <section className={`${tarjeta} space-y-4 p-5`}>
          <div>
            <h3 className="font-display text-lg font-semibold">Buscadores</h3>
            <p className="text-sm text-muted-foreground">Mientras el portal esté en construcción déjalo oculto. Cuando tenga artículos que valga la pena leer, permite que Google lo muestre: es la forma de que llegue gente nueva sin pagar publicidad.</p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition hover:bg-surface-muted/60">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--color-brand,#047857)]" checked={v.buscadores} onChange={(e) => setV((x) => ({ ...x, buscadores: e.target.checked }))} />
            <span><span className="block text-sm font-semibold">Permitir que los buscadores muestren este portal</span><span className="block text-xs text-muted-foreground">Aplica al inicio, al listado y a los artículos publicados. Los borradores nunca se muestran.</span></span>
          </label>
        </section>

        <section className={`${tarjeta} space-y-4 p-5`}>
          <div>
            <h3 className="font-display text-lg font-semibold">Guía para la IA de este portal</h3>
            <p className="text-sm text-muted-foreground">La IA ya conoce la temática del portal y sus reglas (no inventar cifras, no recomendar marcas, no hacer propaganda). Aquí puedes agregarle lo propio de tu portal.</p>
          </div>
          <label className="block"><span className={etiquetaCampo}>Tono del portal (opcional)</span><input className={campo} placeholder="Ej.: cercano, tranquilo y esperanzador" value={v.ia.tono} maxLength={160} onChange={(e) => setV((x) => ({ ...x, ia: { ...x.ia, tono: e.target.value } }))} /></label>
          <label className="block"><span className={etiquetaCampo}>Indicaciones adicionales (opcional)</span><textarea className={`${campo} resize-none`} rows={4} placeholder="Ej.: Escribe pensando en familias de estrato 2 y 3. Termina siempre con un consejo práctico." value={v.ia.indicaciones} maxLength={800} onChange={(e) => setV((x) => ({ ...x, ia: { ...x.ia, indicaciones: e.target.value } }))} /></label>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={guardar} disabled={ocupado} className={botonPrimario}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar ajustes</button>
          {mensaje && <p role="status" className={`text-sm ${mensaje.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>{mensaje.texto}</p>}
        </div>
      </div>

      <aside className="space-y-5">
        <section className={`${tarjeta} space-y-3 p-5`}>
          <h3 className="font-display text-lg font-semibold">Así se ve</h3>
          <div style={vars} className="@container pointer-events-none rounded-2xl bg-[var(--fondo)] p-4 text-[var(--texto)]"><CajaUnete a={a} /></div>
        </section>
        <section className={`${tarjeta} space-y-3 p-5`}>
          <h3 className="font-display text-lg font-semibold">Enlace para tus redes</h3>
          <p className="text-sm text-muted-foreground">Compártelo en redes, correos o WhatsApp. Quien entre por aquí y se afilie queda anotado como llegado desde este portal.</p>
          <div className="flex items-center gap-2 rounded-xl bg-surface-muted p-3">
            <code className="min-w-0 flex-1 truncate text-sm">{enlaceUnete}</code>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}${enlaceUnete}`); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-surface">{copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copiado ? "Copiado" : "Copiar"}</button>
          </div>
          {portal.estado !== "publicado" && <p className="text-xs text-amber-700 dark:text-amber-300">El portal todavía no está en línea: el enlace solo funciona cuando lo despliegas.</p>}
        </section>
      </aside>
    </div>
  );
}
