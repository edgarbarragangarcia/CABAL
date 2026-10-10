"use client";

import * as React from "react";
import { Keyboard, ScanLine, X } from "lucide-react";

import { leerCedulaPdf417, type DatosCedula } from "@/lib/comunidad/cedula-pdf417";

/**
 * Lee el código de barras del reverso de la cédula con la cámara. Usa el lector nativo del navegador cuando lo hay
 * (Chrome en Android) y, si no, una librería. Si nada lee, siempre se puede escribir a mano.
 */
export function EscanerCedula({ onLeida, onCerrar }: { onLeida: (d: DatosCedula) => void; onCerrar: () => void }) {
  const video = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let activo = true;
    let parar: (() => void) | undefined;

    const alLeer = (texto: string) => {
      const d = leerCedulaPdf417(texto);
      if (d && activo) {
        activo = false;
        onLeida(d);
      }
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no permite usar la cámara.");
        const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
        const nativo = Detector && (await (Detector as unknown as { getSupportedFormats?: () => Promise<string[]> }).getSupportedFormats?.())?.includes("pdf417");

        if (nativo && Detector) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          if (!video.current) return;
          video.current.srcObject = stream;
          await video.current.play();
          const detector = new Detector({ formats: ["pdf417"] });
          const t = window.setInterval(async () => {
            if (!video.current || !activo) return;
            const r = await detector.detect(video.current).catch(() => []);
            if (r[0]) alLeer(r[0].rawValue);
          }, 350);
          parar = () => {
            window.clearInterval(t);
            stream.getTracks().forEach((x) => x.stop());
          };
        } else {
          const { BrowserPDF417Reader } = await import("@zxing/browser");
          const controles = await new BrowserPDF417Reader().decodeFromVideoDevice(undefined, video.current!, (res) => {
            if (res) alLeer(res.getText());
          });
          parar = () => controles.stop();
        }
      } catch (e) {
        if (activo) setError(e instanceof Error ? e.message : "No se pudo abrir la cámara.");
      }
    })();

    return () => {
      activo = false;
      parar?.();
    };
  }, [onLeida]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-label="Escanear cédula">
      <div className="flex items-center justify-between p-4">
        <p className="text-sm font-semibold">Escanea el reverso de tu cédula</p>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full bg-white/15">
          <X className="size-5" />
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="size-full object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-40 w-[85%] max-w-md rounded-2xl border-2 border-emerald-300/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
            <ScanLine className="absolute -top-3 left-1/2 size-6 -translate-x-1/2 text-emerald-300" />
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4 text-center">
        <p className="text-xs text-white/80">{error || "Pon el código de barras (el rectángulo negro de atrás) dentro del marco, con buena luz. Se rellenará solo."}</p>
        <button type="button" onClick={onCerrar} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold">
          <Keyboard className="size-4" /> Prefiero escribir mis datos
        </button>
      </div>
    </div>
  );
}
