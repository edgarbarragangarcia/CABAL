import { Settings } from "lucide-react";

import { ConfiguracionIA } from "./configuracion-ia";

export default function ConfiguracionPage() {
  return (
    <div className="w-full max-w-3xl">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Settings className="size-5 text-brand" aria-hidden="true" />
        Configuración
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Modelo de inteligencia artificial que usan los análisis del panel.</p>
      <ConfiguracionIA />
    </div>
  );
}
