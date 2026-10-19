"use client";

import * as React from "react";
import { Loader2, Mic, Send, Square, Volume2, VolumeX, X } from "lucide-react";

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
    if (ult && ult.length + f.length < 160) trozos[trozos.length - 1] = `${ult} ${f}`;
    else trozos.push(f);
  }
  return trozos.slice(0, 8);
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
  const [parcial, setParcial] = React.useState("");
  const [continuo, setContinuo] = React.useState(true);
  const [silencio, setSilencio] = React.useState(false);
  const [error, setError] = React.useState("");
  const [escrito, setEscrito] = React.useState("");
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
        fuente.connect(ctx.destination);
        fuente.onended = () => { detener.current = null; fin(); };
        detener.current = () => { fuente.onended = null; try { fuente.stop(); } catch { /* ya terminó */ } fin(); };
        fuente.start();
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
        .then(async (r) => (r.status === 200 ? { blob: await r.blob(), motivo: "" } : { blob: null, motivo: decodeURIComponent(r.headers.get("x-voz-motivo") ?? "") || `respuesta ${r.status}` }))
        .catch(() => ({ blob: null as Blob | null, motivo: "sin conexión con el servidor" }));
    let precarga = pedir(frases[0]);
    let vozNatural = true;
    for (let i = 0; i < frases.length; i++) {
      if (gen.current !== miGen) return;
      const r = vozNatural ? await precarga : { blob: null as Blob | null, motivo: "" };
      if (i + 1 < frases.length && vozNatural) precarga = pedir(frases[i + 1]);
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

  async function reproducir(texto: string) {
    desbloquearAudio();
    pararTodo();
    const miGen = ++gen.current;
    setFase("hablando");
    await hablar(texto, miGen);
    if (gen.current === miGen) setFase("reposo");
  }

  async function enviar(pregunta: string) {
    const texto = pregunta.trim();
    if (!texto) return;
    desbloquearAudio();
    pararTodo();
    const miGen = ++gen.current;
    setParcial("");
    setError("");
    const previo = turnosRef.current.filter((t) => t.texto !== SALUDO);
    setTurnos((t) => [...t, { rol: "usuario", texto }]);
    setFase("pensando");
    try {
      const r = await fetch("/api/admin/asistente-voz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pregunta: texto, historial: previo.map(({ rol, texto: x }) => ({ rol, texto: x })) }) });
      const j = (await r.json().catch(() => ({}))) as { respuesta?: string; fuente?: string; error?: string };
      if (gen.current !== miGen) return;
      if (!r.ok || !j.respuesta) throw new Error(j.error ?? "No pude responder.");
      setTurnos((t) => [...t, { rol: "asistente", texto: j.respuesta!, fuente: j.fuente }]);
      setFase("hablando");
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
    <div style={pos && typeof window !== "undefined" && window.innerWidth >= 640 ? { left: pos.x, top: pos.y, bottom: "auto" } : undefined} className="fixed inset-x-3 bottom-3 z-[70] flex max-h-[80dvh] flex-col overflow-hidden rounded-3xl bg-[#06281c] text-[#f4efe2] shadow-2xl ring-1 ring-white/10 sm:inset-x-auto sm:bottom-5 sm:left-[7rem] sm:w-[26rem]" role="dialog" aria-label="Asistente de voz">
      <div
        className="flex cursor-grab items-center justify-between px-5 pt-4 active:cursor-grabbing sm:touch-none"
        onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button") || !alMover || window.innerWidth < 640) return; const panel = e.currentTarget.parentElement as HTMLElement; arrastrar(e, panel, (p) => alMover(p, false), (m) => { if (m) alMover({ x: panel.getBoundingClientRect().left, y: panel.getBoundingClientRect().top }, true); }); }}
        title="Arrastra para mover"
      >
        <div className="flex items-center gap-3">
          <MafeAvatar talking={fase === "hablando"} title="MaFe" className={`size-14 rounded-full ring-2 transition ${fase === "escuchando" ? "ring-red-400" : fase === "hablando" ? "ring-[#e0bd7c]" : "ring-white/15"}`} />
          <p className="text-lg leading-tight"><span className="font-bold">MaFe</span><br /><span className="text-xs font-normal text-[#f4efe2]/60">Asistente de voz</span></p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => { setSilencio((s) => !s); if (!silencio) { audio.current?.pause(); window.speechSynthesis?.cancel(); } }} aria-pressed={silencio} aria-label={silencio ? "Activar la voz" : "Silenciar la voz"} className="rounded-full p-2 hover:bg-white/10">{silencio ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}</button>
          <button type="button" onClick={() => { pararTodo(); alCerrar(); }} aria-label="Cerrar" className="rounded-full p-2 hover:bg-white/10"><X className="size-4" aria-hidden="true" /></button>
        </div>
      </div>

      <div ref={lista} className="mt-2 min-h-24 flex-1 space-y-2 overflow-y-auto px-5 py-2 text-[14px] leading-relaxed">
        {turnos.map((t, i) => (
          <div key={i} className={t.rol === "usuario" ? "ml-8 rounded-2xl rounded-br-md bg-[#e0bd7c] px-3.5 py-2 text-[#2b1f06]" : "mr-4"}>
            {t.texto}
            {t.rol === "asistente" && t.texto !== SALUDO && (
              <span className="mt-1 flex items-center gap-3 text-[11px] text-[#f4efe2]/50">
                {t.fuente && <span>Fuente: {t.fuente}</span>}
                <button type="button" onClick={() => void reproducir(t.texto)} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[#e0bd7c] hover:bg-white/10"><Volume2 className="size-3" aria-hidden="true" />Escuchar</button>
              </span>
            )}
          </div>
        ))}
        {parcial && <div className="ml-8 rounded-2xl rounded-br-md bg-[#e0bd7c]/60 px-3.5 py-2 text-[#2b1f06] italic">{parcial}</div>}
        {fase === "pensando" && <div className="flex items-center gap-2 text-[#f4efe2]/60"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Consultando…</div>}
        {error && (
          <div role="alert" className="rounded-xl bg-red-500/20 px-3 py-2 text-[13px] text-red-100">
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
        <p className="mt-1 text-center text-xs text-[#f4efe2]/70" aria-live="polite">{soporte ? etiqueta : "Tu navegador no reconoce voz: escribe abajo."}</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" onClick={principal} disabled={!soporte && fase === "reposo"} aria-label={fase === "reposo" ? "Hablar" : "Detener"} className={`grid size-14 place-items-center rounded-full transition disabled:opacity-40 ${fase === "escuchando" ? "bg-red-500 text-white" : "bg-[#e0bd7c] text-[#2b1f06] hover:brightness-105"}`}>
            {fase === "reposo" ? <Mic className="size-6" aria-hidden="true" /> : fase === "pensando" ? <Loader2 className="size-6 animate-spin" aria-hidden="true" /> : <Square className="size-5" aria-hidden="true" />}
          </button>
        </div>
        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-xs text-[#f4efe2]/70"><input type="checkbox" className="size-3.5 accent-[#e0bd7c]" checked={continuo} onChange={(e) => setContinuo(e.target.checked)} />Conversación continua (vuelve a escucharte solo)</label>
        <form className="mt-3 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); const t = escrito; setEscrito(""); void enviar(t); }}>
          <input value={escrito} onChange={(e) => setEscrito(e.target.value)} placeholder="O escribe tu pregunta" className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-[#f4efe2] placeholder:text-[#f4efe2]/40 outline-none focus:ring-2 focus:ring-[#e0bd7c]/60" />
          <button type="submit" disabled={!escrito.trim() || fase === "pensando"} aria-label="Enviar" className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40"><Send className="size-4" aria-hidden="true" /></button>
        </form>
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
