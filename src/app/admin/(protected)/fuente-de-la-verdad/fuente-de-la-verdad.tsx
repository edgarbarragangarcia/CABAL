"use client";

import * as React from "react";
import { Library, Network } from "lucide-react";

import { ChipPortada, Lienzo, Portada } from "@/components/admin/estilo-cabal";

import { DatosTab } from "../analisis-publicaciones/datos-tab";
import { DocumentosTab, type FuenteDatos } from "../analisis-publicaciones/documentos-tab";
import { usePeticion } from "../analisis-publicaciones/peticion";
import { MapaDatos } from "./mapa-datos";
import { FuentesTerritorio } from "../analisis-publicaciones/territorio-fuentes";
import { MonitoreoFuente } from "./monitoreo-fuente";

const OPCIONES = [
  { id: "biblioteca", label: "Documentos y datos", icon: Library },
  { id: "mapa", label: "Mapa de datos", icon: Network },
] as const;

type EstadoCargaRespuesta = { carga?: { carga?: { enMarcha?: boolean; ultimoLoteEn?: string | null; fin?: string; pendientes?: number | null } | null } };

/**
 * El gestor reúne lo que alimenta al panel: los documentos que se suben y las fuentes de datos (hoy, los resultados electorales),
 * que se ven en la misma lista y en el mismo menú, como un documento más. Ambas pestañas quedan montadas una vez abiertas: tienen
 * cargas en curso que no deben cortarse al cambiar de pestaña.
 */
export function FuenteDeLaVerdad() {
  const [tab, setTab] = React.useState<(typeof OPCIONES)[number]["id"]>("biblioteca");
  const [abiertas, setAbiertas] = React.useState<ReadonlySet<string>>(new Set(["biblioteca"]));
  const ir = (id: typeof tab) => {
    setTab(id);
    setAbiertas((a) => new Set(a).add(id));
  };

  // Un resumen liviano de los datos electorales para mostrarlos en la lista (el panel completo se abre al elegir la fuente).
  const total = usePeticion<{ filas: number | null }>("/api/admin/gestor/mapa?solo=electoral");
  const carga = usePeticion<EstadoCargaRespuesta>("/api/admin/elecciones/almacen?solo=carga");
  const filas = total.estado === "listo" ? total.data.filas : null;
  const c = carga.estado === "listo" ? carga.data.carga?.carga : null;
  const enMarcha = !!c?.enMarcha;
  const mon = usePeticion<{ disponible: boolean; total: number; ultimaActualizacion: string | null }>("/api/admin/monitoreo/archivo");
  const m = mon.estado === "listo" ? mon.data : null;
  const terr = usePeticion<{ filas: number | null; actualizado: string | null }>("/api/admin/gestor/mapa?solo=territorio");
  const t = terr.estado === "listo" ? terr.data : null;
  const [vTerr, setVTerr] = React.useState(0);
  const fuentes: FuenteDatos[] = [
    {
      id: "electoral",
      nombre: "Datos electorales",
      detalle: "Resultados de todas las elecciones y cargos, de donde se alimentan Votaciones y Territorio",
      resumen: filas === null ? "—" : `${filas.toLocaleString("es-CO")} filas`,
      estado: enMarcha ? "Cargando" : filas === 0 ? "Sin cargar" : c?.fin === "error" || c?.fin === "pausa" ? "Pausada" : "Listo",
      tono: enMarcha ? "curso" : filas === 0 || c?.fin === "error" || c?.fin === "pausa" ? "pendiente" : "ok",
      fecha: c?.ultimoLoteEn ?? null,
      contenido: <DatosTab />,
    },
    {
      id: "monitoreo",
      nombre: "Monitoreo",
      detalle: "Menciones de María Fernanda en prensa, redes y YouTube del último mes, con su tono y sus cifras",
      resumen: m ? `${m.total.toLocaleString("es-CO")} menciones` : "—",
      estado: !m ? "Leyendo" : !m.disponible ? "Falta SQL" : m.total === 0 ? "Sin cargar" : "Listo",
      tono: m && m.disponible && m.total > 0 ? "ok" : "pendiente",
      fecha: m?.ultimaActualizacion ?? null,
      contenido: <MonitoreoFuente />,
    },
    {
      id: "territorio",
      nombre: "Territorio · DANE y datos abiertos",
      detalle: "Víctimas, homicidios, masacres, coca, PDET y demás indicadores oficiales por municipio, para cruzar con los resultados",
      resumen: t?.filas == null ? "—" : `${t.filas.toLocaleString("es-CO")} filas`,
      estado: t?.filas == null ? "Falta SQL" : t.filas === 0 ? "Sin cargar" : "Listo",
      tono: t?.filas ? "ok" : "pendiente",
      fecha: t?.actualizado ?? null,
      contenido: <FuentesTerritorio key={vTerr} alCargar={() => setVTerr((n) => n + 1)} />,
    },
  ];

  return (
    <div className="mt-6">
      <div className="flex gap-1 border-b border-border">
        {OPCIONES.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => ir(o.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm ${tab === o.id ? "border-brand font-semibold text-brand" : "border-transparent font-medium text-muted-foreground hover:text-foreground"}`}
          >
            <o.icon className="size-4" aria-hidden="true" />
            {o.label}
          </button>
        ))}
      </div>
      <Lienzo className="mt-6">
        {tab === "biblioteca" ? (
          <Portada icono={Library} etiqueta="Gestor documental" titulo="Documentos y fuentes de datos" descripcion="Los documentos de la Fundación y los datos electorales y el monitoreo en un solo lugar: carpetas, versiones, papelera e historial, búsqueda por significado y preguntas con citas.">
            <ChipPortada icono={Library}>Los datos electorales y el monitoreo son fuentes más: ábrela desde la lista o el menú</ChipPortada>
          </Portada>
        ) : (
          <Portada icono={Network} etiqueta="Mapa de datos" titulo="Lo que hay en Supabase" descripcion="Cada módulo del panel y lo que tiene dentro: documentos, portales, elecciones, comunidad… y qué falta por crear.">
            <ChipPortada icono={Network}>Toca un módulo o un punto para ver qué contiene</ChipPortada>
          </Portada>
        )}
        {abiertas.has("biblioteca") && <div hidden={tab !== "biblioteca"}><DocumentosTab fuentes={fuentes} /></div>}
        {abiertas.has("mapa") && <div hidden={tab !== "mapa"}><MapaDatos /></div>}
      </Lienzo>
    </div>
  );
}
