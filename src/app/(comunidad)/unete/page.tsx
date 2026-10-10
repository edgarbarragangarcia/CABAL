import { redirect } from "next/navigation";

import { miembroIdActual } from "@/lib/comunidad/sesion";
import { FormularioAfiliacion } from "./formulario";

export const dynamic = "force-dynamic";

export default async function UnetePage() {
  if (await miembroIdActual()) redirect("/comunidad");
  return <FormularioAfiliacion />;
}
