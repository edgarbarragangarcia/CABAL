"use client";

import * as React from "react";
import { ArrowRight, Check, Circle, ExternalLink, Rocket, Sparkles, Users } from "lucide-react";

import type { AjustesPortal, ResumenPortal } from "@/lib/portales/cms/tipos";
import type { Portal } from "@/lib/portales/store";
import type { ResumenCrm } from "@/lib/portales/crm/tipos";
import { botonPrimario, botonSecundario, numero, pedir, tarjeta } from "./comun";

/** Resumen del portal: sus cifras, el camino de visita a afiliado y lo que falta para que esté listo. */

const porcentaje = (parte: number, total: number) => (total > 0 ? `${((parte / total) * 100).toFixed(1).replace(".", ",")} %` : "—");

function Cifra({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className={`${tarjeta} p-4`}>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{titulo}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>}
    </div>
  );
}

/** Cuántas personas hay en el CRM del portal (si todavía no se crearon las tablas, no muestra nada). */
function useCrm(portalId: string) {
  const [crm, setCrm] = React.useState<ResumenCrm | null>(null);
  React.useEffect(() => {
    let cancelado = false;
    pedir<{ disponible: boolean; resumen?: ResumenCrm }>(`/api/admin/portales/${portalId}/crm`, "GET")
      .then((r) => {
        if (!cancelado && r.disponible && r.resumen) setCrm(r.resumen);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [portalId]);
  return crm;
}

export function ResumenPanel({ portal, resumen, ajustes, ir, desplegar }: { portal: Portal; resumen: ResumenPortal; ajustes: AjustesPortal; ir: (t: "articulos" | "publicidad" | "ajustes" | "comunidad" | "eventos", ia?: boolean) => void; desplegar: () => void }) {
  const enLinea = portal.estado === "publicado";
  const crm = useCrm(portal.id);
  const pasos: { hecho: boolean; titulo: string; detalle: string; accion?: React.ReactNode }[] = [
    {
      hecho: enLinea,
      titulo: "El portal está en línea",
      detalle: enLinea ? `Se ve en /p/${portal.slug}.` : portal.estado === "pausado" ? "Está en pausa: reanúdalo desde el centro de operaciones." : "Todavía es un borrador: nadie lo ve hasta que lo despliegues.",
      accion: !enLinea && portal.estado === "borrador" ? <button type="button" onClick={desplegar} className={botonSecundario}><Rocket className="size-4" /> Desplegar</button> : undefined,
    },
    {
      hecho: resumen.publicados >= 3,
      titulo: "Tiene al menos tres artículos publicados",
      detalle: `${resumen.publicados} publicados · ${resumen.borradores} en borrador. Con tres o cuatro el portal ya se ve vivo.`,
      accion: <button type="button" onClick={() => ir("articulos", true)} className={botonSecundario}><Sparkles className="size-4" /> Escribir con IA</button>,
    },
    {
      hecho: !!crm && crm.total > 0,
      titulo: "Ya hay personas en la comunidad del portal",
      detalle: crm ? (crm.total > 0 ? `${numero(crm.total)} personas, ${numero(crm.nuevos30d)} nuevas en 30 días.` : "Aún nadie se ha sumado: comparte el portal o invita a las primeras personas.") : "Para ver el CRM, ejecuta supabase/portales-crm.sql en Supabase.",
      accion: <button type="button" onClick={() => ir("comunidad")} className={botonSecundario}><Users className="size-4" /> Abrir el CRM</button>,
    },
    {
      hecho: ajustes.buscadores,
      titulo: "Los buscadores pueden mostrarlo",
      detalle: ajustes.buscadores ? "Google puede mostrar el inicio y los artículos publicados." : "Está oculto para buscadores. Actívalo cuando tenga artículos que valga la pena leer.",
      accion: !ajustes.buscadores ? <button type="button" onClick={() => ir("ajustes")} className={botonSecundario}>Ir a ajustes</button> : undefined,
    },
    {
      hecho: resumen.anunciosActivos > 0,
      titulo: "Tiene publicidad en emisión (opcional)",
      detalle: resumen.anunciosActivos > 0 ? `${resumen.anunciosActivos} anuncio${resumen.anunciosActivos === 1 ? "" : "s"} en emisión.` : "Ningún espacio tiene anuncio todavía.",
      accion: <button type="button" onClick={() => ir("publicidad")} className={botonSecundario}>Ir a publicidad</button>,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <Cifra titulo="Visitas · 30 días" valor={numero(resumen.vistas30d)} detalle="Inicio, listado y artículos" />
        <Cifra titulo="Clics en «Súmate»" valor={numero(resumen.cta30d)} detalle={`${porcentaje(resumen.cta30d, resumen.vistas30d)} de las visitas · 30 días`} />
        <Cifra titulo="Afiliados traídos" valor={numero(resumen.adeptos)} detalle={`${numero(resumen.adeptos30d)} en los últimos 30 días`} />
        <Cifra titulo="Artículos" valor={numero(resumen.publicados)} detalle={`${numero(resumen.borradores)} en borrador · ${numero(resumen.lecturas)} lecturas`} />
        <Cifra titulo="Anuncios en emisión" valor={numero(resumen.anunciosActivos)} detalle="Entre todos los espacios" />
        <Cifra titulo="Clics en anuncios" valor={numero(resumen.anuncioClics30d)} detalle="Últimos 30 días" />
      </div>

      <section className={`${tarjeta} p-5`}>
        <h3 className="font-display text-lg font-semibold">Del visitante al afiliado</h3>
        <p className="text-sm text-muted-foreground">Así se mueve la gente que llega a este portal hacia la comunidad de María Fernanda Cabal (últimos 30 días).</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {[["Visitas", resumen.vistas30d, ""], ["Clics en «Súmate»", resumen.cta30d, porcentaje(resumen.cta30d, resumen.vistas30d)], ["Se afiliaron", resumen.adeptos30d, porcentaje(resumen.adeptos30d, resumen.cta30d)]].map(([t, n, p], i) => (
            <li key={String(t)} className="relative rounded-xl bg-surface-muted px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground">{t}</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{numero(Number(n))}</p>
              {i > 0 && <p className="text-xs text-muted-foreground">{p} del paso anterior</p>}
              {i < 2 && <ArrowRight className="absolute top-1/2 -right-2.5 z-10 hidden size-5 -translate-y-1/2 rounded-full bg-surface p-0.5 text-muted-foreground ring-1 ring-border sm:block" />}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">Un afiliado se anota a este portal cuando entra al formulario de afiliación desde el botón «Súmate» (o desde el enlace para redes de Ajustes) y completa su registro.</p>
      </section>

      <section className={`${tarjeta} p-5`}>
        <h3 className="font-display text-lg font-semibold">Puesta en marcha</h3>
        <ul className="mt-3 divide-y divide-border">
          {pasos.map((p) => (
            <li key={p.titulo} className="flex flex-wrap items-center gap-3 py-3">
              <span className={`grid size-6 shrink-0 place-items-center rounded-full ${p.hecho ? "bg-emerald-500 text-white" : "text-muted-foreground ring-1 ring-border"}`}>{p.hecho ? <Check className="size-3.5" /> : <Circle className="size-3" />}</span>
              <div className="min-w-0 flex-1 basis-60"><p className="text-sm font-semibold">{p.titulo}</p><p className="text-xs text-muted-foreground">{p.detalle}</p></div>
              {p.accion}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => ir("articulos", true)} className={botonPrimario}><Sparkles className="size-4" /> Escribir un artículo con IA</button>
        {enLinea && <a href={`/p/${portal.slug}`} target="_blank" rel="noreferrer noopener" className={botonSecundario}>Ver el portal <ExternalLink className="size-4" /></a>}
      </div>
    </div>
  );
}
