"use client";

import * as React from "react";
import {
  ArrowLeft, BarChart3, CalendarDays, Copy, ExternalLink, FileText, Files, Images, LineChart, Loader2, Mail, Megaphone, Pencil, Rocket, Settings2, TriangleAlert, Users,
} from "lucide-react";

import { plantillaPorId } from "@/lib/portales/plantillas";
import { ajustesPorDefecto, type AjustesPortal, type ResumenPortal } from "@/lib/portales/cms/tipos";
import { tematicaDe } from "@/lib/portales/cms/tematicas";
import type { EstadoPortal, Portal } from "@/lib/portales/store";
import { AjustesPanel } from "./ajustes-panel";
import { AnaliticaPanel } from "./analitica-panel";
import { ArticulosPanel } from "./articulos-panel";
import { BoletinesPanel } from "./boletines-panel";
import { botonPrimario, botonSecundario, mensajeDe, pedir, tarjeta } from "./comun";
import { CrmPanel } from "./crm-panel";
import { EventosPanel } from "./eventos-panel";
import { MediosPanel } from "./medios-panel";
import { PaginasPanel } from "./paginas-panel";
import { PublicidadPanel } from "./publicidad-panel";
import { ResumenPanel } from "./resumen-panel";
import { Avisos, useAvisos } from "./toasts";

/**
 * El CMS de un portal: cada uno es independiente (sus artículos, su comunidad, sus eventos, sus anuncios, sus ajustes) y
 * distinto según su temática, pero todos viven en las mismas tablas de la misma base de datos. Se abre desde el centro de
 * operaciones. El menú de la izquierda agrupa el trabajo: panorama, contenido, comunidad, crecimiento y configuración.
 */

type Pestana = "resumen" | "analitica" | "articulos" | "paginas" | "medios" | "comunidad" | "eventos" | "boletines" | "publicidad" | "ajustes";
type Estado = { pro: boolean; correo: { listo: boolean; desde: string | null }; sql?: string; editorSql?: string } | null;

const ETIQUETA_ESTADO: Record<EstadoPortal, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "bg-surface-muted text-muted-foreground" },
  publicado: { texto: "En línea", clase: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  pausado: { texto: "En pausa", clase: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
};

const REQUIEREN_PRO: Pestana[] = ["paginas", "medios", "boletines"];

function ActivarCms({ estado, recargar }: { estado: NonNullable<Estado>; recargar: () => void }) {
  const [copiado, setCopiado] = React.useState(false);
  return (
    <div className={`${tarjeta} space-y-3 p-5`}>
      <p className="flex items-start gap-2 text-sm"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" /> Esta sección necesita el CMS avanzado (imágenes, páginas, boletines, historial y programación). Falta un paso en Supabase: ejecutar este SQL una sola vez; se puede repetir sin problema.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { void navigator.clipboard.writeText(estado.sql ?? ""); setCopiado(true); }} className={botonSecundario}><Copy className="size-4" /> {copiado ? "Copiado" : "Copiar el SQL"}</button>
        {estado.editorSql && <a href={estado.editorSql} target="_blank" rel="noreferrer noopener" className={botonSecundario}>Abrir el editor SQL de Supabase <ExternalLink className="size-4" /></a>}
        <button type="button" onClick={recargar} className={botonPrimario}>Ya lo ejecuté</button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-xl bg-surface-muted p-3 text-[11px]">{estado.sql}</pre>
    </div>
  );
}

export function PortalCms({ portal, resumen, volver, editarDiseno, desplegar, cambio }: { portal: Portal; resumen: ResumenPortal; volver: () => void; editarDiseno: () => void; desplegar: () => void; cambio: () => void }) {
  const [pestana, setPestana] = React.useState<Pestana>(() => {
    if (typeof window === "undefined") return "resumen";
    const h = window.location.hash.replace("#", "") as Pestana;
    return (["resumen", "analitica", "articulos", "paginas", "medios", "comunidad", "eventos", "boletines", "publicidad", "ajustes"] as Pestana[]).includes(h) ? h : "resumen";
  });
  const [iaAlAbrir, setIaAlAbrir] = React.useState(false);
  const [ajustes, setAjustes] = React.useState<AjustesPortal | null>(null);
  const [estado, setEstado] = React.useState<Estado>(null);
  const [revisar, setRevisar] = React.useState(0);
  const [error, setError] = React.useState("");
  const { avisos, avisar, cerrar } = useAvisos();
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

  React.useEffect(() => {
    let cancelado = false;
    pedir<NonNullable<Estado>>(`/api/admin/portales/${portal.id}/cms${revisar ? "?revisar=1" : ""}`, "GET")
      .then((r) => { if (!cancelado) setEstado(r); })
      .catch(() => { if (!cancelado) setEstado({ pro: false, correo: { listo: false, desde: null } }); });
    return () => { cancelado = true; };
  }, [portal.id, revisar]);

  const ir = React.useCallback((p: Pestana, ia = false) => {
    setIaAlAbrir(ia);
    setPestana(p);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `#${p}`);
  }, []);

  const grupos: { titulo: string; items: { id: Pestana; texto: string; icono: typeof BarChart3; n?: number }[] }[] = [
    { titulo: "Panorama", items: [{ id: "resumen", texto: "Resumen", icono: BarChart3 }, { id: "analitica", texto: "Analítica", icono: LineChart }] },
    { titulo: "Contenido", items: [{ id: "articulos", texto: tematica.seccion.nombre, icono: FileText, n: resumen.publicados }, { id: "paginas", texto: "Páginas", icono: Files }, { id: "medios", texto: "Medios", icono: Images }] },
    { titulo: "Comunidad", items: [{ id: "comunidad", texto: "Personas", icono: Users }, { id: "eventos", texto: "Eventos", icono: CalendarDays }, { id: "boletines", texto: "Boletines", icono: Mail }] },
    { titulo: "Crecimiento", items: [{ id: "publicidad", texto: "Publicidad", icono: Megaphone, n: resumen.anunciosActivos }] },
    { titulo: "Configuración", items: [{ id: "ajustes", texto: "Ajustes", icono: Settings2 }] },
  ];
  const pro = !!estado?.pro;

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

      {estado && !estado.pro && pestana !== "resumen" && !REQUIEREN_PRO.includes(pestana) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-amber-500/10 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-200">
          <TriangleAlert className="size-4 shrink-0" /> Faltan las funciones avanzadas del CMS (portadas, programación, historial, páginas, medios y boletines).
          <button type="button" onClick={() => ir("medios")} className="font-semibold underline">Activarlas</button>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Secciones del portal" className="lg:sticky lg:top-4 lg:self-start">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-5 lg:overflow-visible lg:pb-0">
            {grupos.map((g) => (
              <div key={g.titulo} className="flex shrink-0 items-center gap-1 lg:block">
                <p className="mb-1.5 hidden px-3 text-[11px] font-bold tracking-wider text-muted-foreground uppercase lg:block">{g.titulo}</p>
                <ul className="flex gap-1 lg:block lg:space-y-0.5">
                  {g.items.map((p) => (
                    <li key={p.id}>
                      <button type="button" aria-current={pestana === p.id ? "page" : undefined} onClick={() => ir(p.id)} className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${pestana === p.id ? "bg-brand-soft font-semibold text-brand" : "font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}>
                        <p.icono className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-left">{p.texto}</span>
                        {p.n !== undefined && p.n > 0 && <span className="rounded-full bg-surface-muted px-1.5 text-[11px] text-foreground">{p.n}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          {error && <p role="alert" className="mb-4 rounded-xl bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>}
          {!ajustes || !estado ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Abriendo el portal…</p>
          ) : REQUIEREN_PRO.includes(pestana) && !estado.pro ? (
            <ActivarCms estado={estado} recargar={() => setRevisar((n) => n + 1)} />
          ) : (
            <>
              {pestana === "resumen" && <ResumenPanel portal={portal} resumen={resumen} ajustes={ajustes} desplegar={desplegar} ir={(t, ia) => ir(t as Pestana, ia)} />}
              {pestana === "analitica" && <AnaliticaPanel portal={portal} />}
              {pestana === "articulos" && <ArticulosPanel key={String(iaAlAbrir)} portal={portal} ajustes={ajustes} cambio={cambio} abrirIa={iaAlAbrir} pro={pro} avisar={avisar} />}
              {pestana === "paginas" && <PaginasPanel portal={portal} avisar={avisar} />}
              {pestana === "medios" && <MediosPanel portal={portal} />}
              {pestana === "comunidad" && <CrmPanel portal={portal} />}
              {pestana === "eventos" && <EventosPanel portal={portal} />}
              {pestana === "boletines" && <BoletinesPanel portal={portal} avisar={avisar} />}
              {pestana === "publicidad" && <PublicidadPanel portal={portal} ajustes={ajustes} cambio={cambio} />}
              {pestana === "ajustes" && <AjustesPanel portal={portal} ajustes={ajustes} guardado={setAjustes} />}
            </>
          )}
        </div>
      </div>
      <Avisos avisos={avisos} cerrar={cerrar} />
    </div>
  );
}
