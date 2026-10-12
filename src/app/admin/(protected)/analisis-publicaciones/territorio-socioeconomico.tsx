"use client";

import { Loader2, TriangleAlert } from "lucide-react";

import type { Barra, Socio } from "@/lib/territorio/socioeconomico";
import type { Zona } from "@/lib/territorio/zona";
import { usePeticion } from "./peticion";

/** Economía, población y servicios del lugar elegido, con gráficas simples. Datos oficiales: DANE, MEN, MinSalud y MinAgricultura. */

const fmt = (n: number) => Math.round(n).toLocaleString("es-CO");
const pc = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const dec = (n: number, d = 1) => n.toLocaleString("es-CO", { maximumFractionDigits: d, minimumFractionDigits: d });
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const COLORES = ["bg-brand", "bg-sky-500", "bg-amber-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500", "bg-teal-500", "bg-orange-500"];

function Seccion({ titulo, fuente, children }: { titulo: string; fuente: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border p-4">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {children}
      <p className="text-[11px] text-muted-foreground">Fuente: {fuente}.</p>
    </section>
  );
}

/** Barras horizontales; con `suma` muestra también el porcentaje sobre el total. */
function Barras({ datos, formato = fmt, suma, max }: { datos: Barra[]; formato?: (n: number) => string; suma?: number; max?: number }) {
  const tope = max ?? Math.max(1, ...datos.map((d) => d.valor));
  return (
    <ul className="space-y-1.5">
      {datos.map((d, i) => (
        <li key={d.etiqueta} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]">
          <span className="truncate" title={d.etiqueta}>{d.etiqueta}</span>
          <span className="h-3 overflow-hidden rounded-full bg-surface-muted"><span className={`block h-full rounded-full ${COLORES[i % COLORES.length]}`} style={{ width: `${Math.max(1.5, (d.valor / tope) * 100)}%` }} /></span>
          <span className="tabular-nums text-muted-foreground">{formato(d.valor)}{suma ? ` · ${dec((d.valor / suma) * 100)} %` : ""}</span>
        </li>
      ))}
    </ul>
  );
}

/** Columnas verticales para una serie en el tiempo. */
function Columnas({ datos, formato = fmt }: { datos: Barra[]; formato?: (n: number) => string }) {
  const tope = Math.max(1, ...datos.map((d) => d.valor));
  return (
    <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Evolución en el tiempo">
      {datos.map((d) => (
        <div key={d.etiqueta} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.etiqueta}: ${formato(d.valor)}`}>
          <span className="hidden text-[9px] tabular-nums text-muted-foreground sm:block">{formato(d.valor)}</span>
          <span className="w-full rounded-t bg-brand/80" style={{ height: `${Math.max(3, (d.valor / tope) * 100)}%` }} />
          <span className="text-[10px] text-muted-foreground">{d.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <li className="rounded-xl border border-border p-3">
      <p className="text-xs font-semibold text-muted-foreground">{etiqueta}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{valor}</p>
      {detalle && <p className="text-[11px] text-muted-foreground">{detalle}</p>}
    </li>
  );
}


/** Cifras exactas de la comuna o localidad: Censo 2018 del DANE por manzana, con la comparación frente al conjunto de comunas. */
function ZonaCensal({ z }: { z: Zona }) {
  const dif = (a: number, b: number) => {
    const d = a - b;
    return Math.abs(d) < 0.5 ? "igual al promedio de la ciudad" : `${d > 0 ? "+" : "−"}${dec(Math.abs(d))} pts frente a la ciudad`;
  };
  const ocupadas = z.viviendas.ocupadas;
  const totalEstrato = z.estrato.reduce((s, e) => s + e.valor, 0);
  const totalEdu = z.educacion.reduce((s, e) => s + e.valor, 0);
  const totalTipos = z.viviendas.tipos.reduce((s, e) => s + e.valor, 0);
  return (
    <Seccion titulo={`${z.nombre} — datos exactos de la zona (${z.tipo.toLowerCase()} de ${z.municipio})`} fuente={z.fuente}>
      <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Dato etiqueta="Habitantes" valor={fmt(z.personas)} detalle={`${dec(z.contexto.pctDelMunicipio)} % de las ${z.contexto.zonas} zonas de ${z.municipio}`} />
        <Dato etiqueta="Hogares" valor={fmt(z.hogares)} detalle={`${dec(z.personasPorHogar, 2)} personas por hogar`} />
        <Dato etiqueta="Mujeres / hombres" valor={`${dec(pc(z.mujeres, z.personas))} % / ${dec(pc(z.hombres, z.personas))} %`} />
        <Dato etiqueta="Viviendas ocupadas" valor={fmt(ocupadas)} detalle={`${fmt(z.viviendas.desocupadas)} desocupadas`} />
      </ul>
      <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Dato etiqueta="Menores de 20 años" valor={`${dec(z.menores20.pct)} %`} detalle={dif(z.menores20.pct, z.menores20.pctMunicipio)} />
        <Dato etiqueta="Mayores de 60 años" valor={`${dec(z.mayores60.pct)} %`} detalle={dif(z.mayores60.pct, z.mayores60.pctMunicipio)} />
        {z.servicios.filter((x) => x.clave === "internet" || x.clave === "gas").map((x) => <Dato key={x.clave} etiqueta={`Con ${x.etiqueta.toLowerCase()}`} valor={`${dec(x.pct)} %`} detalle={dif(x.pct, x.pctMunicipio)} />)}
      </ul>
      <div className="grid gap-5 md:grid-cols-2">
        <div><p className="mb-2 text-xs font-semibold text-muted-foreground">Cómo se distribuye por edad</p><Barras datos={z.edades} suma={z.personas} /></div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Estrato socioeconómico (según la factura de energía, viviendas)</p>
          <Barras datos={z.estrato} suma={totalEstrato} />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Servicios públicos y conexión (% de viviendas ocupadas)</p>
          <Barras datos={z.servicios.map((x) => ({ etiqueta: x.etiqueta, valor: x.pct }))} formato={(v) => `${dec(v)} %`} max={100} />
          <p className="mt-1 text-[10px] text-muted-foreground">Ciudad: {z.servicios.map((x) => `${x.etiqueta} ${dec(x.pctMunicipio, 0)} %`).join(" · ")}</p>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Tipo de vivienda</p>
          <Barras datos={z.viviendas.tipos.filter((t) => t.valor > 0)} suma={totalTipos} />
          <p className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">Nivel educativo más alto (reparto entre estos cuatro niveles)</p>
          <Barras datos={z.educacion} suma={totalEdu} />
        </div>
      </div>
      {z.empresas && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-semibold text-muted-foreground">Empresas registradas en la zona ({z.empresas.anio}): {fmt(z.empresas.total)} en total. Las cinco actividades con más empresas:</p>
          <Barras datos={z.empresas.actividades} suma={z.empresas.total} />
          <p className="text-[11px] text-muted-foreground">Fuente: {z.empresas.fuente}. Es el registro de matrículas mercantiles ubicadas en la zona, no el empleo ni los ingresos.</p>
        </div>
      )}
    </Seccion>
  );
}

export function SocioeconomicoTerritorio({ lugarId, nombreLugar, subnivel }: { lugarId: string; nombreLugar: string; subnivel: boolean }) {
  const r = usePeticion<Socio>(`/api/admin/territorio/socioeconomico?id=${encodeURIComponent(lugarId)}`);
  if (r.estado === "cargando") return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Consultando DANE y datos abiertos… (puede tardar unos segundos)</p>;
  if (r.estado === "error") return <p className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-800 dark:text-rose-300">{r.error}</p>;
  const s = r.data;
  const ambito = s.nivel === "municipio" ? s.nombre : `el departamento de ${s.nombre}`;
  const eco = s.economia;
  const sector = (e: string) => s.economia?.sectores.find((x) => x.etiqueta === e)?.valor ?? 0;

  return (
    <div className="space-y-4">
      {subnivel && (
        <p className="text-xs text-muted-foreground">
          {s.zona
            ? `Las cifras de la zona son del Censo 2018 para ${s.zona.nombre}, donde queda ${nombreLugar} (no existen a nivel de barrio o puesto). Las de economía, educación y salud son del municipio.`
            : `Estas cifras existen por municipio, no por barrio, localidad o puesto: son las de ${ambito}, donde queda ${nombreLugar}.`}
        </p>
      )}
      {s.avisos.map((a) => <p key={a} className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />{a}</p>)}

      {s.zona && <ZonaCensal z={s.zona} />}
      {!s.zona && s.zonaAviso && <p className="flex items-start gap-2 rounded-xl bg-surface-muted/70 p-3 text-xs text-muted-foreground"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />{s.zonaAviso} Se muestran las cifras de {ambito}.</p>}
      {s.zona && <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Contexto: {ambito}</p>}

      {s.poblacion && (
        <Seccion titulo={`Población de ${s.nombre}`} fuente="DANE, proyecciones de población del Censo 2018">
          <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Dato etiqueta={`Habitantes ${s.poblacion.anio}`} valor={fmt(s.poblacion.total)} />
            <Dato etiqueta="En cabecera" valor={`${dec((s.poblacion.cabecera / s.poblacion.total) * 100)} %`} detalle={fmt(s.poblacion.cabecera)} />
            <Dato etiqueta="En el resto (rural)" valor={`${dec((s.poblacion.resto / s.poblacion.total) * 100)} %`} detalle={fmt(s.poblacion.resto)} />
            <Dato etiqueta="Mayores de 18" valor={`${dec((1 - s.poblacion.edades[0].valor / s.poblacion.total) * 100)} %`} detalle="en edad de votar" />
          </ul>
          <div className="grid gap-5 md:grid-cols-2">
            <div><p className="mb-2 text-xs font-semibold text-muted-foreground">Cómo se distribuye por edad</p><Barras datos={s.poblacion.edades} suma={s.poblacion.total} /></div>
            <div><p className="mb-2 text-xs font-semibold text-muted-foreground">Evolución de la población</p><Columnas datos={s.poblacion.evolucion} /></div>
          </div>
        </Seccion>
      )}

      {eco && (
        <Seccion titulo={`Economía de ${eco.departamento}${eco.esDelDepartamento ? " (el municipio no tiene PIB propio publicado)" : ""}`} fuente="DANE, cuentas departamentales (PIB a precios corrientes, datos.gov.co)">
          <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Dato etiqueta={`PIB ${eco.anio}`} valor={`$${fmt(eco.total / 1000)} billones`} detalle="a precios corrientes" />
            {["Primario", "Secundario", "Terciario"].map((k) => <Dato key={k} etiqueta={`Sector ${k.toLowerCase()}`} valor={`${dec((sector(k) / eco.total) * 100)} %`} detalle={k === "Primario" ? "agro y minería" : k === "Secundario" ? "industria y construcción" : "comercio y servicios"} />)}
          </ul>
          <div className="grid gap-5 md:grid-cols-2">
            <div><p className="mb-2 text-xs font-semibold text-muted-foreground">De qué vive: peso de cada actividad (miles de millones de pesos)</p><Barras datos={eco.actividades} suma={eco.total} /></div>
            <div><p className="mb-2 text-xs font-semibold text-muted-foreground">PIB por año (billones de pesos corrientes)</p><Columnas datos={eco.serie} formato={(n) => fmt(n / 1000)} /></div>
          </div>
        </Seccion>
      )}

      {s.agro && (
        <Seccion titulo={`Qué se produce en ${s.nombre} (agricultura)`} fuente={`Ministerio de Agricultura, Evaluaciones Agropecuarias Municipales ${s.agro.anio}`}>
          <Barras datos={s.agro.cultivos.map((c) => ({ etiqueta: c.cultivo, valor: c.produccion }))} formato={(v) => `${fmt(v)} t`} suma={s.agro.total} />
          <p className="text-[11px] text-muted-foreground">Toneladas producidas en {s.agro.anio}; porcentaje sobre los principales cultivos que se muestran.</p>
        </Seccion>
      )}

      {s.educacion && (
        <Seccion titulo="Educación: ¿los niños están en el colegio?" fuente={`Ministerio de Educación, estadísticas por municipio ${s.educacion.anio}${s.educacion.alcance !== "municipio" ? " (promedio simple de sus municipios)" : ""}`}>
          <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Dato etiqueta="Cobertura neta" valor={`${dec(s.educacion.resumen.neta)} %`} detalle="niños de 5 a 16 matriculados" />
            <Dato etiqueta="Deserción" valor={`${dec(s.educacion.resumen.desercion)} %`} detalle="dejan el colegio en el año" />
            <Dato etiqueta="Aprobación" valor={`${dec(s.educacion.resumen.aprobacion)} %`} />
            <Dato etiqueta="Repitencia" valor={`${dec(s.educacion.resumen.repitencia)} %`} />
          </ul>
          <div className="grid gap-5 md:grid-cols-2">
            <div><p className="mb-2 text-xs font-semibold text-muted-foreground">Cobertura neta por nivel (%)</p><Barras datos={s.educacion.cobertura} formato={(v) => `${dec(v)} %`} max={100} /></div>
            <div><p className="mb-2 text-xs font-semibold text-muted-foreground">Deserción por nivel (%)</p><Barras datos={s.educacion.desercion} formato={(v) => `${dec(v)} %`} max={Math.max(10, ...s.educacion.desercion.map((d) => d.valor))} /></div>
          </div>
        </Seccion>
      )}

      {s.salud && (
        <Seccion titulo="Salud: afiliados al sistema" fuente={`Ministerio de Salud, afiliados por municipio y régimen (${MESES[s.salud.mes - 1] ?? s.salud.mes} de ${s.salud.anio})`}>
          <Barras datos={s.salud.regimenes} suma={s.salud.total} />
          {s.poblacion && <p className="text-[11px] text-muted-foreground">{fmt(s.salud.total)} afiliados frente a {fmt(s.poblacion.total)} habitantes proyectados. El régimen subsidiado es el de quienes no pueden pagar su salud: un alto peso indica más pobreza o informalidad.</p>}
        </Seccion>
      )}

      {!s.poblacion && !s.economia && !s.educacion && !s.salud && !s.agro && <p className="text-sm text-muted-foreground">No encontré cifras socioeconómicas para este lugar.</p>}
    </div>
  );
}
