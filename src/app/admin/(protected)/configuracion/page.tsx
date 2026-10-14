import { Settings, SlidersHorizontal } from "lucide-react";

import { Lienzo, Portada } from "@/components/admin/estilo-cabal";

import { ConfiguracionIA } from "./configuracion-ia";
import { ConfiguracionRedes } from "./configuracion-redes";
import { InformeSemanal } from "./informe-semanal";
import { UsuariosPanel } from "./usuarios-panel";

export default function ConfiguracionPage() {
  return (
    <div className="w-full">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Settings className="size-5 text-brand" aria-hidden="true" />
        Configuración
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Modelo de inteligencia artificial de los análisis y el informe semanal.</p>
      <Lienzo className="mt-6">
        <Portada icono={SlidersHorizontal} etiqueta="Ajustes del panel" titulo="Inteligencia artificial, redes e informe" descripcion="El modelo que usan los análisis y el asistente, las claves de las redes sociales y el informe que llega cada semana." />
        <div className="mx-auto w-full max-w-3xl">
          <ConfiguracionIA />
          <ConfiguracionRedes />
          <UsuariosPanel />
          <InformeSemanal />
        </div>
      </Lienzo>
    </div>
  );
}
