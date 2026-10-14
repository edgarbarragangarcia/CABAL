import snapshot from "@/data/dane/municipios.json";

/**
 * Las 58 cámaras de comercio del RUES con su ciudad sede. El nombre y el código son los que publica el RUES; la sede es la ciudad
 * principal de la cámara (varias llevan nombre de región: Huila, Cauca, Urabá…) y es la que se ubica en el mapa.
 */
export const CAMARAS: { codigo: string; sede: string; departamento: string }[] = [
  ["01", "Armenia", "Quindío"], ["02", "Barrancabermeja", "Santander"], ["03", "Barranquilla", "Atlántico"], ["04", "Bogotá", "Bogotá"],
  ["05", "Bucaramanga", "Santander"], ["06", "Buenaventura", "Valle del Cauca"], ["07", "Buga", "Valle del Cauca"], ["08", "Cali", "Valle del Cauca"],
  ["09", "Cartagena", "Bolívar"], ["10", "Cartago", "Valle del Cauca"], ["11", "Cúcuta", "Norte de Santander"], ["12", "Chinchiná", "Caldas"],
  ["13", "Duitama", "Boyacá"], ["14", "Girardot", "Cundinamarca"], ["15", "Honda", "Tolima"], ["16", "Ibagué", "Tolima"],
  ["17", "Ipiales", "Nariño"], ["18", "La Dorada", "Caldas"], ["19", "Magangué", "Bolívar"], ["20", "Manizales", "Caldas"],
  ["21", "Medellín", "Antioquia"], ["22", "Montería", "Córdoba"], ["23", "Neiva", "Huila"], ["24", "Palmira", "Valle del Cauca"],
  ["25", "Pamplona", "Norte de Santander"], ["26", "Pasto", "Nariño"], ["27", "Pereira", "Risaralda"], ["28", "Popayán", "Cauca"],
  ["29", "Quibdó", "Chocó"], ["30", "Riohacha", "La Guajira"], ["31", "San Andrés", "San Andrés"], ["32", "Santa Marta", "Magdalena"],
  ["33", "Santa Rosa de Cabal", "Risaralda"], ["34", "Sincelejo", "Sucre"], ["35", "Sogamoso", "Boyacá"], ["36", "Tuluá", "Valle del Cauca"],
  ["37", "Tumaco", "Nariño"], ["38", "Tunja", "Boyacá"], ["39", "Valledupar", "Cesar"], ["40", "Villavicencio", "Meta"],
  ["41", "Florencia", "Caquetá"], ["42", "Leticia", "Amazonas"], ["43", "Sevilla", "Valle del Cauca"], ["44", "Apartadó", "Antioquia"],
  ["45", "Chaparral", "Tolima"], ["46", "Mocoa", "Putumayo"], ["47", "Facatativá", "Cundinamarca"], ["48", "Arauca", "Arauca"],
  ["49", "Ocaña", "Norte de Santander"], ["50", "Yopal", "Casanare"], ["51", "Rionegro", "Antioquia"], ["52", "Puerto Berrío", "Antioquia"],
  ["53", "Aguachica", "Cesar"], ["54", "Dosquebradas", "Risaralda"], ["55", "Itagüí", "Antioquia"], ["56", "Saravena", "Arauca"],
  ["57", "San José del Guaviare", "Guaviare"], ["58", "Soacha", "Cundinamarca"],
].map(([codigo, sede, departamento]) => ({ codigo, sede, departamento }));

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const registros = Object.entries((snapshot as unknown as { municipios: Record<string, { nombre: string; departamento: string }> }).municipios);

/** Código DANE del municipio sede (null si no se pudo ubicar con certeza). */
/** Nombres con los que el DANE llama a algunas sedes. */
const NOMBRE_DANE: Record<string, string> = { buga: "Guadalajara de Buga", cucuta: "San José de Cúcuta", tumaco: "San Andrés de Tumaco" };

export function daneDeSede(sede: string, departamento: string): string | null {
  if (norm(sede) === "san andres" && norm(departamento) === "san andres") return "88001";
  const s = norm(NOMBRE_DANE[norm(sede)] ?? sede);
  const d = norm(departamento);
  const mismoNombre = registros.filter(([, r]) => norm(r.nombre) === s || norm(r.nombre).startsWith(`${s} `));
  const exactos = mismoNombre.filter(([, r]) => norm(r.nombre) === s);
  const lista = exactos.length ? exactos : mismoNombre;
  const deDep = lista.filter(([, r]) => norm(r.departamento).startsWith(d) || d.startsWith(norm(r.departamento)));
  return (deDep[0] ?? (lista.length === 1 ? lista[0] : undefined))?.[0] ?? null;
}
