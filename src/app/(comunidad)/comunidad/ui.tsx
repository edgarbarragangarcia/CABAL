"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Heart, Loader2, MessageCircle, Send, UserPlus, UserCheck, Users } from "lucide-react";

import type { Autor, Comentario, Grupo, Publicacion } from "@/lib/comunidad/store";

export type Ambito = string; // "seguidos" | "todos" | "grupo:<slug>" | "perfil:<usuario>"

export const tarjeta = "rounded-2xl border border-border bg-surface shadow-sm";

export async function api<T = unknown>(url: string, cuerpo?: unknown): Promise<T> {
  const res = await fetch(url, cuerpo === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(b.error ?? "No fue posible completar la acción.");
  return b as T;
}

const COLORES = ["from-emerald-500 to-teal-600", "from-sky-500 to-indigo-600", "from-amber-400 to-orange-600", "from-fuchsia-500 to-pink-600", "from-violet-500 to-purple-700"];
const colorDe = (s: string) => COLORES[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORES.length];

export function Avatar({ autor, tam = "size-11" }: { autor: Pick<Autor, "nombre" | "usuario" | "esOficial">; tam?: string }) {
  if (autor.esOficial)
    return <Image src="/logo-mark.png" alt="" width={48} height={48} className={`${tam} shrink-0 rounded-full bg-white object-contain p-1 ring-2 ring-amber-400`} />;
  const ini = autor.nombre.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return <span aria-hidden className={`${tam} grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${colorDe(autor.usuario)} text-sm font-bold text-white`}>{ini}</span>;
}

export function Nombre({ autor }: { autor: Autor }) {
  return (
    <Link href={`/comunidad/miembro/${autor.usuario}`} className="inline-flex items-center gap-1 font-semibold hover:underline">
      {autor.nombre}
      {autor.esOficial && <BadgeCheck className="size-4 text-amber-500" aria-label="Cuenta oficial" />}
    </Link>
  );
}

export function hace(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

/* ------------------------------------------------------------- seguir */

export function BotonSeguir({ miembroId, inicial, compacto }: { miembroId: string; inicial: boolean; compacto?: boolean }) {
  const [sigo, setSigo] = React.useState(inicial);
  const [espera, setEspera] = React.useState(false);
  async function alternar() {
    setEspera(true);
    try {
      await api("/api/comunidad/seguir", { miembroId, seguir: !sigo });
      setSigo(!sigo);
    } finally {
      setEspera(false);
    }
  }
  return (
    <button type="button" onClick={alternar} disabled={espera} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold transition ${compacto ? "px-3 py-1.5 text-xs" : "px-5 py-2 text-sm"} ${sigo ? "bg-surface-muted text-foreground ring-1 ring-border" : "bg-brand text-brand-foreground"}`}>
      {sigo ? <><UserCheck className="size-4" /> Siguiendo</> : <><UserPlus className="size-4" /> Seguir</>}
    </button>
  );
}

/* --------------------------------------------------------- publicación */

function Comentarios({ id, alCambiar }: { id: string; alCambiar: (n: number) => void }) {
  const [lista, setLista] = React.useState<Comentario[] | null>(null);
  const [texto, setTexto] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState("");
  const cargar = React.useCallback(() => api<{ comentarios: Comentario[] }>(`/api/comunidad/comentarios?publicacion=${id}`).then((r) => { setLista(r.comentarios); alCambiar(r.comentarios.length); }).catch((e) => setError(e.message)), [id, alCambiar]);
  React.useEffect(() => { cargar(); }, [cargar]);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setError("");
    try {
      await api("/api/comunidad/comentarios", { publicacionId: id, texto });
      setTexto("");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo comentar.");
    } finally {
      setEnviando(false);
    }
  }
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {lista === null ? <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" /> : lista.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Avatar autor={c.autor} tam="size-8" />
          <div className="min-w-0 flex-1 rounded-2xl bg-surface-muted px-3 py-2 text-sm">
            <p className="text-xs"><Nombre autor={c.autor} /> <span className="text-muted-foreground">· {hace(c.creadoEn)}</span></p>
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{c.texto}</p>
          </div>
        </div>
      ))}
      <form onSubmit={enviar} className="flex gap-2">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} placeholder="Escribe un comentario…" className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-brand" />
        <button type="submit" disabled={enviando || !texto.trim()} aria-label="Enviar comentario" className="grid size-9 place-items-center rounded-full bg-brand text-brand-foreground disabled:opacity-50"><Send className="size-4" /></button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function TarjetaPublicacion({ p }: { p: Publicacion }) {
  const [gusta, setGusta] = React.useState(p.yoLeDi);
  const [n, setN] = React.useState(p.meGusta);
  const [abiertos, setAbiertos] = React.useState(false);
  const [nCom, setNCom] = React.useState(p.comentarios);
  async function alternar() {
    setGusta(!gusta);
    setN(n + (gusta ? -1 : 1));
    try { await api("/api/comunidad/me-gusta", { publicacionId: p.id }); } catch { setGusta(gusta); setN(n); }
  }
  return (
    <article className={`${tarjeta} p-4 ${p.autor.esOficial ? "border-amber-400/60 bg-gradient-to-b from-amber-50/60 to-surface dark:from-amber-400/5" : ""}`}>
      <header className="flex gap-3">
        <Avatar autor={p.autor} />
        <div className="min-w-0 flex-1 text-sm">
          <p className="leading-tight"><Nombre autor={p.autor} /></p>
          <p className="truncate text-xs text-muted-foreground">{p.autor.esOficial ? "Cuenta oficial" : `${p.autor.barrio} · ${p.autor.municipio}`} · {hace(p.creadoEn)}</p>
        </div>
        {p.grupo && <span className="h-fit rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand">{p.grupo.nombre}</span>}
      </header>
      <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{p.texto}</p>
      <footer className="mt-3 flex items-center gap-1 border-t border-border pt-2 text-sm">
        <button type="button" onClick={alternar} aria-pressed={gusta} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-surface-muted ${gusta ? "font-semibold text-rose-600" : "text-muted-foreground"}`}>
          <Heart className={`size-[18px] ${gusta ? "fill-current" : ""}`} /> {n > 0 ? n : "Me gusta"}
        </button>
        <button type="button" onClick={() => setAbiertos(!abiertos)} aria-expanded={abiertos} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-muted-foreground transition hover:bg-surface-muted">
          <MessageCircle className="size-[18px]" /> {nCom > 0 ? nCom : "Comentar"}
        </button>
      </footer>
      {abiertos && <Comentarios id={p.id} alCambiar={setNCom} />}
    </article>
  );
}

/* ----------------------------------------------------------- composer */

export function Publicador({ grupos, alPublicar, grupoInicial }: { grupos: Grupo[]; alPublicar: () => void; grupoInicial?: string }) {
  const [texto, setTexto] = React.useState("");
  const [grupo, setGrupo] = React.useState(grupoInicial ?? "");
  const [enviando, setEnviando] = React.useState(false);
  const [error, setError] = React.useState("");
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setError("");
    try {
      await api("/api/comunidad/publicar", { texto, ...(grupo ? { grupo } : {}) });
      setTexto("");
      alPublicar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo publicar.");
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form onSubmit={enviar} className={`${tarjeta} p-4`}>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} rows={texto.length > 80 ? 4 : 2} placeholder="¿Qué quieres compartir con tu comunidad?" className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <select value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Dónde publicar" className="min-w-0 max-w-[60%] rounded-full border border-border bg-surface-muted px-3 py-1.5 text-xs font-medium outline-none">
          <option value="">A todos mis seguidores</option>
          {grupos.map((g) => <option key={g.id} value={g.slug}>Solo grupo: {g.nombre}</option>)}
        </select>
        <button type="submit" disabled={enviando || !texto.trim()} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Publicar
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </form>
  );
}

/* --------------------------------------------------------------- muro */

export function Muro({ ambito, refresco }: { ambito: Ambito; refresco: number }) {
  const [lista, setLista] = React.useState<Publicacion[] | null>(null);
  const [error, setError] = React.useState("");
  const [mas, setMas] = React.useState(true);
  const [cargandoMas, setCargandoMas] = React.useState(false);

  React.useEffect(() => {
    let cancelado = false;
    api<{ publicaciones: Publicacion[] }>(`/api/comunidad/muro?ambito=${encodeURIComponent(ambito)}`)
      .then((r) => { if (!cancelado) { setLista(r.publicaciones); setMas(r.publicaciones.length >= 15); } })
      .catch((e) => !cancelado && setError(e.message));
    return () => { cancelado = true; };
  }, [ambito, refresco]);

  async function cargarMas() {
    if (!lista?.length) return;
    setCargandoMas(true);
    try {
      const r = await api<{ publicaciones: Publicacion[] }>(`/api/comunidad/muro?ambito=${encodeURIComponent(ambito)}&antes=${encodeURIComponent(lista[lista.length - 1].creadoEn)}`);
      setLista([...lista, ...r.publicaciones]);
      setMas(r.publicaciones.length >= 15);
    } finally {
      setCargandoMas(false);
    }
  }

  if (error) return <p className={`${tarjeta} p-4 text-sm text-destructive`}>{error}</p>;
  if (!lista) return <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface" />)}</div>;
  if (!lista.length)
    return (
      <div className={`${tarjeta} grid place-items-center gap-2 p-10 text-center`}>
        <Users className="size-9 text-muted-foreground" />
        <p className="font-semibold">Aquí todavía no hay publicaciones</p>
        <p className="max-w-xs text-sm text-muted-foreground">Sigue a otras personas, entra a los grupos de tu barrio o sé el primero en publicar.</p>
      </div>
    );
  return (
    <div className="space-y-3">
      {lista.map((p) => <TarjetaPublicacion key={p.id} p={p} />)}
      {mas && <button type="button" onClick={cargarMas} disabled={cargandoMas} className="w-full rounded-full border border-border py-2.5 text-sm font-semibold hover:bg-surface">{cargandoMas ? "Cargando…" : "Ver más"}</button>}
    </div>
  );
}
