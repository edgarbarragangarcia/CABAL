/**
 * Cruce entre los nombres territoriales de la Registraduría (en mayúsculas,
 * sin tildes y a veces truncados, p. ej. "NORTE DE SAN") y los códigos DANE
 * de los mapas (public/data/geo). Lo usan tanto el servidor como el mapa
 * del cliente, así que no depende de nada de servidor.
 */

/** Departamentos por su nombre en los resultados de la Registraduría. */
export const ELECTORAL_DEPARTMENTS: Record<string, { dane: string; display: string }> = {
  AMAZONAS: { dane: "91", display: "Amazonas" },
  ANTIOQUIA: { dane: "05", display: "Antioquia" },
  ARAUCA: { dane: "81", display: "Arauca" },
  ATLANTICO: { dane: "08", display: "Atlántico" },
  "BOGOTA D.C.": { dane: "11", display: "Bogotá D.C." },
  BOLIVAR: { dane: "13", display: "Bolívar" },
  BOYACA: { dane: "15", display: "Boyacá" },
  CALDAS: { dane: "17", display: "Caldas" },
  CAQUETA: { dane: "18", display: "Caquetá" },
  CASANARE: { dane: "85", display: "Casanare" },
  CAUCA: { dane: "19", display: "Cauca" },
  CESAR: { dane: "20", display: "Cesar" },
  CHOCO: { dane: "27", display: "Chocó" },
  CORDOBA: { dane: "23", display: "Córdoba" },
  CUNDINAMARCA: { dane: "25", display: "Cundinamarca" },
  GUAINIA: { dane: "94", display: "Guainía" },
  GUAVIARE: { dane: "95", display: "Guaviare" },
  HUILA: { dane: "41", display: "Huila" },
  "LA GUAJIRA": { dane: "44", display: "La Guajira" },
  MAGDALENA: { dane: "47", display: "Magdalena" },
  META: { dane: "50", display: "Meta" },
  "NARIÑO": { dane: "52", display: "Nariño" },
  "NORTE DE SAN": { dane: "54", display: "Norte de Santander" },
  PUTUMAYO: { dane: "86", display: "Putumayo" },
  QUINDIO: { dane: "63", display: "Quindío" },
  RISARALDA: { dane: "66", display: "Risaralda" },
  "SAN ANDRES": { dane: "88", display: "San Andrés y Providencia" },
  SANTANDER: { dane: "68", display: "Santander" },
  SUCRE: { dane: "70", display: "Sucre" },
  TOLIMA: { dane: "73", display: "Tolima" },
  VALLE: { dane: "76", display: "Valle del Cauca" },
  VAUPES: { dane: "97", display: "Vaupés" },
  VICHADA: { dane: "99", display: "Vichada" },
};

export const BOGOTA_DANE = "11";

/**
 * En Bogotá las zonas electorales 01–20 coinciden con las localidades
 * (mismo número que LOCCODIGO de la capa de la Secretaría de Planeación).
 * La 90 es el puesto censo de Corferias y la 98 agrupa las cárceles.
 */
export const BOGOTA_ZONAS: Record<string, string> = {
  "01": "Usaquén",
  "02": "Chapinero",
  "03": "Santa Fe",
  "04": "San Cristóbal",
  "05": "Usme",
  "06": "Tunjuelito",
  "07": "Bosa",
  "08": "Kennedy",
  "09": "Fontibón",
  "10": "Engativá",
  "11": "Suba",
  "12": "Barrios Unidos",
  "13": "Teusaquillo",
  "14": "Los Mártires",
  "15": "Antonio Nariño",
  "16": "Puente Aranda",
  "17": "La Candelaria",
  "18": "Rafael Uribe Uribe",
  "19": "Ciudad Bolívar",
  "20": "Sumapaz",
  "90": "Corferias (puesto censo)",
  "98": "Cárceles",
};

/** Mayúsculas, sin tildes ni puntuación: "BOGOTÁ, D.C." y "BOGOTA. D.C." quedan iguales. */
export function normalizePlaceName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Municipios cuyo nombre en la Registraduría no coincide con el del DANE
 * ni por inclusión de palabras. Clave: nombre normalizado de la
 * Registraduría; valor: código DANE del municipio.
 */
const MUNICIPIO_ALIASES: Record<string, string> = {
  "ARROYO HONDO": "13062",
  "DON MATIAS": "05237",
  "LA ARGENTINA PLATA VIEJA": "41378",
  "MEDIO ATRATO BETE": "27425",
  "MORICHAL PAPUNAGUA": "97777",
  RIOVIEJO: "13600",
  // Antioquia: la Registraduría llama "SAN PEDRO" a San Pedro de los Milagros.
  "SAN PEDRO": "05664",
  "VILLA DE LEIVA": "15407",
  "VISTA HERMOSA": "50711",
};

/**
 * Busca el código DANE de un municipio de la Registraduría entre los
 * municipios del mapa de su departamento: primero alias conocidos, luego
 * nombre idéntico y, si no, el único municipio cuyo nombre contiene todas
 * las palabras del otro ("CUCUTA" ↔ "SAN JOSÉ DE CÚCUTA").
 */
export function matchMunicipio(
  electoralName: string,
  candidates: { code: string; name: string }[]
): string | undefined {
  const target = normalizePlaceName(electoralName);
  const alias = MUNICIPIO_ALIASES[target];
  if (alias && candidates.some((c) => c.code === alias)) return alias;

  const normalized = candidates.map((c) => ({ code: c.code, name: normalizePlaceName(c.name) }));
  const exact = normalized.find((c) => c.name === target);
  if (exact) return exact.code;

  const words = (s: string) => new Set(s.split(" "));
  const targetWords = words(target);
  const contains = normalized.filter((c) => {
    const cw = words(c.name);
    return [...targetWords].every((w) => cw.has(w)) || [...cw].every((w) => targetWords.has(w));
  });
  return contains.length === 1 ? contains[0].code : undefined;
}
