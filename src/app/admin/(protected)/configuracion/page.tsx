import { Settings } from "lucide-react";

import { Lienzo } from "@/components/admin/estilo-cabal";

import { ConfiguracionTabs } from "./configuracion-tabs";

export default function ConfiguracionPage() {
  return (
    <div className="w-full">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Settings className="size-5 text-brand" aria-hidden="true" />
        Configuración
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">La inteligencia artificial, la voz de la Dra., las redes, los usuarios y el informe semanal.</p>
      <Lienzo className="mt-4">
        <ConfiguracionTabs />
      </Lienzo>
    </div>
  );
}
