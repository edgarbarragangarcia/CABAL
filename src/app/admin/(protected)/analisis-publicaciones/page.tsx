import { Vote } from "lucide-react";

import { AnalisisTabs } from "./analisis-tabs";

/**
 * Página de análisis del admin: combina datos ELECTORALES reales
 * (Registraduría) con el análisis de publicaciones en redes (MVP, datos
 * simulados) y un simulador de escenarios.
 *
 * Los datos electorales (solo María Fernanda Cabal) los pide el cliente
 * bajo demanda al abrir la pestaña Votaciones.
 */
export default function AnalisisPublicacionesPage() {
  return (
    <div className="w-full">
      <AnalisisTabs
        header={
          <>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Vote className="size-5 text-brand" aria-hidden="true" />
              Análisis
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Datos electorales oficiales y simulación de escenarios, en un solo lugar para cruzar
              información y decidir.
            </p>
          </>
        }
      />
    </div>
  );
}
