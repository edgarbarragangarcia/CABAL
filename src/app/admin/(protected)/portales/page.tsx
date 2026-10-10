import { LayoutTemplate } from "lucide-react";

import { PortalesPanel } from "./portales-panel";

/** Portales temáticos: un producto aparte de la comunidad del partido (tiene su propio menú, su propia tabla y sus propias rutas /p/…). */
export default function PortalesAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><LayoutTemplate className="size-6 text-brand" /> Portales</h1>
        <p className="mt-1 text-sm text-muted-foreground">Genera, controla y despliega portales temáticos a partir de plantillas: salud, belleza, motos y carros, y cuidado en el hogar.</p>
      </div>
      <PortalesPanel />
    </div>
  );
}
