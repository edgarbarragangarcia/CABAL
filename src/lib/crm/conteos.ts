import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";

import { call, normalizeWebhookUrl, toQuery } from "./bitrix24";
import { candidatos, departamentoDe, municipioPorDane, todosLosDepartamentos, type Mun } from "./geo";

/**
 * Cuántos leads hay en cada ciudad y departamento, exacto y para TODOS los leads de Bitrix24: no se copia a las personas, se le pide a
 * Bitrix24 el conteo de cada ciudad (50 conteos por llamada) y se guardan en Supabase (tabla crm_conteos, ver supabase/crm.sql).
 */
const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();

type FieldMeta = { type: string; items?: { ID: string | number; VALUE: string }[]; formLabel?: unknown; listLabel?: unknown; title?: unknown };
type Item = { id: string; nombre: string };
type Campos = { ciudad: string; depto: string; ciudades: Item[]; deptos: Item[] };

const texto = (x: unknown): string => (typeof x === "string" ? x : x && typeof x === "object" ? String(Object.values(x as Record<string, unknown>)[0] ?? "") : "");
const etiqueta = (m: FieldMeta) => plano([m.formLabel, m.listLabel, m.title].map(texto).find((t) => t.trim()) ?? "");

/** Los campos «Ciudad / Municipio» y «Departamentos» del CRM, con sus listas de valores. */
async function campos(base: string): Promise<Campos> {
  const { result } = await call<Record<string, FieldMeta>>(base, "crm.lead.fields");
  const buscar = (re: RegExp) => Object.entries(result).find(([k, m]) => k.startsWith("UF_") && m.type === "enumeration" && re.test(etiqueta(m)));
  const c = buscar(/^(ciudad|municipio)( |$)|ciudad municipio/);
  const d = buscar(/^departamentos?$/);
  if (!c || !d) throw new Error("No encontré en Bitrix24 los campos «Ciudad / Municipio» y «Departamentos» de los leads.");
  const items = (m: FieldMeta) => (m.items ?? []).map((i) => ({ id: String(i.ID), nombre: String(i.VALUE) }));
  return { ciudad: c[0], depto: d[0], ciudades: items(c[1]), deptos: items(d[1]) };
}

type Consulta = { clave: string; tipo: string; nombre: string; filtro: Record<string, string> };

/** Todas las consultas de conteo, en un orden fijo (así se puede retomar por posición). */
function consultas(c: Campos): Consulta[] {
  const q: Consulta[] = [
    { clave: "total", tipo: "total", nombre: "Todos los leads", filtro: {} },
    { clave: "con_ciudad", tipo: "total", nombre: "Con ciudad", filtro: { [`!${c.ciudad}`]: "" } },
    { clave: "con_depto", tipo: "total", nombre: "Con departamento", filtro: { [`!${c.depto}`]: "" } },
  ];
  for (const d of c.deptos) q.push({ clave: `depto:${d.id}`, tipo: "depto", nombre: d.nombre, filtro: { [c.depto]: d.id } });
  for (const x of c.ciudades) q.push({ clave: `ciudad:${x.id}`, tipo: "ciudad", nombre: x.nombre, filtro: { [c.ciudad]: x.id } });
  // Nombres que se repiten en varios departamentos: se parte el conteo por departamento para ubicarlos bien.
  const depId = new Map<string, string>();
  for (const d of c.deptos) { const dep = departamentoDe(d.nombre); if (dep) depId.set(dep.codigo, d.id); }
  for (const x of c.ciudades) {
    const cand = candidatos(x.nombre);
    if (cand.length < 2) continue;
    for (const dep of new Set(cand.map((m) => m.dep))) {
      const id = depId.get(dep);
      if (id) q.push({ clave: `ciudad:${x.id}:${dep}`, tipo: "ciudad_depto", nombre: x.nombre, filtro: { [c.ciudad]: x.id, [c.depto]: id } });
    }
  }
  return q;
}

const POR_LLAMADA = 50;

/** Cuenta `cantidad` consultas desde la posición `desde` y las guarda. Devuelve dónde seguir. */
export async function contar(webhook: string, desde: number, cantidad = 200) {
  const base = normalizeWebhookUrl(webhook);
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase no está conectado.");
  const lista = consultas(await campos(base));
  const hasta = Math.min(lista.length, desde + cantidad);
  const filas: { clave: string; tipo: string; nombre: string; total: number; actualizado_en: string }[] = [];
  for (let i = desde; i < hasta; i += POR_LLAMADA) {
    const trozo = lista.slice(i, Math.min(hasta, i + POR_LLAMADA));
    const cmd = Object.fromEntries(trozo.map((q, k) => [`c${k}`, `crm.lead.list?${toQuery({ select: ["ID"], filter: q.filtro }, "").join("&")}`]));
    const r = await call<{ result_total?: Record<string, number>; result_error?: Record<string, unknown> | unknown[] }>(base, "batch", { halt: 0, cmd });
    const totales = r.result.result_total ?? {};
    trozo.forEach((q, k) => filas.push({ clave: q.clave, tipo: q.tipo, nombre: q.nombre, total: Number(totales[`c${k}`] ?? 0), actualizado_en: new Date().toISOString() }));
  }
  const { error } = await supabase.from("crm_conteos").upsert(filas, { onConflict: "clave" });
  if (error) throw new Error(error.message.includes("crm_conteos") ? "Falta crear la tabla: corre supabase/crm.sql en el SQL Editor de Supabase." : error.message);
  return { siguiente: hasta, total: lista.length, terminado: hasta >= lista.length };
}

export type PuntoCiudad = { dane: string; nombre: string; departamento: string; lat: number; lon: number; total: number };

/** Lo guardado, ya ubicado en municipios y departamentos del mapa. */
export async function resumenConteos() {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Supabase no está conectado.");
  const filas: { clave: string; tipo: string; nombre: string; total: number; actualizado_en: string }[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from("crm_conteos").select("clave, tipo, nombre, total, actualizado_en").order("clave").range(desde, desde + 999);
    if (error) throw new Error(error.message.includes("crm_conteos") ? "Falta crear la tabla: corre supabase/crm.sql en el SQL Editor de Supabase." : error.message);
    filas.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const valor = (clave: string) => filas.find((f) => f.clave === clave)?.total ?? 0;
  const municipios = new Map<string, PuntoCiudad>();
  const sumar = (m: Mun, total: number) => {
    if (total <= 0) return;
    const a = municipios.get(m.dane) ?? { dane: m.dane, nombre: m.nombre, departamento: m.depNombre, lat: m.lat, lon: m.lon, total: 0 };
    a.total += total;
    municipios.set(m.dane, a);
  };
  const sinUbicar: { nombre: string; total: number }[] = [];
  for (const f of filas.filter((x) => x.tipo === "ciudad")) {
    const cand = candidatos(f.nombre);
    if (cand.length === 1) sumar(cand[0], f.total);
    else if (cand.length > 1) {
      const id = f.clave.slice("ciudad:".length);
      let repartido = 0;
      for (const sub of filas.filter((x) => x.tipo === "ciudad_depto" && x.clave.startsWith(`ciudad:${id}:`))) {
        const m = cand.find((c) => c.dep === sub.clave.split(":")[2]);
        if (m) { sumar(m, sub.total); repartido += sub.total; }
      }
      // Lo que no tiene departamento (o es de otro): se asigna al más poblado de los que comparten el nombre.
      if (f.total > repartido) sumar([...cand].sort((a, b) => b.pob - a.pob)[0], f.total - repartido);
    } else if (f.total > 0) sinUbicar.push({ nombre: f.nombre, total: f.total });
  }
  const departamentos = filas.filter((x) => x.tipo === "depto").flatMap((f) => {
    const d = departamentoDe(f.nombre);
    return d ? [{ codigo: d.codigo, nombre: d.nombre, total: f.total, lat: d.lat, lon: d.lon }] : [];
  }).sort((a, b) => b.total - a.total);
  const puntos = [...municipios.values()].sort((a, b) => b.total - a.total);
  return {
    actualizado: filas.reduce((m, f) => (f.actualizado_en > m ? f.actualizado_en : m), ""),
    totales: { leads: valor("total"), conCiudad: valor("con_ciudad"), conDepartamento: valor("con_depto"), ubicadosEnMapa: puntos.reduce((s, p) => s + p.total, 0), sinUbicar: sinUbicar.reduce((s, x) => s + x.total, 0) },
    municipios: puntos,
    departamentos,
    sinUbicar: sinUbicar.sort((a, b) => b.total - a.total).slice(0, 30),
    hayDatos: filas.length > 0,
  };
}

export { municipioPorDane, todosLosDepartamentos };
