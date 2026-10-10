"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, CalendarDays, Flame, GraduationCap, HandHeart, Home, Landmark, LogOut, MapPin, Newspaper, PenSquare, Sparkles, TrendingDown, TrendingUp, User, Users, X } from "lucide-react";

import type { Autor, Grupo, Miembro } from "@/lib/comunidad/store";
import type { Tendencias, Tema } from "@/lib/comunidad/tendencias";
import { Avatar, BotonSeguir, Muro, Nombre, Publicador, REJILLA_MURO, TarjetaPublicacion, api, tarjeta } from "./ui";

type Vista = "inicio" | "tendencias" | "red" | "perfil";
type Subred = "personas" | "grupos";

const PADDING = "px-4 sm:px-6 lg:px-8 2xl:px-12";
const CONTENEDOR = "mx-auto w-full max-w-[2400px]";

/* ---------------------------------------------------------------- perfil */

function TarjetaPerfil({ yo, seguidores, siguiendo }: { yo: Miembro; seguidores: number; siguiendo: number }) {
  const router = useRouter();
  const [editando, setEditando] = React.useState(false);
  const [bio, setBio] = React.useState(yo.bio);
  const [guardado, setGuardado] = React.useState(yo.bio);
  async function guardar() {
    await api("/api/comunidad/perfil", { bio });
    setGuardado(bio);
    setEditando(false);
  }
  async function salir() {
    await api("/api/comunidad/salir", {});
    router.push("/unete");
    router.refresh();
  }
  return (
    <section className={`${tarjeta} overflow-hidden`}>
      <div className="relative h-24 bg-gradient-to-r from-[#0a4f37] via-[#0f6b4c] to-[#b3893c]">
        <div aria-hidden className="bg-grain absolute inset-0 opacity-20 mix-blend-overlay" />
      </div>
      <div className="relative -mt-11 px-5 pb-5">
        <Avatar autor={yo} tam="size-[5.5rem] text-2xl ring-4 ring-surface" />
        <h2 className="mt-2 font-display text-xl leading-tight font-semibold">{yo.nombre}</h2>
        <p className="text-sm text-muted-foreground">@{yo.usuario}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3.5" /> {yo.barrio} · {yo.municipio}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-surface-muted py-2.5"><dd className="text-xl font-bold">{seguidores}</dd><dt className="text-[11px] text-muted-foreground">Seguidores</dt></div>
          <div className="rounded-xl bg-surface-muted py-2.5"><dd className="text-xl font-bold">{siguiendo}</dd><dt className="text-[11px] text-muted-foreground">Siguiendo</dt></div>
        </dl>
        {editando ? (
          <div className="mt-3 space-y-2">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={3} className="w-full rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-brand" placeholder="Cuéntale a la comunidad quién eres" />
            <div className="flex gap-2"><button type="button" onClick={guardar} className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-brand-foreground">Guardar</button><button type="button" onClick={() => { setBio(guardado); setEditando(false); }} className="rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground">Cancelar</button></div>
          </div>
        ) : (
          <button type="button" onClick={() => setEditando(true)} className="mt-3 block w-full text-left text-sm text-muted-foreground hover:text-foreground">{guardado || "Agrega una biografía…"}</button>
        )}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs font-semibold">
          <Link href={`/comunidad/miembro/${yo.usuario}`} className="inline-flex items-center gap-1 text-brand hover:underline">Ver mi perfil <ArrowUpRight className="size-3.5" /></Link>
          <button type="button" onClick={salir} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><LogOut className="size-3.5" /> Cerrar sesión</button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ tendencias */

/** Cómo cambió un tema frente al periodo anterior: sube, baja, se mantiene o es nuevo. */
function Variacion({ t }: { t: Pick<Tema, "menciones" | "antes"> }) {
  const d = t.menciones - t.antes;
  if (t.antes === 0) return <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"><Sparkles className="size-3" /> Nuevo</span>;
  if (d > 0) return <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"><TrendingUp className="size-3" /> +{d}</span>;
  if (d < 0) return <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300"><TrendingDown className="size-3" /> {d}</span>;
  return <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">=</span>;
}

function TarjetaTendencias({ tend, elegirTema, verTodas }: { tend: Tendencias | null | "error"; elegirTema: (t: Tema) => void; verTodas: () => void }) {
  return (
    <section className={`${tarjeta} p-4`}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Flame className="size-4 text-amber-500" /> Tendencias de la semana</h3>
      {tend === null ? <div className="mt-3 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-surface-muted" />)}</div>
        : tend === "error" || tend.temas.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Todavía no hay suficiente conversación para marcar tendencias. Publica, comenta y reacciona: los temas aparecerán aquí.</p>
        : (
          <ol className="mt-3 space-y-1">
            {tend.temas.slice(0, 5).map((t, i) => (
              <li key={t.palabra}>
                <button type="button" onClick={() => elegirTema(t)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-surface-muted">
                  <span className="w-5 text-center font-display text-lg text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-sm font-semibold">{t.hashtag ? t.palabra : t.palabra.charAt(0).toUpperCase() + t.palabra.slice(1)}</span><span className="text-xs text-muted-foreground">{t.menciones} publicaci{t.menciones === 1 ? "ón" : "ones"} · {t.autores} persona{t.autores === 1 ? "" : "s"}</span></span>
                  <Variacion t={t} />
                </button>
              </li>
            ))}
          </ol>
        )}
      <button type="button" onClick={verTodas} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Ver todas las tendencias <ArrowRight className="size-3.5" /></button>
    </section>
  );
}

function VistaTendencias({ tend, elegirTema, elegirGrupo, elegirEtiqueta, destacadas }: { tend: Tendencias | null | "error"; elegirTema: (t: Tema) => void; elegirGrupo: (slug: string) => void; elegirEtiqueta: (e: string) => void; destacadas: Set<string> }) {
  const vacio = tend !== null && (tend === "error" || (tend.publicaciones.length === 0 && tend.temas.length === 0));
  const maxTema = tend && tend !== "error" ? Math.max(1, ...tend.temas.map((t) => t.menciones)) : 1;
  const maxGrupo = tend && tend !== "error" ? Math.max(1, ...tend.grupos.map((g) => g.interacciones + g.publicaciones)) : 1;
  return (
    <section className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold"><Flame className="size-6 text-amber-500" /> Tendencias</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Lo que más se mueve en la comunidad en los últimos 7 días: qué se está comentando, de qué se habla más que la semana anterior y dónde hay más actividad.</p>
      </div>
      {tend === null ? <div className={REJILLA_MURO}>{[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface" />)}</div>
        : vacio ? (
          <div className={`${tarjeta} grid place-items-center gap-2 p-12 text-center`}>
            <Flame className="size-9 text-muted-foreground" />
            <p className="font-semibold">Todavía no hay suficiente actividad</p>
            <p className="max-w-sm text-sm text-muted-foreground">Cuando se publique, se comente y se reaccione más, aquí verás lo que está en tendencia y de qué se habla.</p>
          </div>
        ) : (
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="min-w-0 space-y-3">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Lo más movido de la semana</h3>
              <div className={REJILLA_MURO}>{tend.publicaciones.map((p) => <TarjetaPublicacion key={p.id} p={p} tendencia={destacadas.has(p.id)} alTema={elegirEtiqueta} />)}</div>
            </div>
            <div className="grid min-w-0 content-start gap-4 md:grid-cols-2 2xl:grid-cols-1">
              <section className={`${tarjeta} p-5`}>
                <h3 className="text-sm font-semibold">Temas en alza</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Palabras que más se repiten en publicaciones de personas distintas, frente a la semana anterior.</p>
                {tend.temas.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Aún no hay temas que se repitan.</p> : (
                  <ol className="mt-3 space-y-2">
                    {tend.temas.map((t, i) => (
                      <li key={t.palabra}>
                        <button type="button" onClick={() => elegirTema(t)} className="group block w-full rounded-xl px-2 py-1.5 text-left transition hover:bg-surface-muted">
                          <span className="flex items-center gap-3">
                            <span className="w-5 text-center font-display text-base text-muted-foreground">{i + 1}</span>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold group-hover:underline">{t.hashtag ? t.palabra : t.palabra.charAt(0).toUpperCase() + t.palabra.slice(1)}</span>
                            <span className="text-xs text-muted-foreground">{t.menciones}</span>
                            <Variacion t={t} />
                          </span>
                          <span className="mt-1.5 block h-1.5 rounded-full bg-surface-muted"><span className="block h-full rounded-full bg-gradient-to-r from-[#0a4f37] to-[#b3893c]" style={{ width: `${Math.max(8, (t.menciones / maxTema) * 100)}%` }} /></span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
              <section className={`${tarjeta} p-5`}>
                <h3 className="text-sm font-semibold">Grupos más activos</h3>
                {tend.grupos.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Ningún grupo tuvo publicaciones esta semana.</p> : (
                  <ul className="mt-3 space-y-3">
                    {tend.grupos.map((g) => (
                      <li key={g.slug}>
                        <button type="button" onClick={() => elegirGrupo(g.slug)} className="group block w-full text-left">
                          <span className="flex items-baseline justify-between gap-3"><span className="truncate text-sm font-semibold group-hover:underline">{g.nombre}</span><span className="shrink-0 text-xs text-muted-foreground">{g.publicaciones} publ. · {g.interacciones} interac.</span></span>
                          <span className="mt-1.5 block h-1.5 rounded-full bg-surface-muted"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(8, ((g.interacciones + g.publicaciones) / maxGrupo) * 100)}%` }} /></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className={`${tarjeta} p-5 md:col-span-2 2xl:col-span-1`}>
                <h3 className="text-sm font-semibold">Voces destacadas</h3>
                {tend.voces.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Todavía no hay voces destacadas.</p> : (
                  <ul className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-1">
                    {tend.voces.map((v) => (
                      <li key={v.autor.id} className="flex items-center gap-3">
                        <Avatar autor={v.autor} tam="size-10" />
                        <div className="min-w-0 flex-1 text-sm leading-tight"><Nombre autor={v.autor} /><p className="truncate text-xs text-muted-foreground">{v.publicaciones} publicaci{v.publicaciones === 1 ? "ón" : "ones"} · {v.interacciones} interacciones</p></div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
    </section>
  );
}

/* ----------------------------------------------------------- red y grupos */

function TarjetaSugerencias({ lista, verMas }: { lista: Autor[]; verMas: () => void }) {
  return (
    <section className={`${tarjeta} p-4`}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-amber-500" /> A quién seguir</h3>
      {lista.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Cuando se afilien más personas de tu zona aparecerán aquí.</p> : (
        <>
          <ul className="mt-3 space-y-3">
            {lista.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-center gap-3">
                <Avatar autor={a} tam="size-10" />
                <div className="min-w-0 flex-1 text-sm leading-tight"><Nombre autor={a} /><p className="truncate text-xs text-muted-foreground">{a.barrio} · {a.municipio}</p></div>
                <BotonSeguir miembroId={a.id} inicial={false} compacto />
              </li>
            ))}
          </ul>
          {lista.length > 5 && <button type="button" onClick={verMas} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Ver toda mi red <ArrowRight className="size-3.5" /></button>}
        </>
      )}
    </section>
  );
}

function IconoGrupo() {
  return <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#0a4f37] to-[#14825c] text-white"><MapPin className="size-4" /></span>;
}

function TarjetaGrupos({ grupos, activo, elegir }: { grupos: Grupo[]; activo: string; elegir: (slug: string) => void }) {
  return (
    <section className={`${tarjeta} p-4`}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Users className="size-4 text-brand" /> Mis grupos</h3>
      <ul className="mt-3 space-y-1">
        {grupos.map((g) => (
          <li key={g.id}>
            <button type="button" onClick={() => elegir(g.slug)} className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${activo === `grupo:${g.slug}` ? "bg-brand-soft" : "hover:bg-surface-muted"}`}>
              <IconoGrupo />
              <span className="min-w-0 flex-1 text-sm leading-tight"><span className="block truncate font-semibold">{g.nombre}</span><span className="text-xs text-muted-foreground">{g.tipo === "barrio" ? "Tu barrio" : "Tu ciudad"} · {g.miembros} afiliado{g.miembros === 1 ? "" : "s"}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const ENLACES = [
  { href: "/cursos", texto: "Cursos y diplomados", icono: GraduationCap },
  { href: "/academia/observatorio-legislativo", texto: "Observatorio legislativo", icono: Landmark },
  { href: "/academia/boletines", texto: "Boletines semanales", icono: Newspaper },
  { href: "/eventos", texto: "Eventos", icono: CalendarDays },
  { href: "/donar", texto: "Apoyar la Fundación", icono: HandHeart },
];

function TarjetaFundacion() {
  return (
    <section className={`${tarjeta} p-4`}>
      <h3 className="text-sm font-semibold">De la Fundación</h3>
      <ul className="mt-2">
        {ENLACES.map((e) => (
          <li key={e.href}>
            <Link href={e.href} className="group flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition hover:bg-surface-muted"><e.icono className="size-4 text-brand" /><span className="flex-1">{e.texto}</span><ArrowUpRight className="size-3.5 text-muted-foreground transition group-hover:text-foreground" /></Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VistaRed({ yo, lista, grupos, sub, setSub, elegirGrupo }: { yo: Miembro; lista: Autor[]; grupos: Grupo[]; sub: Subred; setSub: (s: Subred) => void; elegirGrupo: (slug: string) => void }) {
  const zonas = [
    { t: "En tu barrio", l: lista.filter((a) => a.barrio === yo.barrio && a.municipio === yo.municipio) },
    { t: "En tu ciudad", l: lista.filter((a) => !(a.barrio === yo.barrio && a.municipio === yo.municipio) && a.municipio === yo.municipio) },
    { t: "En otras ciudades", l: lista.filter((a) => a.municipio !== yo.municipio) },
  ].filter((z) => z.l.length);
  const GRILLA = "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]";
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Mi red</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Sigue a las personas de tu zona para ver lo que publican en «Para ti», o entra a los grupos de tu barrio y tu ciudad.</p>
        </div>
        <div role="tablist" className="inline-flex rounded-full bg-surface p-1 ring-1 ring-border">
          {([["personas", "Personas"], ["grupos", "Grupos"]] as const).map(([id, t]) => <button key={id} type="button" role="tab" aria-selected={sub === id} onClick={() => setSub(id)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${sub === id ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>)}
        </div>
      </div>
      {sub === "personas" ? (
        zonas.length === 0 ? <div className={`${tarjeta} p-10 text-center text-sm text-muted-foreground`}>Cuando se afilien más personas de tu zona aparecerán aquí.</div>
          : zonas.map((z) => (
            <div key={z.t} className="space-y-3">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{z.t} <span className="font-normal">· {z.l.length}</span></h3>
              <ul className={GRILLA}>
                {z.l.map((a) => (
                  <li key={a.id} className={`${tarjeta} flex items-center gap-3 p-4`}>
                    <Avatar autor={a} tam="size-12" />
                    <div className="min-w-0 flex-1 text-sm leading-tight"><Nombre autor={a} /><p className="truncate text-xs text-muted-foreground">{a.barrio} · {a.municipio}</p></div>
                    <BotonSeguir miembroId={a.id} inicial={false} compacto />
                  </li>
                ))}
              </ul>
            </div>
          ))
      ) : (
        <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))]">
          {grupos.map((g) => (
            <li key={g.id} className={`${tarjeta} flex flex-col gap-4 p-5`}>
              <div className="flex items-center gap-3"><IconoGrupo /><div className="min-w-0 leading-tight"><p className="truncate font-semibold">{g.nombre}</p><p className="text-xs text-muted-foreground">{g.tipo === "barrio" ? "Tu barrio" : "Tu ciudad"}</p></div></div>
              <p className="text-sm text-muted-foreground"><b className="text-foreground">{g.miembros}</b> afiliado{g.miembros === 1 ? "" : "s"}</p>
              <button type="button" onClick={() => elegirGrupo(g.slug)} className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition hover:brightness-110">Ver publicaciones <ArrowRight className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- panel */

export function PanelComunidad({ yo, seguidores, siguiendo, grupos, sugerencias, afiliados }: { yo: Miembro; seguidores: number; siguiendo: number; grupos: Grupo[]; sugerencias: Autor[]; afiliados: number }) {
  const [vista, setVista] = React.useState<Vista>("inicio");
  const [subred, setSubred] = React.useState<Subred>("personas");
  const [ambito, setAmbito] = React.useState("seguidos");
  const [refresco, setRefresco] = React.useState(0);
  const [tend, setTend] = React.useState<Tendencias | null | "error">(null);

  React.useEffect(() => {
    let cancelado = false;
    api<Tendencias>("/api/comunidad/tendencias").then((r) => !cancelado && setTend(r)).catch(() => !cancelado && setTend("error"));
    return () => { cancelado = true; };
  }, [refresco]);

  const destacadas = React.useMemo(() => new Set(tend && tend !== "error" ? tend.publicaciones.slice(0, 3).filter((p) => p.meGusta + p.comentarios > 0).map((p) => p.id) : []), [tend]);
  const grupoActivo = ambito.startsWith("grupo:") ? grupos.find((g) => `grupo:${g.slug}` === ambito) : undefined;
  const temaActivo = ambito.startsWith("tema:") ? ambito.slice(5) : undefined;

  const aInicio = (nuevo: string) => { setAmbito(nuevo); setVista("inicio"); window.scrollTo({ top: 0 }); };
  const elegirGrupo = (slug: string) => aInicio(`grupo:${slug}`);
  const elegirTema = (t: Tema) => aInicio(`tema:${t.palabra}`);
  const elegirEtiqueta = (etiqueta: string) => aInicio(`tema:${etiqueta.toLowerCase()}`);
  const ir = (v: Vista, s?: Subred) => { setVista(v); if (s) setSubred(s); window.scrollTo({ top: 0 }); };

  const nav: { id: string; texto: string; icono: typeof Home; activo: boolean; ir: () => void }[] = [
    { id: "inicio", texto: "Inicio", icono: Home, activo: vista === "inicio", ir: () => ir("inicio") },
    { id: "tendencias", texto: "Tendencias", icono: Flame, activo: vista === "tendencias", ir: () => ir("tendencias") },
    { id: "red", texto: "Mi red", icono: Sparkles, activo: vista === "red" && subred === "personas", ir: () => ir("red", "personas") },
    { id: "grupos", texto: "Grupos", icono: Users, activo: vista === "red" && subred === "grupos", ir: () => ir("red", "grupos") },
  ];

  const opcionesMuro = [{ id: "seguidos", t: "Para ti" }, { id: "todos", t: "Toda la comunidad" }, ...grupos.map((g) => ({ id: `grupo:${g.slug}`, t: g.nombre }))];

  return (
    <div className="pb-24 lg:pb-10">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className={`${CONTENEDOR} ${PADDING} flex items-center gap-3 py-2.5`}>
          <Link href="/" className="flex items-center gap-2"><Image src="/logo-mark.png" alt="Fundación Escuela Libertad" width={34} height={34} /><span className="hidden font-display text-lg font-semibold sm:inline">Comunidad</span></Link>
          <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Secciones">
            {nav.map((n) => (
              <button key={n.id} type="button" onClick={n.ir} aria-current={n.activo ? "page" : undefined} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${n.activo ? "bg-brand-soft font-semibold text-brand" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}><n.icono className="size-4" />{n.texto}</button>
            ))}
          </nav>
          <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground lg:ml-0 lg:inline-flex"><Users className="size-3.5" />{afiliados.toLocaleString("es-CO")} afiliado{afiliados === 1 ? "" : "s"}</span>
          <Link href={`/comunidad/miembro/${yo.usuario}`} aria-label="Mi perfil" className="ml-auto lg:ml-0"><Avatar autor={yo} tam="size-9" /></Link>
        </div>
      </header>

      <div className={`${CONTENEDOR} ${PADDING} mt-5 grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_20rem] 2xl:grid-cols-[20rem_minmax(0,1fr)_24rem]`}>
        <div className={`${vista === "perfil" ? "block" : "hidden"} space-y-4 lg:col-start-1 lg:row-start-1 lg:block xl:contents`}>
          <aside className="space-y-4 xl:col-start-1 xl:row-start-1 xl:sticky xl:top-[4.75rem] xl:max-h-[calc(100dvh-5.75rem)] xl:self-start xl:overflow-y-auto xl:pb-2">
            <TarjetaPerfil yo={yo} seguidores={seguidores} siguiendo={siguiendo} />
            <div className="hidden lg:block"><TarjetaGrupos grupos={grupos} activo={ambito} elegir={elegirGrupo} /></div>
          </aside>
          <aside className="hidden space-y-4 lg:block xl:col-start-3 xl:row-start-1 xl:sticky xl:top-[4.75rem] xl:max-h-[calc(100dvh-5.75rem)] xl:self-start xl:overflow-y-auto xl:pb-2">
            <TarjetaTendencias tend={tend} elegirTema={elegirTema} verTodas={() => ir("tendencias")} />
            <TarjetaSugerencias lista={sugerencias} verMas={() => ir("red", "personas")} />
            <TarjetaFundacion />
          </aside>
        </div>

        <main className={`min-w-0 ${vista === "perfil" ? "hidden lg:block" : ""} lg:col-start-2 lg:row-start-1`}>
          <div className={`space-y-4 ${vista === "inicio" || vista === "perfil" ? "" : "hidden"}`}>
            <Publicador key={grupoActivo?.slug ?? "general"} yo={yo} grupos={grupos} grupoInicial={grupoActivo?.slug} alPublicar={() => setRefresco((n) => n + 1)} />
            <div className="sticky top-[3.7rem] z-20 -mx-1 bg-surface-muted/90 px-1 py-2 backdrop-blur">
              <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Qué ver">
                {opcionesMuro.map((o) => (
                  <button key={o.id} type="button" role="tab" aria-selected={ambito === o.id} onClick={() => setAmbito(o.id)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${ambito === o.id ? "bg-brand text-brand-foreground" : "bg-surface text-muted-foreground ring-1 ring-border hover:text-foreground"}`}>{o.t}</button>
                ))}
                {temaActivo && <button type="button" role="tab" aria-selected onClick={() => setAmbito("seguidos")} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-[#1c1405]"><Flame className="size-3.5" />{temaActivo.startsWith("#") ? temaActivo : temaActivo.charAt(0).toUpperCase() + temaActivo.slice(1)}<X className="size-3.5" aria-label="Quitar el filtro" /></button>}
              </div>
            </div>
            {grupoActivo && (
              <div className={`${tarjeta} flex items-center gap-3 p-4`}>
                <IconoGrupo />
                <div className="min-w-0 flex-1 leading-tight"><p className="truncate font-semibold">{grupoActivo.nombre}</p><p className="text-xs text-muted-foreground">{grupoActivo.tipo === "barrio" ? "Tu barrio" : "Tu ciudad"} · {grupoActivo.miembros} afiliado{grupoActivo.miembros === 1 ? "" : "s"} · lo que publiques aquí lo ve el grupo</p></div>
                <button type="button" onClick={() => setAmbito("seguidos")} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border hover:text-foreground">Ver todo</button>
              </div>
            )}
            {temaActivo && <p className="text-sm text-muted-foreground">Publicaciones que mencionan <b className="text-foreground">{temaActivo}</b>.</p>}
            <Muro key={ambito} ambito={ambito} refresco={refresco} destacadas={destacadas} alTema={elegirEtiqueta} />
          </div>
          {vista === "tendencias" && <VistaTendencias tend={tend} elegirTema={elegirTema} elegirGrupo={elegirGrupo} elegirEtiqueta={elegirEtiqueta} destacadas={destacadas} />}
          {vista === "red" && <VistaRed yo={yo} lista={sugerencias} grupos={grupos} sub={subred} setSub={setSubred} elegirGrupo={elegirGrupo} />}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navegación">
        <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
          {[nav[0], nav[1], null, nav[2], { id: "perfil", texto: "Perfil", icono: User, activo: vista === "perfil", ir: () => ir("perfil") }].map((p, i) => p ? (
            <li key={p.id}><button type="button" onClick={p.ir} aria-current={p.activo} className={`flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${p.activo ? "text-brand" : "text-muted-foreground"}`}><p.icono className="size-6" />{p.texto}</button></li>
          ) : (
            <li key={i} className="grid place-items-center pb-2"><button type="button" onClick={() => { ir("inicio"); setTimeout(() => document.querySelector("textarea")?.focus(), 80); }} aria-label="Publicar" className="-mt-6 grid size-14 place-items-center rounded-full bg-gradient-to-br from-[#0a4f37] to-[#14825c] text-white shadow-lg shadow-emerald-900/30 ring-4 ring-surface"><PenSquare className="size-6" /></button></li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
