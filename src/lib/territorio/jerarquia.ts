import "server-only";

import { GEOS } from "@/data/elecciones";
import { UBICACION } from "@/data/territorio";
import barriosBogota from "@/data/territorio/bogota-barrios.json";
import { BOGOTA_ZONAS } from "@/lib/electoral-places";
import { listaDeLugares, lugarDe as lugarPorDane } from "./lugares";

/**
 * Los lugares de Colombia de lo general a lo particular, para elegir uno y ver su información:
 *
 *   Colombia › departamento › municipio › localidad o comuna › barrio (solo Bogotá, por ahora) › puesto de votación
 *
 * Qué hay detrás de cada nivel (cada uno solo existe si hay datos reales; nada se inventa):
 *  - departamentos y municipios: el DANE (`lugares.ts`).
 *  - localidad o comuna: las zonas del nomenclátor de la Registraduría agrupadas por la etiqueta oficial del Divipole 2023. En
 *    Bogotá cada zona es una localidad (01–20); en Medellín dos zonas pueden ser una comuna. Donde el Divipole no trae etiqueta
 *    (casi todos los municipios pequeños) ese nivel se omite y el municipio lista sus puestos directamente.
 *  - barrio: los 1.230 sectores catastrales de Catastro Bogotá; cada puesto se asignó al que lo contiene por sus coordenadas.
 *  - puesto de votación: el nomenclátor de Presidencia 2026, con dirección y coordenadas del Divipole cuando el nombre coincide.
 *
 * Los ids son estables y se pueden guardar: `co`, `11`, `11001`, `11001:z01` (localidad o comuna, por su primera zona),
 * `11001:b002104` (barrio, por su código catastral) y `11001:p1600001010122` (puesto, por su código del nomenclátor).
 */

export type NivelLugar = "pais" | "departamento" | "municipio" | "localidad" | "barrio" | "puesto";

export type Miga = { id: string; nivel: NivelLugar; nombre: string };

export type Hijo = {
  id: string;
  nivel: NivelLugar;
  nombre: string;
  /** Una línea de contexto: cuántos puestos tiene, dónde queda... */
  detalle?: string;
  /** Cuántos puestos de votación contiene (para ordenar y mostrar). */
  puestos?: number;
};

export type VistaHijos = { clave: string; titulo: string; items: Hijo[] };

export type Lugar = {
  id: string;
  nivel: NivelLugar;
  nombre: string;
  /** Desde Colombia hasta este lugar (incluido). */
  ruta: Miga[];
  /** Los datos del DANE a los que pertenece (conflicto, población): su departamento y, desde el municipio, el municipio. */
  departamento: { dane: string; nombre: string } | null;
  municipio: { dane: string; nombre: string } | null;
  /** Lo que se puede elegir ahora (vacío en un puesto). */
  vistas: VistaHijos[];
  puesto?: { codigo: string; zona: string; mesas: number; direccion: string | null; lat: number | null; lon: number | null; barrio: Miga | null };
  /** Un barrio sin puesto de votación: dónde votan sus vecinos. */
  cercanos?: (Hijo & { metros: number })[];
  /** Cuántos puestos de votación hay en este lugar (con los de sus hijos). */
  puestos: number;
  /** Cómo se llaman los datos que hay en este nivel y cuáles faltan, para decírselo al usuario. */
  notas: string[];
};

export type Coincidencia = { id: string; nivel: NivelLugar; nombre: string; contexto: string };

// ------------------------------------------------------------------ datos ---

type Fila = [string, string, number, number, number, string?];
type Geo = { filas: Fila[]; hijos: Map<number, number[]>; porDane: Map<string, number> };
type UbicacionMpio = { z?: Record<string, string>; p?: Record<string, [number | null, number | null, string, string?]> };

const GEO_REFERENCIA = "7999e3f490"; // Presidencia 2026 · 2.ª vuelta: el nomenclátor más reciente
const BOGOTA = "11001";

export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

let geoPromesa: Promise<Geo> | null = null;
function geografia(): Promise<Geo> {
  geoPromesa ??= GEOS[GEO_REFERENCIA]().then(({ default: datos }) => {
    const filas = datos as Fila[];
    const hijos = new Map<number, number[]>();
    const porDane = new Map<string, number>();
    filas.forEach((r, i) => {
      if (r[2] === 3 && r[5]) porDane.set(r[5], i);
      if (r[4] >= 0) (hijos.get(r[4]) ?? hijos.set(r[4], []).get(r[4])!).push(i);
    });
    return { filas, hijos, porDane };
  });
  geoPromesa.catch(() => (geoPromesa = null));
  return geoPromesa;
}

const ubicaciones = new Map<string, Promise<Record<string, UbicacionMpio>>>();
function ubicacionDe(dep: string): Promise<Record<string, UbicacionMpio>> {
  let p = ubicaciones.get(dep);
  if (!p) {
    const carga = UBICACION[dep];
    p = carga ? carga().then((m) => m.default as Record<string, UbicacionMpio>) : Promise.resolve({});
    ubicaciones.set(dep, p);
  }
  return p;
}

// ------------------------------------------------------------- municipio ---

type PuestoInt = { codigo: string; nombre: string; zona: string; mesas: number; direccion: string | null; lat: number | null; lon: number | null; barrio: string | null };
type GrupoInt = { id: string; nombre: string; zonas: string[]; puestos: number };
type MunicipioInt = { dane: string; nombre: string; puestos: PuestoInt[]; grupos: GrupoInt[]; tipoGrupos: string };

const numeroDeZona = (nombre: string) => (/(\d+)\s*$/.exec(nombre)?.[1] ?? "").padStart(2, "0");

/** «LOCALIDAD 1 USAQUEN» → «Localidad 1 Usaquén» sin perder siglas: solo se capitaliza; el cliente termina de darle formato. */
const etiquetaGrupo = (s: string) => s.replace(/\s+/g, " ").trim();

const municipios = new Map<string, Promise<MunicipioInt | null>>();
function municipioInterno(dane: string): Promise<MunicipioInt | null> {
  let p = municipios.get(dane);
  if (!p) {
    p = (async () => {
      const lugar = lugarPorDane(dane);
      if (!lugar || lugar.nivel !== "municipio") return null;
      const [geo, ubic] = await Promise.all([geografia(), ubicacionDe(dane.slice(0, 2))]);
      const u = ubic[dane] ?? {};
      const idx = geo.porDane.get(dane);
      const puestos: PuestoInt[] = [];
      const etiquetas = new Map<string, string>(); // zona -> etiqueta
      if (idx !== undefined) {
        for (const iz of geo.hijos.get(idx) ?? []) {
          const zona = numeroDeZona(geo.filas[iz][1]);
          const delGrupo = dane === BOGOTA ? BOGOTA_ZONAS[zona] : u.z?.[zona];
          if (delGrupo) etiquetas.set(zona, delGrupo);
          for (const ip of geo.hijos.get(iz) ?? []) {
            const f = geo.filas[ip];
            if (f[2] !== 6) continue;
            const ub = u.p?.[normalizar(f[1])];
            puestos.push({ codigo: f[0], nombre: f[1], zona, mesas: f[3], direccion: ub?.[2] || null, lat: ub?.[0] ?? null, lon: ub?.[1] ?? null, barrio: ub?.[3] ?? null });
          }
        }
      }
      puestos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

      // Localidades o comunas: zonas con la misma etiqueta. Si ninguna zona tiene etiqueta, no hay nivel intermedio.
      const grupos: GrupoInt[] = [];
      if (etiquetas.size > 0) {
        const porEtiqueta = new Map<string, string[]>();
        const zonas = [...new Set(puestos.map((x) => x.zona))].sort();
        for (const z of zonas) {
          const et = etiquetas.get(z) ?? `Zona ${Number(z)}`;
          (porEtiqueta.get(et) ?? porEtiqueta.set(et, []).get(et)!).push(z);
        }
        for (const [nombre, zs] of porEtiqueta) {
          grupos.push({ id: `${dane}:z${zs[0]}`, nombre: etiquetaGrupo(nombre), zonas: zs, puestos: puestos.filter((x) => zs.includes(x.zona)).length });
        }
        grupos.sort((a, b) => a.zonas[0].localeCompare(b.zonas[0]));
      }
      const loc = grupos.filter((g) => /LOCALIDAD|LOC\./i.test(g.nombre)).length;
      const com = grupos.filter((g) => /COMUNA/i.test(g.nombre)).length;
      const tipoGrupos = dane === BOGOTA || loc > grupos.length / 2 ? "Localidades" : com > grupos.length / 2 ? "Comunas" : "Zonas";
      return { dane, nombre: lugar.nombre, puestos, grupos, tipoGrupos };
    })();
    municipios.set(dane, p);
    p.catch(() => municipios.delete(dane));
  }
  return p;
}

// ---------------------------------------------------------------- barrios ---

type Barrio = { codigo: string; nombre: string; localidad: string; lat: number; lon: number };
const BARRIOS: Barrio[] = (barriosBogota as [string, string, string, number, number][]).map(([codigo, nombre, localidad, lat, lon]) => ({ codigo, nombre, localidad, lat, lon }));
const barrioPorCodigo = new Map(BARRIOS.map((b) => [b.codigo, b]));

function metros(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// ------------------------------------------------------------------ ids ---

const idPuesto = (dane: string, codigo: string) => `${dane}:p${codigo}`;
const idBarrio = (codigo: string) => `${BOGOTA}:b${codigo}`;
const dep2 = (id: string) => id.slice(0, 2);
const miga = (id: string, nivel: NivelLugar, nombre: string): Miga => ({ id, nivel, nombre });

const RAIZ: Miga = miga("co", "pais", "Colombia");

function hijoPuesto(p: PuestoInt, dane: string, conBarrio = false): Hijo {
  const b = conBarrio && p.barrio ? barrioPorCodigo.get(p.barrio) : undefined;
  return { id: idPuesto(dane, p.codigo), nivel: "puesto", nombre: p.nombre, detalle: [p.direccion, b ? `Barrio ${b.nombre}` : null, `${p.mesas} mesas`].filter(Boolean).join(" · ") };
}

const NOTA_ZONAS = "En este municipio la Registraduría no publica nombres de comunas o localidades, así que se listan directamente los puestos de votación.";

/** Un lugar con su ruta y lo que se puede elegir a continuación; null si el id no existe. */
export async function lugarDe(id: string): Promise<Lugar | null> {
  if (id === "co") {
    const { departamentos } = listaDeLugares();
    return {
      id,
      nivel: "pais",
      nombre: "Colombia",
      ruta: [RAIZ],
      departamento: null,
      municipio: null,
      vistas: [{ clave: "departamentos", titulo: "Departamentos", items: departamentos.map((d) => ({ id: d.dane, nivel: "departamento", nombre: d.nombre })) }],
      puestos: 0,
      notas: [],
    };
  }

  const [base, resto] = id.split(":");
  const d = lugarPorDane(base);
  if (!d) return null;

  if (!resto && d.nivel === "departamento") {
    const { municipios: todos } = listaDeLugares();
    const lista = todos.filter((m) => m.dep === d.dane);
    return {
      id,
      nivel: "departamento",
      nombre: d.nombre,
      ruta: [RAIZ, miga(id, "departamento", d.nombre)],
      departamento: { dane: d.dane, nombre: d.nombre },
      municipio: null,
      vistas: [{ clave: "municipios", titulo: `Municipios de ${d.nombre}`, items: lista.map((m) => ({ id: m.dane, nivel: "municipio", nombre: m.nombre })) }],
      puestos: 0,
      notas: [],
    };
  }
  if (d.nivel !== "municipio") return null;

  const m = await municipioInterno(d.dane);
  if (!m) return null;
  const dep = d.departamento!;
  // Bogotá es a la vez departamento y municipio: una sola migaja.
  const rutaMunicipio = dep.nombre === d.nombre ? [RAIZ, miga(d.dane, "municipio", d.nombre)] : [RAIZ, miga(dep.dane, "departamento", dep.nombre), miga(d.dane, "municipio", d.nombre)];
  const comunes = { departamento: dep, municipio: { dane: d.dane, nombre: d.nombre } };

  // Municipio
  if (!resto) {
    const vistas: VistaHijos[] = [];
    const notas: string[] = [];
    if (m.grupos.length > 0) {
      vistas.push({ clave: "grupos", titulo: m.tipoGrupos, items: m.grupos.map((g) => ({ id: g.id, nivel: "localidad", nombre: g.nombre, puestos: g.puestos, detalle: `${g.puestos} puestos de votación` })) });
    } else if (m.puestos.length > 0) {
      notas.push(NOTA_ZONAS);
    }
    vistas.push({ clave: "puestos", titulo: "Puestos de votación", items: m.puestos.map((p) => hijoPuesto(p, d.dane, true)) });
    return { id, nivel: "municipio", nombre: d.nombre, ruta: rutaMunicipio, ...comunes, vistas, puestos: m.puestos.length, notas };
  }

  const tipo = resto[0];
  const clave = resto.slice(1);

  // Localidad o comuna
  if (tipo === "z") {
    const g = m.grupos.find((x) => x.zonas[0] === clave || x.id === id);
    if (!g) return null;
    const puestos = m.puestos.filter((p) => g.zonas.includes(p.zona));
    const vistas: VistaHijos[] = [];
    const notas: string[] = [];
    if (d.dane === BOGOTA) {
      const loc = g.zonas[0];
      const barrios = BARRIOS.filter((b) => b.localidad === loc);
      if (barrios.length > 0) {
        const cuenta = new Map<string, number>();
        for (const p of puestos) if (p.barrio) cuenta.set(p.barrio, (cuenta.get(p.barrio) ?? 0) + 1);
        vistas.push({
          clave: "barrios",
          titulo: "Barrios",
          items: barrios
            .map((b): Hijo => ({ id: idBarrio(b.codigo), nivel: "barrio", nombre: b.nombre, puestos: cuenta.get(b.codigo) ?? 0, detalle: cuenta.get(b.codigo) ? `${cuenta.get(b.codigo)} puesto${cuenta.get(b.codigo) === 1 ? "" : "s"} de votación` : "sin puesto de votación" }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
        });
        const sinBarrio = puestos.filter((p) => !p.barrio).length;
        if (sinBarrio > 0) notas.push(`${sinBarrio} puesto${sinBarrio === 1 ? "" : "s"} de esta localidad no se pudo ubicar en un barrio (sin coordenadas oficiales): aparecen solo en la lista de puestos.`);
      }
    }
    vistas.push({ clave: "puestos", titulo: "Puestos de votación", items: puestos.map((p) => hijoPuesto(p, d.dane, true)) });
    return { id, nivel: "localidad", nombre: g.nombre, ruta: [...rutaMunicipio, miga(g.id, "localidad", g.nombre)], ...comunes, vistas, puestos: puestos.length, notas };
  }

  // Barrio (Bogotá)
  if (tipo === "b" && d.dane === BOGOTA) {
    const b = barrioPorCodigo.get(clave);
    if (!b) return null;
    const grupo = m.grupos.find((x) => x.zonas[0] === b.localidad || x.zonas.includes(b.localidad));
    const puestos = m.puestos.filter((p) => p.barrio === b.codigo);
    const ruta = [...rutaMunicipio, ...(grupo ? [miga(grupo.id, "localidad", grupo.nombre)] : []), miga(id, "barrio", b.nombre)];
    const lugar: Lugar = { id, nivel: "barrio", nombre: b.nombre, ruta, ...comunes, vistas: [], puestos: puestos.length, notas: [] };
    if (puestos.length > 0) {
      lugar.vistas = [{ clave: "puestos", titulo: "Puestos de votación en este barrio", items: puestos.map((p) => hijoPuesto(p, d.dane)) }];
    } else {
      const con = m.puestos.filter((p) => p.lat !== null && p.lon !== null);
      lugar.cercanos = con
        .map((p) => ({ ...hijoPuesto(p, d.dane, true), metros: Math.round(metros(b, { lat: p.lat!, lon: p.lon! })) }))
        .sort((a, b2) => a.metros - b2.metros)
        .slice(0, 4);
      lugar.notas.push("Este barrio no tiene puesto de votación: sus vecinos votan en alguno de los más cercanos.");
    }
    return lugar;
  }

  // Puesto de votación
  if (tipo === "p") {
    const p = m.puestos.find((x) => x.codigo === clave);
    if (!p) return null;
    const grupo = m.grupos.find((x) => x.zonas.includes(p.zona));
    const b = p.barrio ? barrioPorCodigo.get(p.barrio) : undefined;
    const ruta = [...rutaMunicipio, ...(grupo ? [miga(grupo.id, "localidad", grupo.nombre)] : []), ...(b ? [miga(idBarrio(b.codigo), "barrio", b.nombre)] : []), miga(id, "puesto", p.nombre)];
    return {
      id,
      nivel: "puesto",
      nombre: p.nombre,
      ruta,
      ...comunes,
      vistas: [],
      puesto: { codigo: p.codigo, zona: p.zona, mesas: p.mesas, direccion: p.direccion, lat: p.lat, lon: p.lon, barrio: b ? miga(idBarrio(b.codigo), "barrio", b.nombre) : null },
      puestos: 1,
      notas: [],
    };
  }
  return null;
}

// --------------------------------------------------------------- búsqueda ---

type Entrada = { id: string; nivel: NivelLugar; nombre: string; contexto: string; clave: string };
let indice: Promise<Entrada[]> | null = null;

function construirIndice(): Promise<Entrada[]> {
  indice ??= (async () => {
    const out: Entrada[] = [];
    const { departamentos, municipios: todos } = listaDeLugares();
    const nombreDep = new Map(departamentos.map((d) => [d.dane, d.nombre]));
    for (const d of departamentos) out.push({ id: d.dane, nivel: "departamento", nombre: d.nombre, contexto: "Departamento", clave: normalizar(d.nombre) });
    for (const m of todos) out.push({ id: m.dane, nivel: "municipio", nombre: m.nombre, contexto: nombreDep.get(m.dep) ?? "", clave: normalizar(m.nombre) });
    for (const b of BARRIOS) out.push({ id: idBarrio(b.codigo), nivel: "barrio", nombre: b.nombre, contexto: `Barrio · ${BOGOTA_ZONAS[b.localidad] ?? "Bogotá"}, Bogotá D.C.`, clave: normalizar(b.nombre) });
    for (const d of departamentos) {
      const ubic = await ubicacionDe(d.dane);
      for (const [dane, u] of Object.entries(ubic)) {
        const mpio = lugarPorDane(dane);
        if (!mpio) continue;
        const donde = `${mpio.nombre}, ${d.nombre}`;
        const etiquetas = dane === BOGOTA ? Object.entries(BOGOTA_ZONAS).filter(([z]) => Number(z) <= 20).map(([z, n]) => [z, n] as const) : Object.entries(u.z ?? {});
        const vistas = new Set<string>();
        for (const [z, et] of etiquetas) {
          if (vistas.has(et)) continue;
          vistas.add(et);
          out.push({ id: `${dane}:z${z}`, nivel: "localidad", nombre: et, contexto: `Localidad o comuna · ${donde}`, clave: normalizar(et) });
        }
      }
    }
    return out;
  })();
  indice.catch(() => (indice = null));
  return indice;
}

/** Puestos: se buscan aparte porque exigen cargar el nomenclátor (se hace solo cuando la búsqueda lo necesita). */
async function entradasDePuestos(): Promise<Entrada[]> {
  const geo = await geografia();
  const out: Entrada[] = [];
  for (const [dane, idx] of geo.porDane) {
    const m = lugarPorDane(dane);
    if (!m) continue;
    for (const iz of geo.hijos.get(idx) ?? []) {
      for (const ip of geo.hijos.get(iz) ?? []) {
        const f = geo.filas[ip];
        if (f[2] === 6) out.push({ id: idPuesto(dane, f[0]), nivel: "puesto", nombre: f[1], contexto: `Puesto de votación · ${m.nombre}, ${m.departamento?.nombre ?? ""}`, clave: normalizar(f[1]) });
      }
    }
  }
  return out;
}
let indicePuestos: Promise<Entrada[]> | null = null;

const PESO: Record<NivelLugar, number> = { pais: 0, departamento: 1, municipio: 2, localidad: 3, barrio: 4, puesto: 5 };

/** Coincidencias por nombre, de lo más general a lo más particular; primero las que empiezan igual que lo escrito. */
export async function buscar(texto: string, limite = 10): Promise<Coincidencia[]> {
  const q = normalizar(texto);
  if (q.length < 2) return [];
  const palabras = q.split(" ");
  const base = await construirIndice();
  const pasa = (e: Entrada) => palabras.every((w) => e.clave.includes(w));
  const puntaje = (e: Entrada) => (e.clave === q ? 0 : e.clave.startsWith(q) ? 1 : e.clave.split(" ").some((w) => w.startsWith(palabras[0])) ? 2 : 3);
  let hallados = base.filter(pasa);
  // Los puestos son miles: solo se recorren si lo anterior no alcanza.
  if (hallados.length < limite) {
    indicePuestos ??= entradasDePuestos();
    hallados = [...hallados, ...(await indicePuestos).filter(pasa)];
  }
  return hallados
    .sort((a, b) => puntaje(a) - puntaje(b) || PESO[a.nivel] - PESO[b.nivel] || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, limite)
    .map(({ id, nivel, nombre, contexto }) => ({ id, nivel, nombre, contexto }));
}

// ----------------------------------------------- para las votaciones ---

/** Qué hay que sumar para saber los votos de un lugar: zonas del nomenclátor o puestos, según el nivel. */
export async function ambitosDe(id: string): Promise<{ zonas: string[]; puestos: { codigo: string; nombre: string; zona: string }[] } | null> {
  const [base, resto] = id.split(":");
  if (!resto) return null;
  const m = await municipioInterno(base);
  if (!m) return null;
  if (resto[0] === "z") {
    const g = m.grupos.find((x) => x.zonas[0] === resto.slice(1));
    return g ? { zonas: g.zonas, puestos: m.puestos.filter((p) => g.zonas.includes(p.zona)).map(({ codigo, nombre, zona }) => ({ codigo, nombre, zona })) } : null;
  }
  if (resto[0] === "b") {
    const ps = m.puestos.filter((p) => p.barrio === resto.slice(1));
    return { zonas: [], puestos: ps.map(({ codigo, nombre, zona }) => ({ codigo, nombre, zona })) };
  }
  if (resto[0] === "p") {
    const p = m.puestos.find((x) => x.codigo === resto.slice(1));
    return p ? { zonas: [], puestos: [{ codigo: p.codigo, nombre: p.nombre, zona: p.zona }] } : null;
  }
  return null;
}

export const departamentoDe = (id: string) => dep2(id);
