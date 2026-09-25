import { Vote } from "lucide-react";

import { AnalisisTabs } from "./analisis-tabs";

/**
 * Página de análisis del admin: combina datos ELECTORALES reales
 * (Registraduría) con la red de relaciones de los contactos del CRM
 * (Bitrix24) y un asistente.
 *
 * Los datos electorales (solo María Fernanda Cabal) y los contactos del
 * CRM los pide el cliente bajo demanda al abrir cada pestaña.
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
              Datos electorales oficiales y la red de relaciones de tus contactos del CRM, en un solo
              lugar para cruzar información y decidir.
            </p>
          </>
        }
      />
    </div>
  );
}
