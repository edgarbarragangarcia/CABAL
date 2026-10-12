"use client";

import * as React from "react";
import { ArrowLeft, BarChart3, CalendarDays, ExternalLink, FileText, Loader2, Megaphone, Pencil, Rocket, Settings2, Users } from "lucide-react";

import { plantillaPorId } from "@/lib/portales/plantillas";
import { ajustesPorDefecto, type AjustesPortal, type ResumenPortal } from "@/lib/portales/cms/tipos";
import { tematicaDe } from "@/lib/portales/cms/tematicas";
import type { EstadoPortal, Portal } from "@/lib/portales/store";
import { AjustesPanel } from "./ajustes-panel";
import { ArticulosPanel } from "./articulos-panel";
import { botonSecundario, mensajeDe, pedir } from "./comun";
import { CrmPanel } from "./crm-panel";
import { EventosPanel } from "./eventos-panel";
import { PublicidadPanel } from "./publicidad-panel";
import { ResumenPanel } from "./resumen-panel";

/**
 * El CMS de un portal: cada uno es independiente (sus artículos, sus anuncios, sus ajustes) y distinto según su temática, pero
 * todos viven en las mismas tablas de la misma base de datos. Se abre desde el centro de operaciones.
 */

type Pestana = "resumen" | "comunidad" | "eventos" | "articulos" | "publicidad" | "ajustes";

const ETIQUETA_ESTADO: Record<EstadoPortal, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "bg-surface-muted text-muted-foreground" },
  publicado: { texto: "En línea", clase: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  pausado: { texto: "En pausa", clase: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
};

export function PortalCms({ portal, resumen, volver, editarDiseno, desplegar, cambio }: { portal: Portal; resumen: ResumenPortal; volver: () => void; editarDiseno: () => void; desplegar: () => void; cambio: () => void }) {
  const [pestana, setPestana] = React.useState<Pestana>("resumen");
  const [iaAlAbrir, setIaAlAbrir] = React.useState(false);
  const [ajustes, setAjustes] = React.useState<AjustesPortal | null>(null);
  const [error, setError] = React.useState("");
  const e = ETIQUETA_ESTADO[portal.estado];
  const pl = plantillaPorId(portal.plantilla)!;
  const tematica = tematicaDe(portal.plantilla);

  React.useEffect(() => {
    let cancelado = false;
    pedir<{ ajustes: AjustesPortal }>(`/api/admin/portales/${portal.id}/ajustes`, "GET")
      .then((r) => { if (!cancelado) setAjustes(r.ajustes); })
      .catch((err) => { if (!cancelado) { setError(mensajeDe(err, "No se pudieron leer los ajustes del portal.")); setAjustes(ajustesPorDefecto()); } });
    return () => { cancelado = true; };
  }, [portal.id]);

  const pestanas: { id: Pestana; texto: string; icono: typeof BarChart3; n?: number }[] = [
    { id: "resumen", texto: "Resumen", icono: BarChart3 },
    { id: "comunidad", texto: "Comunidad", icono: Users },
    { id: "eventos", texto: "Eventos", icono: CalendarDays },
    { id: "articulos", texto: tematica.seccion.nombre, icono: FileText, n: resumen.publicados },
    { id: "publicidad", texto: "Publicidad", icono: Megaphone, n: resumen.anunciosActivos },
    { id: "ajustes", texto: "Ajustes", icono: Settings2 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={volver} className={botonSecundario}><ArrowLeft className="size-4" /> Centro de operaciones</button>
        <span className="size-3 rounded-full" style={{ background: portal.config.colorPrimario }} />
        <div className="min-w-0">
          <h2 className="truncate font-display text-xl leading-tight font-semibold">{portal.nombre}</h2>
          <p className="text-xs text-muted-foreground">{pl.nombre} · {portal.config.ciudad || "sin ciudad"} · /p/{portal.slug}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${e.clase}`}>{e.texto}{portal.version > 0 ? ` · v${portal.version}` : ""}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={editarDiseno} className={botonSecundario}><Pencil className="size-4" /> Editar diseño</button>
          <button type="button" onClick={desplegar} className={botonSecundario}><Rocket className="size-4" /> {portal.version > 0 ? "Volver a desplegar" : "Desplegar"}</button>
          {portal.estado === "publicado" && <a href={`/p/${portal.slug}`} target="_blank" rel="noreferrer noopener" className={botonSecundario}>Ver el portal <ExternalLink className="size-4" /></a>}
        </div>
      </div>

      <div role="tablist" aria-label="CMS del portal" className="flex gap-1 overflow-x-auto border-b border-border">
        {pestanas.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} onClick={() => { setIaAlAbrir(false); setPestana(p.id); }} className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors ${pestana === p.id ? "border-brand font-semibold text-brand" : "border-transparent font-medium text-muted-foreground hover:text-foreground"}`}>
            <p.icono className="size-4" />{p.texto}{p.n !== undefined && p.n > 0 && <span className="rounded-full bg-surface-muted px-1.5 text-[11px] text-foreground">{p.n}</span>}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
      {!ajustes ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Abriendo el portal…</p>
      ) : (
        <>
          {pestana === "resumen" && <ResumenPanel portal={portal} resumen={resumen} ajustes={ajustes} desplegar={desplegar} ir={(t, ia) => { setIaAlAbrir(!!ia); setPestana(t); }} />}
          {pestana === "comunidad" && <CrmPanel portal={portal} />}
          {pestana === "eventos" && <EventosPanel portal={portal} />}
          {pestana === "articulos" && <ArticulosPanel key={String(iaAlAbrir)} portal={portal} ajustes={ajustes} cambio={cambio} abrirIa={iaAlAbrir} />}
          {pestana === "publicidad" && <PublicidadPanel portal={portal} ajustes={ajustes} cambio={cambio} />}
          {pestana === "ajustes" && <AjustesPanel portal={portal} ajustes={ajustes} guardado={setAjustes} />}
        </>
      )}
    </div>
  );
}
