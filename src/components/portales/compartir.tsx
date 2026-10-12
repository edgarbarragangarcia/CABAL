"use client";

import * as React from "react";
import { Check, Link as LinkIcon, ShareNetwork, WhatsappLogo } from "@phosphor-icons/react";

/** Botones para compartir una página del portal: WhatsApp, el menú del teléfono (si lo hay) y copiar el enlace. */
export function Compartir({ titulo, oscuro = false, className = "" }: { titulo: string; oscuro?: boolean; className?: string }) {
  const [copiado, setCopiado] = React.useState(false);
  const [nativo, setNativo] = React.useState(false);
  React.useEffect(() => {
    // `navigator.share` solo existe en el navegador: se decide tras montar para no romper la hidratación.
    const t = setTimeout(() => setNativo(typeof navigator !== "undefined" && typeof navigator.share === "function"), 0);
    return () => clearTimeout(t);
  }, []);
  const boton = `inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${oscuro ? "border-white/15 bg-white/[0.06] text-white hover:bg-white/10" : "border-black/10 bg-white text-[#0f172a] hover:bg-black/[0.03]"}`;
  const url = () => (typeof window === "undefined" ? "" : window.location.href.split("#")[0]);
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className={`text-xs font-bold tracking-[0.16em] uppercase ${oscuro ? "text-white/50" : "text-black/45"}`}>Compartir</span>
      <button type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${titulo} ${url()}`)}`, "_blank", "noopener,noreferrer")} className={boton}><WhatsappLogo weight="fill" className="size-4 text-[#25a244]" /> WhatsApp</button>
      {nativo && <button type="button" onClick={() => void navigator.share({ title: titulo, url: url() }).catch(() => undefined)} className={boton}><ShareNetwork weight="bold" className="size-4" /> Más opciones</button>}
      <button type="button" onClick={() => { void navigator.clipboard.writeText(url()); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} className={boton}>{copiado ? <Check weight="bold" className="size-4" /> : <LinkIcon weight="bold" className="size-4" />} {copiado ? "Enlace copiado" : "Copiar enlace"}</button>
    </div>
  );
}
