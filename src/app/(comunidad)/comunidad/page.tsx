import { redirect } from "next/navigation";

import { miembroIdActual } from "@/lib/comunidad/sesion";
import { comunidadConfigurada, misGrupos, miembroPorId, perfilDe, sugerencias } from "@/lib/comunidad/store";
import { PanelComunidad } from "./panel";

export const dynamic = "force-dynamic";

export default async function ComunidadPage() {
  if (!comunidadConfigurada())
    return <p className="mx-auto max-w-md p-10 text-center text-sm text-muted-foreground">La comunidad todavía no está conectada a su base de datos.</p>;
  const id = await miembroIdActual();
  const yo = id ? await miembroPorId(id).catch(() => null) : null;
  if (!yo) redirect("/comunidad/ingresar");
  const [perfil, grupos, sug] = await Promise.all([perfilDe(yo.usuario, yo.id), misGrupos(yo.id), sugerencias(yo)]);
  return <PanelComunidad yo={yo} seguidores={perfil?.seguidores ?? 0} siguiendo={perfil?.siguiendo ?? 0} grupos={grupos} sugerencias={sug} />;
}
