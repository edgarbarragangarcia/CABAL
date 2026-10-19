"use client";

import * as React from "react";
import { Copy, Download, FileText, Link2, Loader2, Mic, Paperclip, Square, Volume2, VolumeX, X } from "lucide-react";

import { MafeAvatar } from "@/components/mafe/mafe-avatar";

/**
 * Asistente de voz del panel: le hablas, te transcribe (reconocimiento de voz del navegador), consulta lo que el panel guarda y te
 * responde hablando (voz natural con la clave de Gemini u OpenAI de Configuración; si falla, la voz del sistema). Se puede interrumpir
 * tocando el micrófono, y en «conversación continua» vuelve a escuchar solo al terminar de hablar.
 */

type Turno = { rol: "usuario" | "asistente"; texto: string; fuente?: string };
type Fase = "reposo" | "escuchando" | "pensando" | "hablando";

type Reconocimiento = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type ConstructorReconocimiento = new () => Reconocimiento;

const BARRAS = 11;
const SALUDO = "Hola. Pregúntame por los documentos, los resultados electorales, lo que se dice en prensa y redes, o cuántos datos hay guardados.";

function partirEnFrases(texto: string): string[] {
  const frases = texto.match(/[^.!?…]+[.!?…]*\s*/g)?.map((f) => f.trim()).filter(Boolean) ?? [texto];
  const trozos: string[] = [];
  for (const f of frases) {
    const ult = trozos[trozos.length - 1];
    if (trozos.length > 1 && ult && ult.length + f.length < 220) trozos[trozos.length - 1] = `${ult} ${f}`;
    else trozos.push(f);
  }
  return trozos.slice(0, 8);
}

type Entrega = { tipo: "gestor"; id: string; nombre: string } | { tipo: "texto"; nombre: string; contenido: string; detalle?: string };
type Adjunto = { nombre: string; texto: string };

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** El texto con «## » y «- » pasa a HTML sencillo: Word abre ese archivo como un documento con títulos y viñetas. */
function aHtml(titulo: string, contenido: string): string {
  const cuerpo = contenido.split("\n").map((l) => {
    const t = l.trim();
    if (!t) return "";
    if (t.startsWith("### ")) return `<h3>${escapar(t.slice(4))}</h3>`;
    if (t.startsWith("## ")) return `<h2>${escapar(t.slice(3))}</h2>`;
    if (t.startsWith("# ")) return `<h1>${escapar(t.slice(2))}</h1>`;
    if (/^[-•]\s/.test(t)) return `<p style="margin-left:18pt">• ${escapar(t.slice(2).replace(/\*\*/g, ""))}</p>`;
    return `<p>${escapar(t.replace(/\*\*/g, ""))}</p>`;
  }).join("\n");
  return `<html><head><meta charset="utf-8"><title>${escapar(titulo)}</title></head><body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.4">${cuerpo}</body></html>`;
}

type Pos = { x: number; y: number };
const CLAVE_POS = "cabal-asistente-pos";

/** Arrastra un elemento fijo con el puntero; avisa la posición (esquina superior izquierda) y, al soltar, si se movió. */
function arrastrar(e: React.PointerEvent<HTMLElement>, el: HTMLElement, alMover: (p: Pos) => void, alSoltar: (movido: boolean) => void) {
  if (e.button !== 0) return;
  const r = el.getBoundingClientRect();
  const dx = e.clientX - r.left;
  const dy = e.clientY - r.top;
  const x0 = e.clientX;
  const y0 = e.clientY;
  let movido = false;
  const mover = (m: PointerEvent) => {
    if (!movido && Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return;
    movido = true;
    alMover({ x: Math.min(Math.max(0, m.clientX - dx), window.innerWidth - 60), y: Math.min(Math.max(0, m.clientY - dy), window.innerHeight - 60) });
  };
  const soltar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", soltar); alSoltar(movido); };
  window.addEventListener("pointermove", mover);
  window.addEventListener("pointerup", soltar);
}

export function AsistenteVoz({ alCerrar, pos, alMover }: { alCerrar: () => void; pos?: Pos | null; alMover?: (p: Pos, fin: boolean) => void }) {
  const [turnos, setTurnos] = React.useState<Turno[]>([{ rol: "asistente", texto: SALUDO }]);
  const [fase, setFase] = React.useState<Fase>("reposo");
  const [, setParcial] = React.useState("");
  const [continuo, setContinuo] = React.useState(true);
  const [silencio, setSilencio] = React.useState(false);
  const [error, setError] = React.useState("");
  const [aviso, setAviso] = React.useState("");
  const [soporte] = React.useState(() => typeof window !== "undefined" && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition));

  const rec = React.useRef<Reconocimiento | null>(null);
  const audio = React.useRef<HTMLAudioElement | null>(null);
  const ctxVoz = React.useRef<AudioContext | null>(null);
  const detener = React.useRef<(() => void) | null>(null);
  const gen = React.useRef(0);
  const turnosRef = React.useRef<Turno[]>(turnos);
  const barras = React.useRef<(HTMLSpanElement | null)[]>([]);
  const medidor = React.useRef<{ ctx: AudioContext; flujo: MediaStream; raf: number } | null>(null);
  const lista = React.useRef<HTMLDivElement>(null);
  const escenario = React.useRef<HTMLDivElement>(null);
  const [sincro, setSincro] = React.useState(false);
  const [entregas, setEntregas] = React.useState<Entrega[]>([]);
  const [clonada, setClonada] = React.useState(false);
  const [adjunto, setAdjunto] = React.useState<Adjunto | null>(null);
  const adjuntoRef = React.useRef<Adjunto | null>(null);
  const [subiendo, setSubiendo] = React.useState(false);
  const [verEnlace, setVerEnlace] = React.useState(false);
  const [enlace, setEnlace] = React.useState("");
  const entradaArchivo = React.useRef<HTMLInputElement>(null);
  const [bajando, setBajando] = React.useState<string | null>(null);
  const continuoRef = React.useRef(continuo);
  const silencioRef = React.useRef(silencio);
  const vaciosRef = React.useRef(0);

  React.useEffect(() => { turnosRef.current = turnos; lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: "smooth" }); }, [turnos]);
  React.useEffect(() => { continuoRef.current = continuo; }, [continuo]);
  React.useEffect(() => { silencioRef.current = silencio; }, [silencio]);

  const pararMedidor = React.useCallback(() => {
    const m = medidor.current;
    if (!m) return;
    cancelAnimationFrame(m.raf);
    m.flujo.getTracks().forEach((t) => t.stop());
    void m.ctx.close().catch(() => {});
    medidor.current = null;
    barras.current.forEach((b) => b && (b.style.transform = "scaleY(0.15)"));
  }, []);

  const pararTodo = React.useCallback(() => {
    gen.current++;
    rec.current?.abort();
    rec.current = null;
    audio.current?.pause();
    audio.current = null;
    detener.current?.();
    detener.current = null;
    window.speechSynthesis?.cancel();
    pararMedidor();
  }, [pararMedidor]);

  React.useEffect(() => () => pararTodo(), [pararTodo]);

  async function iniciarMedidor() {
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 64;
      ctx.createMediaStreamSource(flujo).connect(an);
      const datos = new Uint8Array(an.frequencyBinCount);
      const m = { ctx, flujo, raf: 0 };
      const paso = () => {
        an.getByteFrequencyData(datos);
        barras.current.forEach((b, i) => { if (b) b.style.transform = `scaleY(${Math.max(0.15, Math.min(1, (datos[2 + i * 2] ?? 0) / 180))})`; });
        m.raf = requestAnimationFrame(paso);
      };
      m.raf = requestAnimationFrame(paso);
      medidor.current = m;
    } catch {
      /* sin medidor: las barras quedan quietas, el reconocimiento sigue */
    }
  }

  /** El contexto de audio se abre (y se «despierta») con un toque de la persona: así el navegador deja sonar lo que llegue después. */
  function desbloquearAudio() {
    try {
      if (!ctxVoz.current) ctxVoz.current = new AudioContext();
      if (ctxVoz.current.state === "suspended") void ctxVoz.current.resume();
    } catch {
      /* sin Web Audio: se usa el reproductor normal */
    }
  }

  /** Reproduce el audio con Web Audio (no depende de la política de medios ni de URL temporales). Devuelve el motivo si falla. */
  async function sonarConWebAudio(blob: Blob): Promise<string | null> {
    try {
      desbloquearAudio();
      const ctx = ctxVoz.current;
      if (!ctx) return "sin Web Audio";
      if (ctx.state === "suspended") await ctx.resume();
      const datos = await ctx.decodeAudioData(await blob.arrayBuffer());
      await new Promise<void>((fin) => {
        const fuente = ctx.createBufferSource();
        fuente.buffer = datos;
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        fuente.connect(an);
        an.connect(ctx.destination);
        const onda = new Uint8Array(an.fftSize);
        let raf = 0;
        let suave = 0;
        const t0 = performance.now();
        // La boca y los gestos siguen la energía real de la voz que está sonando.
        const paso = () => {
          an.getByteTimeDomainData(onda);
          let suma = 0;
          for (const v of onda) { const d = (v - 128) / 128; suma += d * d; }
          const nivel = Math.min(1, Math.sqrt(suma / onda.length) * 5);
          suave = suave * 0.55 + nivel * 0.45;
          const el = escenario.current;
          if (el) {
            const t = (performance.now() - t0) / 1000;
            el.style.setProperty("--boca", suave.toFixed(3));
            el.style.setProperty("--gesto", (Math.sin(t * 2.1) * suave * 3.2).toFixed(3));
            el.style.setProperty("--bote", (-suave * 2.2).toFixed(3));
          }
          raf = requestAnimationFrame(paso);
        };
        const cerrar = () => { cancelAnimationFrame(raf); setSincro(false); const el = escenario.current; if (el) { el.style.setProperty("--boca", "0"); el.style.setProperty("--gesto", "0"); el.style.setProperty("--bote", "0"); } };
        fuente.onended = () => { detener.current = null; cerrar(); fin(); };
        detener.current = () => { fuente.onended = null; try { fuente.stop(); } catch { /* ya terminó */ } cerrar(); fin(); };
        setFase("hablando");
        setSincro(true);
        fuente.start();
        raf = requestAnimationFrame(paso);
      });
      return null;
    } catch (e) {
      return e instanceof Error ? `${e.name}: ${e.message}` : "falló Web Audio";
    }
  }

  async function sonarConReproductor(blob: Blob): Promise<string | null> {
    return new Promise<string | null>((fin) => {
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      audio.current = a;
      const cerrar = (motivo: string | null) => { URL.revokeObjectURL(url); fin(motivo); };
      a.onended = () => cerrar(null);
      a.onerror = () => cerrar(`reproductor: ${a.error?.message || `error ${a.error?.code ?? "?"}`}`);
      a.onplaying = () => setFase("hablando");
      a.play().catch((e: unknown) => cerrar(`reproductor: ${e instanceof Error ? e.name : "bloqueado"}`));
    });
  }

  /** La voz del sistema en español (es-CO, es-MX…), esperando a que el navegador cargue la lista. */
  async function vozDelSistema(): Promise<SpeechSynthesisVoice | undefined> {
    const sintesis = window.speechSynthesis;
    if (!sintesis) return undefined;
    let voces = sintesis.getVoices();
    if (!voces.length) await new Promise<void>((ok) => { const t = window.setTimeout(ok, 600); sintesis.addEventListener("voiceschanged", () => { window.clearTimeout(t); ok(); }, { once: true }); });
    voces = sintesis.getVoices();
    for (const pref of ["es-CO", "es-MX", "es-US", "es-419", "es-ES", "es"]) {
      const v = voces.find((x) => x.lang.replace("_", "-").toLowerCase().startsWith(pref.toLowerCase()));
      if (v) return v;
    }
    return undefined;
  }

  async function hablar(texto: string, miGen: number): Promise<void> {
    if (silencioRef.current) return;
    const frases = partirEnFrases(texto);
    const pedir = (f: string) =>
      fetch("/api/admin/asistente-voz/hablar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: f }) })
        .then(async (r) => (r.status === 200 ? (r.headers.get("x-voz") === "clonada" && setClonada(true), { blob: await r.blob(), motivo: "" }) : { blob: null, motivo: decodeURIComponent(r.headers.get("x-voz-motivo") ?? "") || `respuesta ${r.status}` }))
        .catch(() => ({ blob: null as Blob | null, motivo: "sin conexión con el servidor" }));
    // Todas las frases se piden a la vez: mientras suena una, las demás ya se están generando.
    const precargas = frases.map((f) => pedir(f));
    let vozNatural = true;
    for (let i = 0; i < frases.length; i++) {
      if (gen.current !== miGen) return;
      const r = vozNatural ? await precargas[i] : { blob: null as Blob | null, motivo: "" };
      if (gen.current !== miGen) return;
      let sono = false;
      if (r.blob) {
        setAviso("");
        // Primero Web Audio; si falla, el reproductor normal. Si ambos fallan se dice por qué y se habla con la voz del sistema.
        const f1 = await sonarConWebAudio(r.blob);
        if (f1 === null) sono = true;
        else {
          const f2 = await sonarConReproductor(r.blob);
          if (f2 === null) sono = true;
          else setAviso(`La voz natural llegó pero no se pudo reproducir (${f1}; ${f2}). Se usa la voz del sistema.`);
        }
        if (gen.current !== miGen) return;
      }
      if (!sono) {
        vozNatural = false;
        if (i === 0 && !r.blob) setAviso(`Hablando con la voz del sistema${r.motivo ? ` (la voz natural no está disponible: ${r.motivo})` : ""}.`);
        const sintesis = window.speechSynthesis;
        if (!sintesis) { setAviso("Este navegador no puede hablar."); return; }
        const voz = await vozDelSistema();
        if (gen.current !== miGen) return;
        setFase("hablando");
        const ok = await new Promise<boolean>((fin) => {
          sintesis.cancel();
          const u = new SpeechSynthesisUtterance(frases[i]);
          if (voz) { u.voice = voz; u.lang = voz.lang; } else u.lang = "es-CO";
          u.volume = 1;
          u.rate = 1.02;
          u.onend = () => fin(true);
          u.onerror = (e) => fin(e.error === "canceled" || e.error === "interrupted");
          sintesis.speak(u);
        });
        if (!ok) { setAviso("El navegador no pudo hablar. Revisa el volumen del computador y de la pestaña, o toca «Escuchar» en la respuesta."); return; }
      }
    }
  }

  /** Sube el archivo, lee su texto y le pide al asistente que lo analice; las preguntas siguientes (y «escríbeme un artículo») parten de él. */
  async function adjuntar(f: File) {
    setError("");
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("archivo", f);
      const r = await fetch("/api/admin/asistente-voz/archivo", { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as { nombre?: string; texto?: string; error?: string };
      if (!r.ok || !j.texto) throw new Error(j.error ?? "No fue posible leer el archivo.");
      const a = { nombre: j.nombre ?? f.name, texto: j.texto };
      adjuntoRef.current = a;
      setAdjunto(a);
      void enviar(`Analiza el archivo ${a.nombre}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible leer el archivo.");
    } finally {
      setSubiendo(false);
    }
  }

  /** Lee un enlace (noticia, PDF o video de YouTube) y le pide al asistente un análisis a fondo. */
  async function leerEnlace(url: string) {
    setError("");
    setSubiendo(true);
    try {
      const r = await fetch("/api/admin/asistente-voz/enlace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const j = (await r.json().catch(() => ({}))) as { nombre?: string; texto?: string; error?: string };
      if (!r.ok || !j.texto) throw new Error(j.error ?? "No fue posible leer el enlace.");
      const a = { nombre: j.nombre ?? url, texto: j.texto };
      adjuntoRef.current = a;
      setAdjunto(a);
      setVerEnlace(false);
      setEnlace("");
      void enviar(`Haz un análisis profundo de este enlace: ${a.nombre}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible leer el enlace.");
    } finally {
      setSubiendo(false);
    }
  }

  async function bajar(e: Entrega) {
    setBajando(e.nombre);
    try {
      if (e.tipo === "gestor") {
        const r = await fetch(`/api/admin/documentos?descargar=${e.id}`);
        const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!j.url) throw new Error(j.error ?? "No fue posible obtener el archivo.");
        // Se baja el archivo a la computadora; si el navegador no deja leerlo, se abre el enlace directo.
        try {
          const f = await fetch(j.url);
          if (!f.ok) throw new Error(String(f.status));
          const tipo = f.headers.get("content-type") ?? "";
          const ext = /pdf/i.test(tipo) ? ".pdf" : /wordprocessingml/i.test(tipo) ? ".docx" : /msword/i.test(tipo) ? ".doc" : "";
          const blob = await f.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = /\.\w{2,4}$/.test(e.nombre) ? e.nombre : `${e.nombre}${ext}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 4000);
        } catch {
          const a = document.createElement("a");
          a.href = j.url;
          a.target = "_blank";
          a.rel = "noopener";
          a.download = e.nombre;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      } else {
        const url = URL.createObjectURL(new Blob(["\ufeff", aHtml(e.nombre, e.contenido)], { type: "application/msword" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `${e.nombre || "Documento de MaFe"}.doc`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible descargar.");
    } finally {
      setBajando(null);
    }
  }

  async function enviar(pregunta: string) {
    const texto = pregunta.trim();
    if (!texto) return;
    desbloquearAudio();
    pararTodo();
    const miGen = ++gen.current;
    setParcial("");
    setError("");
    setEntregas([]);
    const previo = turnosRef.current.filter((t) => t.texto !== SALUDO);
    setTurnos((t) => [...t, { rol: "usuario", texto }]);
    setFase("pensando");
    try {
      const r = await fetch("/api/admin/asistente-voz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pregunta: texto, historial: previo.map(({ rol, texto: x }) => ({ rol, texto: x })), adjunto: adjuntoRef.current ?? undefined }) });
      const j = (await r.json().catch(() => ({}))) as { respuesta?: string; fuente?: string; error?: string; entregas?: Entrega[] };
      if (gen.current !== miGen) return;
      if (!r.ok || !j.respuesta) throw new Error(j.error ?? "No pude responder.");
      setTurnos((t) => [...t, { rol: "asistente", texto: j.respuesta!, fuente: j.fuente }]);
      if (j.entregas?.length) setEntregas(j.entregas);
      await hablar(j.respuesta, miGen);
      if (gen.current !== miGen) return;
      setFase("reposo");
      if (continuoRef.current) void escuchar();
    } catch (e) {
      if (gen.current !== miGen) return;
      setError(e instanceof Error ? e.message : "No pude responder.");
      setFase("reposo");
    }
  }

  /** Pide el micrófono con el cuadro de permiso del navegador (hace falta un toque de la persona). Dice con claridad por qué falla. */
  async function pedirMicrofono(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no deja usar el micrófono aquí (hace falta una conexión segura en Chrome o Edge).");
      return false;
    }
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      flujo.getTracks().forEach((t) => t.stop());
      setError("");
      return true;
    } catch (e) {
      const nombre = e instanceof DOMException ? e.name : "";
      const detalle = e instanceof Error ? e.message : "";
      if (/permissions policy|feature policy|disallowed/i.test(detalle)) setError("El sitio todavía tiene el micrófono bloqueado por su política de seguridad: se está actualizando. Espera unos minutos, recarga con Ctrl/Cmd + Shift + R y vuelve a intentarlo.");
      else if (nombre === "NotAllowedError" || nombre === "SecurityError") setError("Chrome bloqueó el micrófono para este sitio. Pulsa el ícono de ajustes a la izquierda de la dirección (las dos rayas), activa «Micrófono» y recarga la página.");
      else if (nombre === "NotFoundError") setError("No encuentro un micrófono conectado.");
      else setError(`No se pudo activar el micrófono${detalle ? `: ${detalle}` : "."}`);
      return false;
    }
  }

  async function escuchar() {
    const Ctor = ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as ConstructorReconocimiento | undefined;
    if (!Ctor) return setError("Tu navegador no reconoce voz. Usa Chrome o Edge, o escribe tu pregunta abajo.");
    pararTodo();
    // Primero el permiso: así el navegador muestra su cuadro «Permitir» y, si algo lo impide, se explica el motivo.
    if (!(await pedirMicrofono())) return setFase("reposo");
    const miGen = ++gen.current;
    setError("");
    setParcial("");
    const r = new Ctor();
    r.lang = "es-CO";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    let final = "";
    r.onresult = (e) => {
      let interino = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interino += res[0].transcript;
      }
      setParcial((final + interino).trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Falta el permiso del micrófono: actívalo en la barra de direcciones del navegador.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError(`El reconocimiento de voz falló (${e.error}).`);
    };
    r.onend = () => {
      pararMedidor();
      if (gen.current !== miGen) return;
      rec.current = null;
      if (final.trim()) {
        vaciosRef.current = 0;
        void enviar(final);
      } else if (continuoRef.current && vaciosRef.current < 2) {
        vaciosRef.current++;
        void escuchar();
      } else {
        vaciosRef.current = 0;
        setFase("reposo");
        setParcial("");
      }
    };
    rec.current = r;
    setFase("escuchando");
    void iniciarMedidor();
    try {
      r.start();
    } catch {
      setFase("reposo");
    }
  }

  const principal = () => {
    desbloquearAudio();
    if (fase === "reposo") { vaciosRef.current = 0; void escuchar(); }
    else { pararTodo(); setFase("reposo"); setParcial(""); }
  };

  const etiqueta = { reposo: "Toca el micrófono y habla", escuchando: "Te escucho…", pensando: "Pensando…", hablando: "Hablando… toca para interrumpir" }[fase];

  return (
    <div style={pos && typeof window !== "undefined" && window.innerWidth >= 640 ? { left: pos.x, top: pos.y, bottom: "auto" } : undefined} className="fixed inset-x-3 bottom-3 z-[70] flex max-h-[80dvh] flex-col overflow-hidden rounded-3xl bg-[#06281c] text-[#f4efe2] shadow-2xl ring-1 ring-white/10 sm:inset-x-auto sm:bottom-5 sm:left-[7rem] sm:w-[19rem]" role="dialog" aria-label="Asistente de voz">
      <div
        className="flex cursor-grab items-center justify-between px-5 pt-4 active:cursor-grabbing sm:touch-none"
        onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button") || !alMover || window.innerWidth < 640) return; const panel = e.currentTarget.parentElement as HTMLElement; arrastrar(e, panel, (p) => alMover(p, false), (m) => { if (m) alMover({ x: panel.getBoundingClientRect().left, y: panel.getBoundingClientRect().top }, true); }); }}
        title="Arrastra para mover"
      >
        <p className="text-xs font-semibold tracking-wide text-[#f4efe2]/60 uppercase">MaFe</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => { setSilencio((s) => !s); if (!silencio) { audio.current?.pause(); window.speechSynthesis?.cancel(); } }} aria-pressed={silencio} aria-label={silencio ? "Activar la voz" : "Silenciar la voz"} className="rounded-full p-2 hover:bg-white/10">{silencio ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}</button>
          <button type="button" onClick={() => { pararTodo(); alCerrar(); }} aria-label="Cerrar" className="rounded-full p-2 hover:bg-white/10"><X className="size-4" aria-hidden="true" /></button>
        </div>
      </div>

      <div ref={lista} className="flex flex-col items-center px-5 pt-1">
        <div ref={escenario}>
        <MafeAvatar
          talking={fase === "hablando" && !sincro}
          sync={sincro}
          title="MaFe"
          className={`size-44 rounded-full ring-4 transition duration-300 ${fase === "escuchando" ? "scale-[1.02] ring-red-400/80" : fase === "hablando" ? "ring-[#e0bd7c]" : fase === "pensando" ? "opacity-80 ring-white/20" : "ring-white/15"}`}
        />
        </div>
        {clonada && <p className="mt-2 text-center text-[11px] text-[#f4efe2]/60">Voz sintética de MaFe, clonada con autorización de la Dra.</p>}
        {entregas.length > 0 && (
          <ul className="mt-3 w-full space-y-2">
            {entregas.map((e) => (
              <li key={`${e.tipo}-${e.nombre}`} className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
                <FileText className="size-5 shrink-0 text-[#e0bd7c]" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[13px] leading-tight"><b className="line-clamp-2">{e.nombre}</b><span className="text-[11px] text-[#f4efe2]/60">{e.tipo === "gestor" ? "Del Gestor documental" : `${e.detalle ?? "Redactado por MaFe"} · Word`}</span></span>
                {e.tipo === "texto" && <button type="button" aria-label="Copiar el texto" onClick={() => void navigator.clipboard?.writeText(e.contenido)} className="rounded-full p-2 hover:bg-white/10"><Copy className="size-4" aria-hidden="true" /></button>}
                <button type="button" onClick={() => void bajar(e)} disabled={bajando === e.nombre} className="inline-flex items-center gap-1 rounded-full bg-[#e0bd7c] px-3 py-1.5 text-xs font-semibold text-[#2b1f06] hover:brightness-105 disabled:opacity-60">{bajando === e.nombre ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}Descargar</button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <div role="alert" className="mt-3 rounded-xl bg-red-500/20 px-3 py-2 text-[13px] text-red-100">
            <p>{error}</p>
            {/micr[oó]fono/i.test(error) && <button type="button" onClick={() => void pedirMicrofono()} className="mt-2 rounded-full bg-[#e0bd7c] px-3.5 py-1.5 text-xs font-semibold text-[#2b1f06]">Dar permiso del micrófono</button>}
          </div>
        )}
      </div>

      <div className="px-5 pt-1 pb-4">
        {/* Onda de voz: barras que suben con tu voz; al hablar el asistente, laten. */}
        <div className="flex h-10 items-center justify-center gap-1" aria-hidden="true">
          {Array.from({ length: BARRAS }).map((_, i) => (
            <span key={i} ref={(el) => { barras.current[i] = el; }} className={`h-full w-1 origin-center rounded-full bg-[#e0bd7c] transition-transform duration-75 ${fase === "hablando" ? "animate-pulse" : ""}`} style={{ transform: "scaleY(0.15)", animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
        {aviso && <p className="mt-1 rounded-lg bg-white/10 px-3 py-1.5 text-center text-[11px] text-[#f4efe2]/80">{aviso}</p>}
        <p className="mt-1 text-center text-xs text-[#f4efe2]/70" aria-live="polite">{soporte ? etiqueta : "Este navegador no reconoce la voz: usa Chrome o Edge."}</p>
        {adjunto && (
          <p className="mt-2 flex items-center justify-center gap-2 text-xs text-[#f4efe2]/80">
            <FileText className="size-3.5 shrink-0 text-[#e0bd7c]" aria-hidden="true" />
            <span className="min-w-0 truncate">{adjunto.nombre}</span>
            <button type="button" aria-label="Quitar el archivo" onClick={() => { adjuntoRef.current = null; setAdjunto(null); }} className="rounded-full p-1 hover:bg-white/10"><X className="size-3" aria-hidden="true" /></button>
          </p>
        )}
        {verEnlace && (
          <form className="mt-2 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (enlace.trim()) void leerEnlace(enlace.trim()); }}>
            <input autoFocus value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="Pega aquí el enlace (https://…)" aria-label="Enlace para analizar" className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-[#f4efe2] placeholder:text-[#f4efe2]/40 outline-none focus:ring-2 focus:ring-[#e0bd7c]/60" />
            <button type="submit" disabled={!enlace.trim() || subiendo} className="rounded-full bg-[#e0bd7c] px-3.5 py-2 text-xs font-semibold text-[#2b1f06] disabled:opacity-40">Analizar</button>
          </form>
        )}
        <input ref={entradaArchivo} type="file" hidden accept=".pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,.log" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void adjuntar(f); }} />
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" onClick={() => entradaArchivo.current?.click()} disabled={subiendo || fase === "pensando"} aria-label="Adjuntar un archivo para analizarlo" title="Adjuntar un archivo para analizarlo o escribir a partir de él" className="grid size-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-40">{subiendo ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Paperclip className="size-5" aria-hidden="true" />}</button>
          <button type="button" onClick={principal} disabled={!soporte && fase === "reposo"} aria-label={fase === "reposo" ? "Hablar" : "Detener"} className={`grid size-14 place-items-center rounded-full transition disabled:opacity-40 ${fase === "escuchando" ? "bg-red-500 text-white" : "bg-[#e0bd7c] text-[#2b1f06] hover:brightness-105"}`}>
            {fase === "reposo" ? <Mic className="size-6" aria-hidden="true" /> : fase === "pensando" ? <Loader2 className="size-6 animate-spin" aria-hidden="true" /> : <Square className="size-5" aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => setVerEnlace((v) => !v)} disabled={subiendo || fase === "pensando"} aria-label="Pegar un enlace para analizarlo" aria-pressed={verEnlace} title="Pegar un enlace (noticia, PDF o video de YouTube) para analizarlo" className={`grid size-11 place-items-center rounded-full transition hover:bg-white/20 disabled:opacity-40 ${verEnlace ? "bg-[#e0bd7c] text-[#2b1f06]" : "bg-white/10"}`}><Link2 className="size-5" aria-hidden="true" /></button>
        </div>
        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-xs text-[#f4efe2]/70"><input type="checkbox" className="size-3.5 accent-[#e0bd7c]" checked={continuo} onChange={(e) => setContinuo(e.target.checked)} />Conversación continua (vuelve a escucharte solo)</label>
      </div>
    </div>
  );
}

/** El botón que abre el asistente de voz, siempre a mano en el panel. */
export function BotonAsistenteVoz() {
  const [abierto, setAbierto] = React.useState(false);
  const [pos, setPos] = React.useState<Pos | null>(null);
  const movido = React.useRef(false);
  /* eslint-disable react-hooks/set-state-in-effect -- se lee del navegador al montar (en el servidor no existe) */
  React.useEffect(() => {
    try { const g = window.localStorage.getItem(CLAVE_POS); if (g) setPos(JSON.parse(g) as Pos); } catch { /* sin almacenamiento */ }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const mover = (p: Pos, fin: boolean) => {
    setPos(p);
    if (fin) try { window.localStorage.setItem(CLAVE_POS, JSON.stringify(p)); } catch { /* sin almacenamiento */ }
  };
  return (
    <>
      {abierto && <AsistenteVoz alCerrar={() => setAbierto(false)} pos={pos} alMover={mover} />}
      {!abierto && (
        <button
          type="button"
          style={pos ? { left: pos.x, top: pos.y, bottom: "auto" } : undefined}
          onPointerDown={(e) => { movido.current = false; arrastrar(e, e.currentTarget, (p) => { movido.current = true; setPos(p); }, (m) => { if (m) { movido.current = true; const r = (e.currentTarget as HTMLElement | null)?.getBoundingClientRect(); if (r) mover({ x: r.left, y: r.top }, true); } }); }}
          onClick={() => { if (movido.current) { movido.current = false; return; } setAbierto(true); }}
          className="fixed bottom-5 left-[7rem] z-[60] hidden cursor-grab touch-none items-center gap-2 rounded-full bg-[#06281c] py-1.5 pr-5 pl-1.5 text-sm font-semibold text-[#f4efe2] shadow-xl ring-1 ring-white/10 transition hover:brightness-110 active:cursor-grabbing md:inline-flex"
          aria-label="Hablar con MaFe (arrastra para mover)"
        >
          <MafeAvatar title="MaFe" className="size-11 rounded-full" />Hablar con MaFe
        </button>
      )}
    </>
  );
}
