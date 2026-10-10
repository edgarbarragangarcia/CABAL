"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Send, Users } from "lucide-react";

type Estado = { configurada: boolean; afiliados: number; error?: string };

export default function ComunidadAdminPage() {
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [texto, setTexto] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; texto: string } | null>(null);

  React.useEffect(() => { fetch("/api/admin/comunidad").then((r) => r.json()).then(setEstado).catch(() => setEstado({ configurada: false, afiliados: 0 })); }, []);

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
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Users className="size-6 text-brand" /> Comunidad</h1>
        <p className="mt-1 text-sm text-muted-foreground">Afiliados y publicaciones de la cuenta oficial.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-lg"><p className="text-xs text-white/85">Afiliados</p><p className="mt-1 text-3xl font-bold">{estado ? estado.afiliados.toLocaleString("es-CO") : "…"}</p></div>
        <Link href="/unete" target="_blank" className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 p-4 text-white shadow-lg"><p className="text-xs text-white/85">Formulario público</p><p className="flex items-center gap-1.5 font-semibold">/unete <ExternalLink className="size-4" /></p></Link>
      </div>

      {estado && (!estado.configurada || estado.error) && (
        <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          {!estado.configurada ? "Falta conectar Supabase: define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel." : estado.error}
        </p>
      )}

      <form onSubmit={publicar} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <label className="text-sm font-semibold" htmlFor="oficial">Publicar como María Fernanda Cabal</label>
        <textarea id="oficial" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} rows={5} placeholder="Escribe el mensaje para toda la comunidad…" className="mt-2 w-full resize-y rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-brand" />
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={enviando || !texto.trim()} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">{enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Publicar</button>
          <span className="text-xs text-muted-foreground">{texto.length}/2000</span>
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}>{msg.texto}</span>}
        </div>
      </form>
    </div>
  );
}
