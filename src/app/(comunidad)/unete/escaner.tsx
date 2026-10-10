"use client";

import * as React from "react";
import { Camera, Keyboard, ScanLine, X } from "lucide-react";

import { leerCedulaPdf417, type DatosCedula } from "@/lib/comunidad/cedula-pdf417";

/**
 * Lee el código de barras (PDF417) del reverso de la cédula. Usa ZXing compilado a WebAssembly (el mismo motor de las apps
 * lectoras profesionales), que lee este código denso mucho mejor que las librerías de JavaScript. El .wasm se sirve desde
 * este mismo sitio (/zxing) para cumplir la política de seguridad. Si el video no lo capta, se puede tomar una foto.
 */

let preparado: Promise<typeof import("zxing-wasm/reader")> | null = null;
function lector() {
  preparado ??= import("zxing-wasm/reader").then((m) => {
    m.prepareZXingModule({ overrides: { locateFile: (ruta: string, prefijo: string) => (ruta.endsWith(".wasm") ? "/zxing/zxing_reader.wasm" : prefijo + ruta) } });
    return m;
  });
  return preparado;
}

/** Los bytes tal cual (Latin‑1): el texto del código es de ancho fijo y cualquier recodificación movería las posiciones. */
const comoTexto = (b: Uint8Array) => Array.from(b, (x) => String.fromCharCode(x)).join("");

async function leerImagen(img: ImageData) {
  const { readBarcodes } = await lector();
  const r = await readBarcodes(img, { formats: ["PDF417"], tryHarder: true, tryRotate: true, tryInvert: true, maxNumberOfSymbols: 1 });
  return r[0] ? comoTexto(r[0].bytes) : null;
}

export function EscanerCedula({ onLeida, onCerrar }: { onLeida: (d: DatosCedula) => void; onCerrar: () => void }) {
  const video = React.useRef<HTMLVideoElement>(null);
  const foto = React.useRef<HTMLInputElement>(null);
  const [estado, setEstado] = React.useState("Abriendo la cámara…");
  const [error, setError] = React.useState("");

  const procesar = React.useCallback(
    (texto: string | null) => {
      if (!texto) return false;
      const d = leerCedulaPdf417(texto);
      if (!d) {
        setEstado("Leí un código, pero no parece el de una cédula. Prueba con el reverso.");
        return false;
      }
      onLeida(d);
      return true;
    },
    [onLeida],
  );

  React.useEffect(() => {
    let activo = true;
    let stream: MediaStream | undefined;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no permite usar la cámara.");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (!activo || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        // Enfoque continuo si el teléfono lo permite: sin esto el código sale borroso.
        await stream.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
        setEstado("Buscando el código de barras…");
        await lector();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        let intentos = 0;
        while (activo) {
          const v = video.current;
          if (v && v.videoWidth) {
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0);
            const texto = await leerImagen(ctx.getImageData(0, 0, canvas.width, canvas.height)).catch(() => null);
            intentos++;
            if (procesar(texto)) {
              activo = false;
              break;
            }
            if (activo && intentos % 5 === 0) setEstado(`Buscando el código… (${intentos} intentos). Acércalo, enfoca y evita reflejos.`);
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch (e) {
        if (activo) setError(e instanceof DOMException && e.name === "NotAllowedError" ? "No diste permiso a la cámara. Actívalo en los ajustes del navegador para este sitio, o escribe tus datos a mano." : e instanceof Error ? e.message : "No se pudo abrir la cámara.");
      }
    })();
    return () => {
      activo = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [procesar]);

  async function deFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setEstado("Leyendo la foto…");
    try {
      const bmp = await createImageBitmap(f);
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0);
      if (!procesar(await leerImagen(ctx.getImageData(0, 0, c.width, c.height)))) setEstado("No encontré el código en esa foto. Acércate al rectángulo negro de atrás y prueba de nuevo.");
    } catch {
      setEstado("No pude leer esa foto.");
    }
    e.target.value = "";
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-label="Escanear cédula">
      <div className="flex items-center justify-between p-4">
        <p className="text-sm font-semibold">Escanea el reverso de tu cédula</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full bg-white/15">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="size-full object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-40 w-[88%] max-w-md rounded-2xl border-2 border-emerald-300/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
            <ScanLine className="absolute -top-3 left-1/2 size-6 -translate-x-1/2 text-emerald-300" />
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4 text-center">
        <p className="min-h-10 text-xs text-white/85" role="status">{error || estado}</p>
        <input ref={foto} type="file" accept="image/*" capture="environment" onChange={deFoto} className="hidden" />
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => foto.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black">
            <Camera className="size-4" /> Tomar una foto
          </button>
          <button type="button" onClick={onCerrar} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold">
            <Keyboard className="size-4" /> Escribir mis datos
          </button>
        </div>
      </div>
    </div>
  );
}
