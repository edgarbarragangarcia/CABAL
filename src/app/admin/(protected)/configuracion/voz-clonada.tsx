"use client";

import * as React from "react";
import { AudioLines, Check, Loader2 } from "lucide-react";

type Estado = { activa: false } | { activa: true; vozId: string; autorizadaPor: string; autorizadaEn: string; clave: string };

/** Voz clonada de la Dra. para el asistente (ElevenLabs). Solo se activa con la confirmación expresa de que ella la autorizó. */
export function VozClonada() {
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [clave, setClave] = React.useState("");
  const [vozId, setVozId] = React.useState("");
  const [por, setPor] = React.useState("");
  const [autoriza, setAutoriza] = React.useState(false);
  const [trabajando, setTrabajando] = React.useState(false);
  const [error, setError] = React.useState("");

  const cargar = React.useCallback(() => { fetch("/api/admin/configuracion/voz-clonada", { cache: "no-store" }).then((r) => r.json()).then(setEstado).catch(() => setEstado({ activa: false })); }, []);
  React.useEffect(() => { cargar(); }, [cargar]);

  async function activar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setTrabajando(true);
    try {
      const r = await fetch("/api/admin/configuracion/voz-clonada", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave, vozId, autorizacion: autoriza, autorizadaPor: por }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "No se pudo activar.");
      setClave(""); setVozId(""); setAutoriza(false);
      cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar.");
    } finally {
      setTrabajando(false);
    }
  }

  async function quitar() {
    setTrabajando(true);
    await fetch("/api/admin/configuracion/voz-clonada", { method: "DELETE" }).catch(() => null);
    setTrabajando(false);
    cargar();
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-3xl space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><AudioLines className="size-4 text-brand" aria-hidden="true" /> Voz clonada de la Dra. (asistente)</h2>
        <p className="mt-1 text-sm text-muted-foreground">Hace que MaFe hable con la voz de la Dra. Solo con su autorización expresa: la voz la crea ella misma, en ElevenLabs, con su propia grabación y su verificación.</p>
      </div>
      {estado?.activa ? (
        <div className="space-y-2 rounded-xl bg-brand-soft p-3 text-sm">
          <p className="flex items-center gap-1.5 font-semibold"><Check className="size-4" aria-hidden="true" /> Activa · voz {estado.vozId} · clave {estado.clave}</p>
          <p className="text-muted-foreground">Autorización confirmada por {estado.autorizadaPor} el {new Date(estado.autorizadaEn).toLocaleDateString("es-CO")}. El asistente avisa en pantalla que es una voz sintética.</p>
          <button type="button" onClick={() => void quitar()} disabled={trabajando} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold">Desactivar la voz clonada</button>
        </div>
      ) : (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>La Dra. entra a <b>elevenlabs.io</b> y crea una voz con <b>Instant Voice Cloning</b> subiendo su propia grabación (unos 2 a 5 minutos de audio limpio).</li>
            <li>Copia el <b>ID de la voz</b> (en «Voices», el icono de ID) y una <b>clave de API</b> (Configuración → API Keys).</li>
            <li>Pégalos aquí y confirma la autorización. Se comprueba que la voz exista en la cuenta antes de guardarla.</li>
          </ol>
          <form onSubmit={activar} className="space-y-3">
            <input type="password" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Clave de API de ElevenLabs" aria-label="Clave de API de ElevenLabs" className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm" />
            <input value={vozId} onChange={(e) => setVozId(e.target.value)} placeholder="ID de la voz" aria-label="ID de la voz" className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm" />
            <input value={por} onChange={(e) => setPor(e.target.value)} placeholder="Nombre de quien confirma la autorización" aria-label="Nombre de quien confirma la autorización" className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm" />
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={autoriza} onChange={(e) => setAutoriza(e.target.checked)} className="mt-1" /> <span>Confirmo que la Dra. María Fernanda Cabal autorizó de forma expresa clonar su voz y usarla en este asistente, y que fue ella quien grabó el audio.</span></label>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-2 text-sm text-red-800">{error}</p>}
            <button type="submit" disabled={trabajando || !clave || !vozId || !por || !autoriza} className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">{trabajando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Activar la voz clonada</button>
          </form>
        </>
      )}
    </section>
  );
}
