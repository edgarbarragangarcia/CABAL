import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";

import { miembroIdActual } from "@/lib/comunidad/sesion";
import { perfilDe } from "@/lib/comunidad/store";
import { Avatar, BotonSeguir, tarjeta } from "../../ui";
import { MuroPerfil } from "./muro-perfil";

export const dynamic = "force-dynamic";

export default async function PerfilPage({ params }: { params: Promise<{ usuario: string }> }) {
  const { usuario } = await params;
  const yo = await miembroIdActual();
  if (!yo) redirect("/comunidad/ingresar");
  const p = await perfilDe(usuario, yo);
  if (!p) notFound();
  return (
    <div className="min-h-dvh pb-10">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[2400px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8 2xl:px-12">
          <Link href="/" className="flex items-center gap-2"><Image src="/logo-mark.png" alt="Fundación Escuela Libertad" width={34} height={34} /><span className="hidden font-display text-lg font-semibold sm:inline">Comunidad</span></Link>
          <Link href="/comunidad" className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Volver a la comunidad</Link>
        </div>
      </header>

      <div className="mx-auto mt-5 grid w-full max-w-[2400px] gap-5 px-4 sm:px-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:px-8 2xl:px-12">
        <section className={`${tarjeta} overflow-hidden lg:sticky lg:top-[4.75rem] lg:self-start`}>
          <div className="relative h-28 bg-gradient-to-r from-[#0a4f37] via-[#0f6b4c] to-[#b3893c]"><div aria-hidden className="bg-grain absolute inset-0 opacity-20 mix-blend-overlay" /></div>
          <div className="-mt-12 px-5 pb-5">
            <div className="flex items-end justify-between"><Avatar autor={p} tam="size-24 text-3xl ring-4 ring-surface" />{p.id !== yo && <BotonSeguir miembroId={p.id} inicial={p.yoSigo} />}</div>
            <h1 className="mt-3 font-display text-2xl font-semibold">{p.nombre}</h1>
            <p className="text-sm text-muted-foreground">@{p.usuario}{p.esOficial ? " · Cuenta oficial" : ""}</p>
            {!p.esOficial && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" /> {p.barrio} · {p.municipio}</p>}
            {p.bio && <p className="mt-3 text-[15px]">{p.bio}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-surface-muted py-2.5"><dd className="text-xl font-bold">{p.seguidores}</dd><dt className="text-[11px] text-muted-foreground">Seguidores</dt></div>
              <div className="rounded-xl bg-surface-muted py-2.5"><dd className="text-xl font-bold">{p.siguiendo}</dd><dt className="text-[11px] text-muted-foreground">Siguiendo</dt></div>
            </dl>
          </div>
        </section>
        <div className="min-w-0 space-y-3">
          <h2 className="font-display text-xl font-semibold">Publicaciones de {p.nombre.split(" ")[0]}</h2>
          <MuroPerfil usuario={p.usuario} />
        </div>
      </div>
    </div>
  );
}
