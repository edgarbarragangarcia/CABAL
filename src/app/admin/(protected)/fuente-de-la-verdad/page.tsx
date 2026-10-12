import { Library } from "lucide-react";

import { FuenteDeLaVerdad } from "./fuente-de-la-verdad";

export const metadata = { title: "Gestor documental" };

/** Lo que alimenta todo el panel: los datos electorales guardados y los documentos de la Fundación. */
export default function FuenteDeLaVerdadPage() {
  return (
    <div className="w-full">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Library className="size-5 text-brand" aria-hidden="true" />
        Gestor documental
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Los documentos de la Fundación y los datos electorales guardados en Supabase: de aquí se alimenta el resto del panel.</p>
      <FuenteDeLaVerdad />
    </div>
  );
}
