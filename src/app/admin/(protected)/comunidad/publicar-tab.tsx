"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";

/** Publicar en la comunidad como la cuenta oficial de María Fernanda Cabal. */
export function PublicarTab() {
  const [texto, setTexto] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; texto: string } | null>(null);

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    const r = await fetch("/api/admin/comunidad", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }) });
    const b = await r.json().catch(() => ({}));
    setEnviando(false);
    if (r.ok) { setTexto(""); setMsg({ ok: true, texto: "Publicado en la cuenta oficial de María Fernanda Cabal." }); }
    else setMsg({ ok: false, texto: b.error ?? "No fue posible publicar." });
  }

  return (
    <form onSubmit={publicar} className="max-w-3xl rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <label className="text-sm font-semibold" htmlFor="oficial">Publicar como María Fernanda Cabal</label>
      <p className="mt-0.5 text-xs text-muted-foreground">Lo ven todos los afiliados en «Para ti». Usa #etiquetas para que el tema cuente en las tendencias.</p>
      <textarea id="oficial" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} rows={7} placeholder="Escribe el mensaje para toda la comunidad…" className="mt-3 w-full resize-y rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-brand" />
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={enviando || !texto.trim()} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">{enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Publicar</button>
        <span className="text-xs text-muted-foreground">{texto.length}/2000</span>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}>{msg.texto}</span>}
      </div>
    </form>
  );
}
