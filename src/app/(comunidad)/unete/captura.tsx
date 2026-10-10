"use client";

import * as React from "react";
import { Camera, ImageIcon, Keyboard, Loader2, ShieldCheck, X } from "lucide-react";

import type { DatosCedula } from "@/lib/comunidad/cedula-ocr";

export type { DatosCedula };

/** Reduce la foto (la cámara entrega 12 MP) a un JPEG ligero: se lee igual y viaja rápido. */
async function reducir(archivo: File): Promise<string> {
  const bmp = await createImageBitmap(archivo);
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

/** Foto de la cédula (frente o reverso) leída por IA con visión; no se guarda. Se puede escribir a mano en cualquier momento. */
export function CapturaCedula({ onLeida, onCerrar }: { onLeida: (d: DatosCedula) => void; onCerrar: () => void }) {
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
      setAvance("Leyendo tu cédula…");
      const imagen = await reducir(f);
      setVista(imagen);

      // 1) El lector inteligente del servidor (el más preciso). 2) Si no está disponible o falla, se lee en el propio teléfono.
      let datos: DatosCedula | null = null;
      try {
        const res = await fetch("/api/comunidad/leer-cedula", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imagen }) });
        const b = await res.json().catch(() => ({}));
        if (res.ok) datos = b as DatosCedula;
        else if (b.codigo === "ilegible") throw new Error(b.error);
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("No pude leer la cédula en esa foto")) throw err;
      }
      if (!datos) {
        setAvance("Preparando el lector (solo la primera vez)…");
        datos = await (await import("./ocr-local")).leerCedulaLocal(imagen, setAvance);
      }
      if (!datos) throw new Error("No pude leer la cédula en esa foto. Acércate, con buena luz y sin reflejos, o escribe tus datos.");
      onLeida(datos);
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
              <p className="text-lg font-semibold">Toma una foto del frente</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">Con buena luz, sin reflejos y con toda la cédula dentro de la foto. Rellenamos tus datos solos y tú los confirmas.</p>
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
      <p className="flex items-start gap-2 border-t border-border p-4 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" /> La foto solo se usa para leer tus datos y no se guarda. Se lee con un servicio de inteligencia artificial o, si no está disponible, dentro de tu propio teléfono.</p>
    </div>
  );
}
