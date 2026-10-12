import { LayoutTemplate } from "lucide-react";

import { ChipPortada, Lienzo, Portada } from "@/components/admin/estilo-cabal";

import { PortalesPanel } from "./portales-panel";

/**
 * Centro de operaciones de los portales temáticos (salud, belleza, motos y carros, cuidado en el hogar): cada uno es un CMS
 * independiente y todos comparten la misma base de datos. Es un producto aparte de la comunidad del partido (tiene su propio
 * menú, sus propias tablas y sus propias rutas /p/…), pero lleva gente a ella con el botón «Súmate».
 */
export default function PortalesAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><LayoutTemplate className="size-6 text-brand" /> Portales</h1>
        <p className="mt-1 text-sm text-muted-foreground">Desde aquí operas los portales de salud, belleza, motos y carros, y cuidado en el hogar: artículos con IA, publicidad y cuántas personas traen a la comunidad de María Fernanda Cabal.</p>
      </div>
      <Lienzo>
        <Portada icono={LayoutTemplate} etiqueta="Centro de operaciones" titulo="Portales de comunidad" descripcion="Cada portal es una comunidad con su propio CMS y su propio CRM: noticias, eventos, boletines y la gente que se suma.">
          <ChipPortada>Salud</ChipPortada>
          <ChipPortada>Belleza</ChipPortada>
          <ChipPortada>Motos y carros</ChipPortada>
          <ChipPortada>Cuidado en el hogar</ChipPortada>
        </Portada>
        <PortalesPanel />
      </Lienzo>
    </div>
  );
}
