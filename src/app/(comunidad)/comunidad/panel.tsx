"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, LogOut, MapPin, PenSquare, Sparkles, User, Users } from "lucide-react";

import type { Autor, Grupo, Miembro } from "@/lib/comunidad/store";
import { Avatar, BotonSeguir, Muro, Nombre, Publicador, api, tarjeta } from "./ui";

type Vista = "inicio" | "red" | "grupos" | "perfil";

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
      <div className="h-20 bg-gradient-to-r from-[#0a4f37] via-[#0f6b4c] to-[#b3893c]" />
      <div className="-mt-10 px-4 pb-4">
        <Avatar autor={yo} tam="size-20 text-2xl ring-4 ring-surface" />
        <h2 className="mt-2 text-lg leading-tight font-semibold">{yo.nombre}</h2>
        <p className="text-sm text-muted-foreground">@{yo.usuario}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3.5" /> {yo.barrio} · {yo.municipio}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-surface-muted py-2"><dd className="text-lg font-bold">{seguidores}</dd><dt className="text-[11px] text-muted-foreground">Seguidores</dt></div>
          <div className="rounded-xl bg-surface-muted py-2"><dd className="text-lg font-bold">{siguiendo}</dd><dt className="text-[11px] text-muted-foreground">Siguiendo</dt></div>
        </dl>
        {editando ? (
          <div className="mt-3 space-y-2">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={3} className="w-full rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-brand" placeholder="Cuéntale a la comunidad quién eres" />
            <div className="flex gap-2"><button type="button" onClick={guardar} className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-brand-foreground">Guardar</button><button type="button" onClick={() => { setBio(guardado); setEditando(false); }} className="rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground">Cancelar</button></div>
          </div>
        ) : (
          <button type="button" onClick={() => setEditando(true)} className="mt-3 block w-full text-left text-sm text-muted-foreground hover:text-foreground">{guardado || "Agrega una biografía…"}</button>
        )}
        <button type="button" onClick={salir} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"><LogOut className="size-3.5" /> Cerrar sesión</button>
      </div>
    </section>
  );
}

function TarjetaSugerencias({ lista }: { lista: Autor[] }) {
  return (
    <section className={`${tarjeta} p-4`}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-amber-500" /> A quién seguir</h3>
      {lista.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Cuando se afilien más personas de tu zona aparecerán aquí.</p> : (
        <ul className="mt-3 space-y-3">
          {lista.map((a) => (
            <li key={a.id} className="flex items-center gap-3">
              <Avatar autor={a} tam="size-10" />
              <div className="min-w-0 flex-1 text-sm leading-tight"><Nombre autor={a} /><p className="truncate text-xs text-muted-foreground">{a.barrio} · {a.municipio}</p></div>
              <BotonSeguir miembroId={a.id} inicial={false} compacto />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TarjetaGrupos({ grupos, activo, elegir }: { grupos: Grupo[]; activo: string; elegir: (slug: string) => void }) {
  return (
    <section className={`${tarjeta} p-4`}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Users className="size-4 text-brand" /> Mis grupos</h3>
      <ul className="mt-3 space-y-2">
        {grupos.map((g) => (
          <li key={g.id}>
            <button type="button" onClick={() => elegir(g.slug)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${activo === `grupo:${g.slug}` ? "bg-brand-soft" : "hover:bg-surface-muted"}`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white"><MapPin className="size-4" /></span>
              <span className="min-w-0 flex-1 text-sm leading-tight"><span className="block truncate font-semibold">{g.nombre}</span><span className="text-xs text-muted-foreground">{g.tipo === "barrio" ? "Tu barrio" : "Tu ciudad"} · {g.miembros} afiliado{g.miembros === 1 ? "" : "s"}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PanelComunidad({ yo, seguidores, siguiendo, grupos, sugerencias }: { yo: Miembro; seguidores: number; siguiendo: number; grupos: Grupo[]; sugerencias: Autor[] }) {
  const [vista, setVista] = React.useState<Vista>("inicio");
  const [ambito, setAmbito] = React.useState("seguidos");
  const [refresco, setRefresco] = React.useState(0);
  const grupoActivo = ambito.startsWith("grupo:") ? grupos.find((g) => `grupo:${g.slug}` === ambito) : undefined;
  const elegirGrupo = (slug: string) => { setAmbito(`grupo:${slug}`); setVista("inicio"); window.scrollTo({ top: 0 }); };

  const pestanas: { id: Vista; texto: string; icono: typeof Home }[] = [
    { id: "inicio", texto: "Inicio", icono: Home },
    { id: "red", texto: "Mi red", icono: Sparkles },
    { id: "grupos", texto: "Grupos", icono: Users },
    { id: "perfil", texto: "Perfil", icono: User },
  ];

  return (
    <div className="pb-24 lg:pb-8">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2"><Image src="/logo-mark.png" alt="Fundación Escuela Libertad" width={34} height={34} /><span className="hidden font-display text-lg font-semibold sm:inline">Comunidad</span></Link>
          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Secciones">
            {pestanas.slice(0, 3).map((p) => <a key={p.id} href="#" onClick={(e) => { e.preventDefault(); setVista(p.id); }} className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted">{p.texto}</a>)}
          </nav>
          <Link href={`/comunidad/miembro/${yo.usuario}`} className="ml-auto lg:ml-3"><Avatar autor={yo} tam="size-9" /></Link>
        </div>
      </header>

      <div className="mx-auto mt-4 grid max-w-6xl gap-4 px-4 lg:grid-cols-[17rem_minmax(0,1fr)_20rem]">
        <aside className={`${vista === "perfil" ? "block" : "hidden"} space-y-4 lg:block`}><TarjetaPerfil yo={yo} seguidores={seguidores} siguiendo={siguiendo} /></aside>

        <main className={`${vista === "inicio" ? "block" : "hidden"} min-w-0 space-y-3 lg:block`}>
          <Publicador grupos={grupos} grupoInicial={grupoActivo?.slug} alPublicar={() => setRefresco((n) => n + 1)} />
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Qué ver">
            {[{ id: "seguidos", t: "Para ti" }, { id: "todos", t: "Toda la comunidad" }, ...grupos.map((g) => ({ id: `grupo:${g.slug}`, t: g.nombre }))].map((o) => (
              <button key={o.id} type="button" role="tab" aria-selected={ambito === o.id} onClick={() => setAmbito(o.id)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${ambito === o.id ? "bg-brand text-brand-foreground" : "bg-surface text-muted-foreground ring-1 ring-border"}`}>{o.t}</button>
            ))}
          </div>
          <Muro key={ambito} ambito={ambito} refresco={refresco} />
        </main>

        <aside className={`${vista === "red" || vista === "grupos" ? "block" : "hidden"} space-y-4 lg:block`}>
          <div className={vista === "grupos" ? "hidden lg:block" : ""}><TarjetaSugerencias lista={sugerencias} /></div>
          <div className={vista === "red" ? "hidden lg:block" : ""}><TarjetaGrupos grupos={grupos} activo={ambito} elegir={elegirGrupo} /></div>
        </aside>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navegación">
        <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
          {[pestanas[0], pestanas[1], null, pestanas[2], pestanas[3]].map((p, i) => p ? (
            <li key={p.id}><button type="button" onClick={() => setVista(p.id)} aria-current={vista === p.id} className={`flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${vista === p.id ? "text-brand" : "text-muted-foreground"}`}><p.icono className="size-6" />{p.texto}</button></li>
          ) : (
            <li key={i} className="grid place-items-center pb-2"><button type="button" onClick={() => { setVista("inicio"); window.scrollTo({ top: 0 }); document.querySelector("textarea")?.focus(); }} aria-label="Publicar" className="-mt-6 grid size-14 place-items-center rounded-full bg-gradient-to-br from-[#0a4f37] to-[#14825c] text-white shadow-lg shadow-emerald-900/30 ring-4 ring-surface"><PenSquare className="size-6" /></button></li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
