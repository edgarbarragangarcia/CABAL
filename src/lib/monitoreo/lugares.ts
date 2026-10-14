import filas from "@/data/dane/lugares.json";

/**
 * Ubica un texto en Colombia por el lugar que nombra: municipios (los 1.123 del DANE, con el centro de su mapa) y departamentos.
 * Sirve para saber «de qué lugar habla» un titular o una publicación, sin IA y sin servicios externos.
 *
 * Es una heurística y se deja prudente: prefiere no ubicar a ubicar mal. Solo cuenta un municipio si es un nombre sin ambigüedad
 * (o si el propio texto nombra su departamento), y deja por fuera nombres que en una noticia casi nunca son el municipio
 * (Colombia, Palestina, Madrid, Granada, Florencia, Bolívar, Sucre, Córdoba…). «Santa Rosa de Cabal» es un municipio: no confundir con el apellido.
 */
export type LugarTexto = {
  nivel: "municipio" | "departamento";
  /** Código DANE: 5 dígitos del municipio o 2 del departamento. */
  dane: string;
  nombre: string;
  departamento: string;
  lat: number;
  lon: number;
};

type Fila = [dane: string, nombre: string, dep: string, departamento: string, poblacion: number, lat: number | null, lon: number | null];
const FILAS = filas as Fila[];

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const limpio = (s: string) => sinTildes(s).replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();

/** Nombres que en una noticia casi nunca son el municipio: se ignoran aunque existan. */
const NO_CUENTAN = new Set([
  "colombia", "palestina", "madrid", "granada", "florencia", "valencia", "barcelona", "sevilla", "toledo", "bolivar", "sucre", "cordoba", "narino", "caldas",
  "cauca", "valle", "santander", "paz", "pital", "cota", "carmen", "santa fe", "belen", "la union", "la esperanza", "san jose", "santa rosa", "san pedro",
  "san luis", "san antonio", "san juan", "san miguel", "san francisco", "san carlos", "san pablo", "san rafael", "san vicente", "la victoria", "el penol", "puerto rico",
  "villanueva", "guadalupe", "nueva granada", "monte", "pueblo", "cabal",
]);

type Municipio = { dane: string; nombre: string; dep: string; departamento: string; poblacion: number; lat: number; lon: number };
const MUNICIPIOS: Municipio[] = FILAS.filter((f) => f[5] !== null && f[6] !== null).map((f) => ({ dane: f[0], nombre: f[1], dep: f[2], departamento: f[3], poblacion: f[4], lat: f[5]!, lon: f[6]! }));

/** Los nombres por los que se conoce un municipio: «Bogotá, D.C.» → «bogota», «San José de Cúcuta» → «cucuta», «Cartagena de Indias» → «cartagena». */
function alias(m: Municipio): string[] {
  const base = limpio(m.nombre.replace(/, D\.C\./, ""));
  const lista = new Set([base]);
  const sinDe = base.replace(/ de indias$/, "");
  lista.add(sinDe);
  const sinPrefijo = sinDe.replace(/^(san jose|guadalajara|santiago|santa fe|villa) de /, "");
  lista.add(sinPrefijo);
  return [...lista].filter((a) => a.length >= 4);
}

type Candidato = { nombre: string; municipios: Municipio[] };
const PORNOMBRE = new Map<string, Municipio[]>();
for (const m of MUNICIPIOS) {
  for (const a of alias(m)) {
    if (NO_CUENTAN.has(a)) continue;
    // Un pueblo pequeño con nombre corto se confunde con palabras o apellidos: solo se aceptan los de más de 20.000 habitantes o de nombre largo.
    if (m.poblacion < 20_000 && a.length < 9) continue;
    (PORNOMBRE.get(a) ?? PORNOMBRE.set(a, []).get(a)!).push(m);
  }
}
const CANDIDATOS: Candidato[] = [...PORNOMBRE].map(([nombre, municipios]) => ({ nombre, municipios }));
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RE_MUNICIPIO = new RegExp(`(?<![a-z0-9ñ])(${CANDIDATOS.sort((a, b) => b.nombre.length - a.nombre.length).map((c) => escapar(c.nombre)).join("|")})(?![a-z0-9ñ])`, "g");

// Departamentos: el centro es el promedio de sus municipios, ponderado por población.
type Departamento = { dep: string; nombre: string; lat: number; lon: number; clave: string; ambiguo: boolean };
const AMBIGUOS = new Set(["bolivar", "valle", "cordoba", "sucre", "narino", "caldas", "cauca", "santander", "magdalena", "atlantico"]);
const DEPARTAMENTOS: Departamento[] = (() => {
  const por = new Map<string, { nombre: string; w: number; lat: number; lon: number }>();
  for (const m of MUNICIPIOS) {
    const d = por.get(m.dep) ?? { nombre: m.departamento, w: 0, lat: 0, lon: 0 };
    d.w += m.poblacion;
    d.lat += m.lat * m.poblacion;
    d.lon += m.lon * m.poblacion;
    por.set(m.dep, d);
  }
  return [...por].map(([dep, d]) => {
    const clave = limpio(d.nombre.replace(/, D\.C\./, "").replace(/^archipielago de /i, "").replace(/ y providencia.*$/i, "").replace(/ del cauca$/, " del cauca"));
    return { dep, nombre: d.nombre, lat: +(d.lat / d.w).toFixed(3), lon: +(d.lon / d.w).toFixed(3), clave: dep === "88" ? "san andres" : dep === "76" ? "valle del cauca" : clave, ambiguo: AMBIGUOS.has(clave) };
  }).filter((d) => d.dep !== "11");
})();
const NOMBRE_DEP = new Map(DEPARTAMENTOS.map((d) => [d.dep, d]));

/** Un departamento nombrado en el texto. Los nombres que también son apellidos o palabras comunes solo cuentan tras «en», «de», «del»… */
function departamentosEn(t: string): { d: Departamento; pos: number }[] {
  const hallados: { d: Departamento; pos: number }[] = [];
  for (const d of DEPARTAMENTOS) {
    const nombre = escapar(d.clave);
    const re = d.ambiguo ? new RegExp(`(?<![a-z0-9ñ])(?:en|del?|desde|por|hacia|departamento de)\\s+(?:el\\s+|la\\s+)?(${nombre})(?![a-z0-9ñ])`) : new RegExp(`(?<![a-z0-9ñ])(${nombre})(?![a-z0-9ñ])`);
    const m = re.exec(t);
    if (!m) continue;
    // «Piedad Córdoba», «Simón Bolívar»: un apellido, no un lugar.
    const antes = t.slice(Math.max(0, m.index - 14), m.index + (m[0].length - m[1].length));
    if (/(piedad|simon|antonio|jose|juan|francisco|carlos)\s*$/.test(antes) && d.ambiguo) continue;
    hallados.push({ d, pos: m.index });
  }
  return hallados;
}

/**
 * El lugar al que se refiere un texto. Primero el municipio más a la izquierda (el que suele abrir el titular); si no hay,
 * el departamento. null si no se puede ubicar con seguridad.
 */
export function lugarDelTexto(texto: string): LugarTexto | null {
  const t = limpio(texto);
  if (!t) return null;
  const deps = departamentosEn(t);
  const depsCodigos = new Set(deps.map((x) => x.d.dep));

  RE_MUNICIPIO.lastIndex = 0;
  for (const hit of t.matchAll(RE_MUNICIPIO)) {
    const candidatos = PORNOMBRE.get(hit[1]);
    if (!candidatos?.length) continue;
    let m: Municipio | undefined;
    if (candidatos.length === 1) m = candidatos[0];
    else m = candidatos.find((c) => depsCodigos.has(c.dep));
    if (!m) continue;
    return { nivel: "municipio", dane: m.dane, nombre: m.nombre, departamento: m.departamento, lat: m.lat, lon: m.lon };
  }
  if (deps.length > 0) {
    const d = deps.sort((a, b) => a.pos - b.pos)[0].d;
    return { nivel: "departamento", dane: d.dep, nombre: d.nombre, departamento: d.nombre, lat: d.lat, lon: d.lon };
  }
  return null;
}

/** El departamento (nombre) al que pertenece un código DANE de municipio. */
export function departamentoDe(dane: string): string | null {
  return NOMBRE_DEP.get(dane.slice(0, 2))?.nombre ?? (dane.startsWith("11") ? "Bogotá, D.C." : null);
}

/**
 * El lugar que más nombra un texto largo (la página de inicio de un portal): sirve para estimar desde qué ciudad publica un medio que no
 * está en el directorio. Pide al menos 3 menciones y que el lugar sea más de la mitad de las que hay; si no, no ubica.
 */
export function lugarPredominante(texto: string): LugarTexto | null {
  const t = limpio(texto);
  const cuenta = new Map<string, { m: Municipio; n: number }>();
  let total = 0;
  RE_MUNICIPIO.lastIndex = 0;
  for (const hit of t.matchAll(RE_MUNICIPIO)) {
    const candidatos = PORNOMBRE.get(hit[1]);
    if (candidatos?.length !== 1) continue; // los nombres repetidos en varios departamentos no se cuentan
    const m = candidatos[0];
    total++;
    const c = cuenta.get(m.dane) ?? { m, n: 0 };
    c.n++;
    cuenta.set(m.dane, c);
  }
  const primero = [...cuenta.values()].sort((a, b) => b.n - a.n)[0];
  if (!primero || primero.n < 3 || primero.n / total < 0.5) return null;
  const m = primero.m;
  return { nivel: "municipio", dane: m.dane, nombre: m.nombre, departamento: m.departamento, lat: m.lat, lon: m.lon };
}

/** Las ciudades que se recorren en la búsqueda a fondo: capitales y municipios de más de 40.000 habitantes, de mayor a menor. */
export const CIUDADES_BARRIDO: string[] = (() => {
  const capital = new Set<string>();
  const porDep = new Map<string, Municipio>();
  for (const m of MUNICIPIOS) {
    const c = porDep.get(m.dep);
    if (!c || m.poblacion > c.poblacion) porDep.set(m.dep, m);
  }
  for (const m of porDep.values()) capital.add(m.dane);
  const nombre = (m: Municipio) => m.nombre.replace(/, D\.C\./, "").replace(/^San José de (Cúcuta)$/, "$1").replace(/ de Indias$/, "");
  return MUNICIPIOS.filter((m) => m.poblacion >= 40_000 || capital.has(m.dane)).sort((a, b) => b.poblacion - a.poblacion).map(nombre).filter((n, i, a) => a.indexOf(n) === i);
})();

/** Todos los municipios (y el propio departamento) de los departamentos dados, listos para una búsqueda: «"Mapiripán" "Meta"». */
export function lugaresDeDepartamentos(codigos: Set<string>): string[] {
  const salida: string[] = [];
  for (const d of DEPARTAMENTOS) {
    if (!codigos.has(d.dep)) continue;
    const nombre = d.nombre.replace(/^Archipiélago de /, "").replace(/ y Providencia.*$/, "");
    salida.push(`"${nombre}"`);
    for (const m of MUNICIPIOS.filter((x) => x.dep === d.dep)) salida.push(`"${m.nombre.replace(/, D\.C\./, "")}" "${nombre}"`);
  }
  return salida;
}
