"use client";

import * as React from "react";
import { Camera, Check, Flashlight, Keyboard, Minus, Plus, X } from "lucide-react";

import type { DatosCedula } from "@/lib/comunidad/cedula-ocr";
import { decodificar } from "./barras";

/**
 * Escáner en vivo del código de barras del reverso de la cédula. La persona encuadra el código en el recuadro; en
 * cuanto se lee y es el de una cédula, el recuadro se pone VERDE, la imagen se congela y se procesa sola. Solo se
 * analiza lo que está dentro del recuadro (a la máxima resolución de la cámara) y, si el teléfono lo permite, se
 * usa zoom: así no hace falta acercar tanto la cédula como para que la cámara pierda el enfoque.
 */
type Fase = "abriendo" | "buscando" | "leido" | "error";
type Capacidades = { zoom?: { min: number; max: number; step?: number }; torch?: boolean };

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function EscanerBarras({ onLeida, onFoto, onManual }: { onLeida: (d: DatosCedula) => void; onFoto: () => void; onManual: () => void }) {
  const contenedor = React.useRef<HTMLDivElement>(null);
  const video = React.useRef<HTMLVideoElement>(null);
  const caja = React.useRef<HTMLDivElement>(null);
  const pista = React.useRef<MediaStreamTrack | null>(null);
  const [fase, setFase] = React.useState<Fase>("abriendo");
  const [mensaje, setMensaje] = React.useState("");
  const [caps, setCaps] = React.useState<Capacidades>({});
  const [zoom, setZoom] = React.useState(1);
  const [linterna, setLinterna] = React.useState(false);
  const [congelado, setCongelado] = React.useState<string | null>(null);

  React.useEffect(() => {
    let activo = true;
    let stream: MediaStream | undefined;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no permite usar la cámara.");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false });
        if (!activo || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();

        const t = stream.getVideoTracks()[0];
        pista.current = t;
        const c = (t.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number; step?: number }; torch?: boolean };
        setCaps({ zoom: c.zoom, torch: c.torch });
        // Enfoque continuo y, si hay zoom, 2×: el código se ve del tamaño del recuadro sin pegar la cédula a la lente.
        await t.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
        if (c.zoom) {
          const z = Math.min(c.zoom.max, Math.max(c.zoom.min, 2));
          await t.applyConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] }).then(() => setZoom(z)).catch(() => {});
        }
        setFase("buscando");
        setMensaje("Encuadra el código de barras dentro del recuadro");

        const lienzo = document.createElement("canvas");
        const ctx = lienzo.getContext("2d", { willReadFrequently: true })!;
        let intento = 0;
        while (activo) {
          const v = video.current;
          const area = contenedor.current?.getBoundingClientRect();
          const cuadro = caja.current?.getBoundingClientRect();
          if (!v || !v.videoWidth || !area || !cuadro) {
            await dormir(120);
            continue;
          }
          // El recuadro (en pantalla) → su región dentro del fotograma real del video (que se muestra con `object-cover`).
          const escala = Math.max(area.width / v.videoWidth, area.height / v.videoHeight);
          const ox = (area.width - v.videoWidth * escala) / 2;
          const oy = (area.height - v.videoHeight * escala) / 2;
          const margen = 0.06; // un poco más que el recuadro, por si la persona se desvía
          const sw = (cuadro.width / escala) * (1 + 2 * margen);
          const sh = (cuadro.height / escala) * (1 + 2 * margen);
          const sx = (cuadro.left - area.left - ox) / escala - (cuadro.width / escala) * margen;
          const sy = (cuadro.top - area.top - oy) / escala - (cuadro.height / escala) * margen;

          intento++;
          const completo = intento % 4 === 0; // de vez en cuando, el cuadro entero (por si el código quedó fuera del recuadro)
          const k = completo ? Math.min(1, 1400 / v.videoWidth) : Math.min(1, 1400 / sw);
          lienzo.width = Math.round((completo ? v.videoWidth : sw) * k);
          lienzo.height = Math.round((completo ? v.videoHeight : sh) * k);
          if (completo) ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
          else ctx.drawImage(v, Math.max(0, sx), Math.max(0, sy), Math.min(sw, v.videoWidth - Math.max(0, sx)), Math.min(sh, v.videoHeight - Math.max(0, sy)), 0, 0, lienzo.width, lienzo.height);

          const { datos, hayCodigo } = await decodificar(ctx.getImageData(0, 0, lienzo.width, lienzo.height), { rotar: false, invertir: false });
          if (!activo) return;
          if (datos) {
            // Verde: congela el fotograma, vibra y procesa.
            const foto = document.createElement("canvas");
            foto.width = v.videoWidth;
            foto.height = v.videoHeight;
            foto.getContext("2d")!.drawImage(v, 0, 0);
            setCongelado(foto.toDataURL("image/jpeg", 0.7));
            setFase("leido");
            setMensaje("¡Código leído!");
            navigator.vibrate?.(70);
            activo = false;
            await dormir(850);
            onLeida(datos);
            return;
          }
          setMensaje(hayCodigo ? "Ese código no es el de una cédula: busca el del reverso" : intento > 14 ? "Acércate un poco, con buena luz y sin reflejos" : "Encuadra el código de barras dentro del recuadro");
          await dormir(90);
        }
      } catch (e) {
        if (!activo) return;
        setFase("error");
        setMensaje(e instanceof DOMException && e.name === "NotAllowedError" ? "No diste permiso a la cámara. Actívalo en los ajustes del navegador para este sitio, o usa una foto." : e instanceof Error ? e.message : "No se pudo abrir la cámara.");
      }
    })();

    return () => {
      activo = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onLeida]);

  async function cambiarZoom(delta: number) {
    const z = caps.zoom;
    if (!z || !pista.current) return;
    const nuevo = Math.min(z.max, Math.max(z.min, zoom + delta));
    await pista.current.applyConstraints({ advanced: [{ zoom: nuevo } as MediaTrackConstraintSet] }).then(() => setZoom(nuevo)).catch(() => {});
  }
  async function alternarLinterna() {
    if (!pista.current) return;
    await pista.current.applyConstraints({ advanced: [{ torch: !linterna } as MediaTrackConstraintSet] }).then(() => setLinterna(!linterna)).catch(() => {});
  }

  const verde = fase === "leido";
  const esquina = `absolute size-8 border-[3px] transition-colors duration-300 ${verde ? "border-emerald-400" : "border-white"}`;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-label="Escanear el código de barras de la cédula">
      <style>{`@keyframes escaner-barrido{0%{top:6%}50%{top:90%}100%{top:6%}}`}</style>
      <div className="relative z-10 flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium tracking-wide">Escanea el reverso de tu cédula</p>
        <button type="button" onClick={onManual} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full bg-white/12 backdrop-blur"><X className="size-5" /></button>
      </div>

      <div ref={contenedor} className="relative flex-1 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {congelado ? <img src={congelado} alt="" className="absolute inset-0 size-full object-cover" /> : <video ref={video} playsInline muted className="absolute inset-0 size-full object-cover" />}

        {/* Recuadro: el resto de la imagen se oscurece para que la vista se centre en el código */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div
            ref={caja}
            className={`relative aspect-[3.1/1] w-[min(92%,40rem)] rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.62)] transition-shadow duration-300 ${verde ? "ring-2 ring-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.62),0_0_44px_rgba(52,211,153,0.65)]" : "ring-1 ring-white/35"}`}
          >
            <span className={`${esquina} -left-1 -top-1 rounded-tl-xl border-b-0 border-r-0`} />
            <span className={`${esquina} -right-1 -top-1 rounded-tr-xl border-b-0 border-l-0`} />
            <span className={`${esquina} -bottom-1 -left-1 rounded-bl-xl border-r-0 border-t-0`} />
            <span className={`${esquina} -bottom-1 -right-1 rounded-br-xl border-l-0 border-t-0`} />
            {fase === "buscando" && <span className="absolute inset-x-3 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent [animation:escaner-barrido_2.4s_ease-in-out_infinite]" />}
            {verde && (
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-14 place-items-center rounded-full bg-emerald-500 shadow-[0_0_30px_rgba(52,211,153,0.9)]"><Check className="size-8" strokeWidth={3} /></span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center">
        <p role="status" aria-live="polite" className={`min-h-5 text-sm ${verde ? "font-semibold text-emerald-300" : fase === "error" ? "text-amber-300" : "text-white/85"}`}>{fase === "abriendo" ? "Abriendo la cámara…" : mensaje}</p>
        <div className="flex items-center justify-center gap-2">
          {caps.zoom && fase !== "leido" && (
            <div className="flex items-center gap-1 rounded-full bg-white/12 px-1 py-1 backdrop-blur">
              <button type="button" onClick={() => cambiarZoom(-0.5)} aria-label="Alejar" className="grid size-8 place-items-center rounded-full hover:bg-white/15"><Minus className="size-4" /></button>
              <span className="w-10 text-center text-xs tabular-nums">{zoom.toFixed(1)}×</span>
              <button type="button" onClick={() => cambiarZoom(0.5)} aria-label="Acercar" className="grid size-8 place-items-center rounded-full hover:bg-white/15"><Plus className="size-4" /></button>
            </div>
          )}
          {caps.torch && fase !== "leido" && (
            <button type="button" onClick={alternarLinterna} aria-pressed={linterna} aria-label="Linterna" className={`grid size-10 place-items-center rounded-full backdrop-blur ${linterna ? "bg-amber-300 text-black" : "bg-white/12"}`}><Flashlight className="size-5" /></button>
          )}
        </div>
        {fase !== "leido" && (
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <button type="button" onClick={onFoto} className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs font-semibold backdrop-blur"><Camera className="size-4" /> Mejor una foto (frente o reverso)</button>
            <button type="button" onClick={onManual} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white/75"><Keyboard className="size-4" /> Escribir mis datos</button>
          </div>
        )}
      </div>
    </div>
  );
}
