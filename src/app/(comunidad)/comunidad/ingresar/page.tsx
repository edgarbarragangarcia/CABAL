import { redirect } from "next/navigation";

import { miembroIdActual } from "@/lib/comunidad/sesion";
import { FormIngreso } from "./form-ingreso";

export const dynamic = "force-dynamic";

export default async function IngresarPage() {
  if (await miembroIdActual()) redirect("/comunidad");
  return <FormIngreso />;
}
