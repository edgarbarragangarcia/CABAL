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
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      <Link href="/comunidad" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Volver a la comunidad</Link>
      <section className={`${tarjeta} overflow-hidden`}>
        <div className="h-24 bg-gradient-to-r from-[#0a4f37] via-[#0f6b4c] to-[#b3893c]" />
        <div className="-mt-12 px-5 pb-5">
          <div className="flex items-end justify-between"><Avatar autor={p} tam="size-24 text-3xl ring-4 ring-surface" />{p.id !== yo && <BotonSeguir miembroId={p.id} inicial={p.yoSigo} />}</div>
          <h1 className="mt-3 text-xl font-semibold">{p.nombre}</h1>
          <p className="text-sm text-muted-foreground">@{p.usuario}{p.esOficial ? " · Cuenta oficial" : ""}</p>
          {!p.esOficial && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" /> {p.barrio} · {p.municipio}</p>}
          {p.bio && <p className="mt-3 text-[15px]">{p.bio}</p>}
          <p className="mt-3 text-sm"><b>{p.seguidores}</b> seguidores · <b>{p.siguiendo}</b> siguiendo</p>
        </div>
      </section>
      <MuroPerfil usuario={p.usuario} />
    </div>
  );
}
