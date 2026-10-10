"use client";

import * as React from "react";
import { Camera, ImageIcon, Keyboard, Loader2, ShieldCheck, X } from "lucide-react";

import type { DatosCedula } from "@/lib/comunidad/cedula-ocr";

export type { DatosCedula };
/** Cómo se leyó: del código de barras (exacto), con IA, o con el OCR del teléfono (el menos fiable). */
export type Via = "barras" | "ia" | "telefono";

/** Reduce la foto (la cámara entrega 12 MP) a un JPEG ligero para el lector de IA: se lee igual y viaja rápido. */
function reducir(foto: ImageBitmap): string {
  const k = Math.min(1, 1600 / Math.max(foto.width, foto.height));
  const c = document.createElement("canvas");
  c.width = Math.round(foto.width * k);
  c.height = Math.round(foto.height * k);
  c.getContext("2d")!.drawImage(foto, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

/** Foto de la cédula (frente o reverso) leída por IA con visión; no se guarda. Se puede escribir a mano en cualquier momento. */
export function CapturaCedula({ onLeida, onCerrar }: { onLeida: (d: DatosCedula, via: Via) => void; onCerrar: () => void }) {
  const camara = React.useRef<HTMLInputElement>(null);
  const galeria = React.useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = React.useState(false);
  const [avance, setAvance] = React.useState("Leyendo tu cédula…");
  const [vista, setVista] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

  async function procesar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError("");
    setLeyendo(true);
    try {
      const foto = await createImageBitmap(f); // a resolución completa: el código de barras es muy fino

      // 1) El código de barras del reverso: datos exactos, sin errores de lectura.
      setAvance("Buscando el código de barras…");
      const barras = await (await import("./barras")).leerBarras(foto).catch(() => null);
      if (barras) return void onLeida(barras, "barras");

      // 2) Lector de IA del servidor (el más preciso con el frente). 3) Si no está disponible, el OCR del teléfono.
      setAvance("Leyendo tu cédula…");
      const imagen = reducir(foto);
      setVista(imagen);
      try {
        const res = await fetch("/api/comunidad/leer-cedula", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imagen }) });
        const b = await res.json().catch(() => ({}));
        if (res.ok) return void onLeida(b as DatosCedula, "ia");
        if (b.codigo === "ilegible") throw new Error(b.error);
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("No pude leer la cédula en esa foto")) throw err;
      }
      setAvance("Preparando el lector (solo la primera vez)…");
      const local = await (await import("./ocr-local")).leerCedulaLocal(foto, setAvance);
      if (!local) throw new Error("No pude leer tu cédula con seguridad. Prueba con la foto del REVERSO (código de barras), de cerca y con buena luz, o escribe tus datos.");
      onLeida(local, "telefono");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude leer la foto.");
      setLeyendo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-surface" role="dialog" aria-label="Foto de la cédula">
      <div className="flex items-center justify-between border-b border-border p-4">
        <p className="font-semibold">Foto de tu cédula</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full bg-surface-muted"><X className="size-5" /></button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
        {vista ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vista} alt="Foto de tu cédula" className="max-h-56 rounded-2xl border border-border object-contain shadow" />
        ) : (
          <span className="grid size-24 place-items-center rounded-3xl bg-brand-soft text-brand"><Camera className="size-12" /></span>
        )}
        {leyendo ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" /> {avance}</p>
        ) : (
          <>
            <div>
              <p className="text-lg font-semibold">Toma una foto de tu cédula</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">Lo mejor es el <b>reverso</b>: si el código de barras sale nítido, leemos tus datos exactos. También sirve el frente. Con buena luz, sin reflejos y de cerca.</p>
            </div>
            {error && <p role="alert" className="max-w-xs rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
            <input ref={camara} type="file" accept="image/*" capture="environment" onChange={procesar} className="hidden" />
            <input ref={galeria} type="file" accept="image/*" onChange={procesar} className="hidden" />
            <button type="button" onClick={() => camara.current?.click()} className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0a4f37] to-[#14825c] px-5 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/25"><Camera className="size-5" /> {error ? "Tomar otra foto" : "Tomar foto"}</button>
            <button type="button" onClick={() => galeria.current?.click()} className="flex items-center gap-2 text-sm font-semibold text-brand"><ImageIcon className="size-4" /> Elegir una foto de mi galería</button>
            <button type="button" onClick={onCerrar} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Keyboard className="size-4" /> Prefiero escribir mis datos</button>
          </>
        )}
      </div>
      <p className="flex items-start gap-2 border-t border-border p-4 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" /> La foto solo se usa para leer tus datos y no se guarda. El código de barras se lee dentro de tu teléfono; el frente, con inteligencia artificial o, si no está disponible, también en tu teléfono.</p>
    </div>
  );
}
