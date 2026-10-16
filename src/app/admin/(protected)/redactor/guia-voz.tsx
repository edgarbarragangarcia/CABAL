"use client";

import * as React from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";

import { usePeticion } from "../analisis-publicaciones/peticion";

type Guia = { voz: string; mensajes: string; lineasRojas: string; hashtags: string; cuentas: string; actualizadoEn: string | null; actualizadoPor: string | null };
type Resp = { disponible: boolean; guia: Guia; puedeEditar: boolean };

const campo = "w-full rounded-xl border border-border bg-surface px-4 py-3 text-[15px] leading-relaxed outline-none transition placeholder:text-muted-foreground/60 hover:border-foreground/25 focus:border-brand focus:ring-4 focus:ring-brand/10 disabled:bg-surface-muted";

const SECCIONES: { clave: keyof Omit<Guia, "actualizadoEn" | "actualizadoPor">; titulo: string; ayuda: string; ejemplo: string }[] = [
  { clave: "voz", titulo: "Voz y tono", ayuda: "Cómo habla María Fernanda: registro, ritmo, palabras que usa y que evita.", ejemplo: "Ej.: directa y firme, frases cortas, sin tecnicismos; trata de «usted» a los ciudadanos…" },
  { clave: "mensajes", titulo: "Mensajes y temas clave", ayuda: "Las ideas que el equipo repite y los temas que se priorizan este mes.", ejemplo: "Ej.: seguridad rural, defensa del campo, control al gasto público…" },
  { clave: "lineasRojas", titulo: "Líneas rojas", ayuda: "Lo que NUNCA se dice ni se insinúa: temas vetados, acusaciones sin prueba, adjetivos prohibidos.", ejemplo: "Ej.: no acusar a personas por nombre sin sentencia; no hablar de procesos judiciales abiertos…" },
  { clave: "hashtags", titulo: "Hashtags y frases de marca", ayuda: "Los hashtags oficiales y las frases de cierre autorizadas.", ejemplo: "Ej.: #ConMaFe, «Firmes por la patria»…" },
  { clave: "cuentas", titulo: "Cuentas oficiales", ayuda: "Las cuentas del equipo, para no confundir ni etiquetar mal.", ejemplo: "Ej.: X: @MariaFdaCabal · Instagram: … · Facebook: … · TikTok: …" },
];

/** La guía de voz del equipo: la lee todo el equipo de redacción; la edita Dirección. La IA la recibe en cada redacción (solo para el estilo). */
export function GuiaVoz({ alCerrar }: { alCerrar: () => void }) {
  const r = usePeticion<Resp>("/api/admin/redactor/guia");
  const [g, setG] = React.useState<Guia | null>(null);
  const [msg, setMsg] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = React.useState(false);
  const actual = g ?? (r.estado === "listo" ? r.data.guia : null);

  async function guardar() {
    if (!actual) return;
    setGuardando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/redactor/guia", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voz: actual.voz, mensajes: actual.mensajes, lineasRojas: actual.lineasRojas, hashtags: actual.hashtags, cuentas: actual.cuentas }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "No se pudo guardar.");
      setMsg({ ok: true, texto: "Guía guardada. La IA la usará desde la próxima redacción." });
    } catch (err) {
      setMsg({ ok: false, texto: err instanceof Error ? err.message : "No se pudo guardar." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <button type="button" onClick={alCerrar} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Volver al tablero</button>
      <div>
        <h2 className="text-3xl"><span className="font-light">Guía de </span><span className="font-bold">voz</span></h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Lo que el equipo de redacción y redes necesita tener claro antes de escribir. La IA recibe esta guía en cada redacción solo para cuidar el tono, el vocabulario y las líneas rojas; nunca la toma como fuente de hechos.</p>
      </div>
      {r.estado === "cargando" && <p className="text-sm text-muted-foreground">Leyendo la guía…</p>}
      {r.estado === "error" && <p className="text-sm text-red-700">{r.error}</p>}
      {r.estado === "listo" && !r.data.disponible && <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm">Falta crear la tabla de la guía: vuelve a ejecutar <code>supabase/redactor.sql</code> en Supabase.</p>}
      {r.estado === "listo" && r.data.disponible && actual && (
        <>
          {!r.data.puedeEditar && <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted-foreground">Solo Dirección edita la guía. Aquí puedes leerla.</p>}
          <div className="grid gap-5 lg:grid-cols-2">
            {SECCIONES.map((sec) => (
              <label key={sec.clave} className={sec.clave === "voz" || sec.clave === "lineasRojas" ? "lg:col-span-1" : ""}>
                <span className="text-sm font-semibold">{sec.titulo}</span>
                <span className="mb-1.5 block text-xs text-muted-foreground">{sec.ayuda}</span>
                <textarea className={`${campo} min-h-36`} disabled={!r.data.puedeEditar} value={actual[sec.clave]} onChange={(ev) => setG({ ...actual, [sec.clave]: ev.target.value })} placeholder={sec.ejemplo} />
              </label>
            ))}
          </div>
          {r.data.puedeEditar && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={guardando} onClick={() => void guardar()} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50">{guardando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}Guardar guía</button>
              {r.data.guia.actualizadoEn && <span className="text-xs text-muted-foreground">Última edición: {new Date(r.data.guia.actualizadoEn).toLocaleString("es-CO")}{r.data.guia.actualizadoPor ? ` · ${r.data.guia.actualizadoPor.split("@")[0]}` : ""}</span>}
            </div>
          )}
          {msg && <p role="status" className={`rounded-xl px-4 py-3 text-sm font-medium ${msg.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300"}`}>{msg.texto}</p>}
        </>
      )}
    </div>
  );
}
