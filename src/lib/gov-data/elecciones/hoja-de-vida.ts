import "server-only";

import https from "node:https";
import tls from "node:tls";
import { unstable_cache } from "next/cache";

import { querySocrataDataset } from "../socrata";

/**
 * Hoja de vida pública de un candidato. La Registraduría solo publica las
 * listas de inscritos, así que las fuentes oficiales son las de Función
 * Pública:
 * - "Personas Expuestas Políticamente (PEP)" en datos.gov.co (3qxn-uc22):
 *   cargos públicos por cédula, a veces con el enlace a su hoja de vida.
 * - El directorio del SIGEP: formación académica y experiencia laboral de
 *   todo servidor público y contratista activo del Estado, publicadas por la
 *   Ley de Transparencia. Se busca por nombre y cubre a muchos que la lista
 *   PEP deja por fuera (buena parte del Senado, por ejemplo).
 * Quien hoy no trabaja para el Estado no aparece en ninguna de las dos.
 */

const PEP_DATASET = "3qxn-uc22";
const SIGEP = "https://www.funcionpublica.gov.co/dafpIndexerBHV/hvSigep";

export type CargoPublico = { cargo: string; entidad: string; desde?: string; hasta?: string };
export type Experiencia = { cargo: string; entidad: string; inicio: string; fin: string };
/** Una persona del directorio del SIGEP. */
export type PersonaSigep = { nombre: string; tipo: string; entidad: string; lugar: string; enlace: string };

export type HojaDeVida = {
  encontrada: boolean;
  /**
   * Cómo se ubicó la hoja de vida del SIGEP: con la cédula (el enlace de la
   * lista PEP) o solo por el nombre completo, que puede tener homónimos.
   */
  ubicadaPor?: "cedula" | "nombre";
  nombre?: string;
  nacimiento?: string;
  cargoActual?: { cargo: string; entidad: string };
  /** Cargos de la lista PEP, por cédula. */
  cargos: CargoPublico[];
  formacion: string[];
  experiencia: Experiencia[];
  enlace?: string;
  /** Personas del SIGEP con el mismo nombre, cuando nada dice cuál es el candidato. */
  homonimos: PersonaSigep[];
  /** La búsqueda del nombre en el directorio del SIGEP, para revisarla a mano. */
  busqueda: string;
  fuente: string;
};

type PepRow = {
  numero_documento: string;
  nombre_pep: string;
  denominacion_cargo?: string;
  nombre_entidad?: string;
  fecha_vinculacion?: string;
  fecha_desvinculacion?: string;
  enlace_hoja_vida_sigep?: { url?: string };
};

/**
 * El servidor del SIGEP envía un intermedio equivocado (el de validación de
 * dominio) y Node no puede completar la cadena de su certificado. Este es
 * el intermedio correcto, del repositorio de Sectigo que indica el propio
 * certificado (AIA: crt.sectigo.com/SectigoRSAOrganizationValidationSecureServerCA.crt),
 * firmado por USERTrust; SHA-256 72:A3:4A:…:3E:C0, vence en 2030. La
 * conexión se sigue verificando contra las raíces de confianza de Node.
 */
const SECTIGO_OV_INTERMEDIO = `-----BEGIN CERTIFICATE-----
MIIGGTCCBAGgAwIBAgIQE31TnKp8MamkM3AZaIR6jTANBgkqhkiG9w0BAQwFADCB
iDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCk5ldyBKZXJzZXkxFDASBgNVBAcTC0pl
cnNleSBDaXR5MR4wHAYDVQQKExVUaGUgVVNFUlRSVVNUIE5ldHdvcmsxLjAsBgNV
BAMTJVVTRVJUcnVzdCBSU0EgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTgx
MTAyMDAwMDAwWhcNMzAxMjMxMjM1OTU5WjCBlTELMAkGA1UEBhMCR0IxGzAZBgNV
BAgTEkdyZWF0ZXIgTWFuY2hlc3RlcjEQMA4GA1UEBxMHU2FsZm9yZDEYMBYGA1UE
ChMPU2VjdGlnbyBMaW1pdGVkMT0wOwYDVQQDEzRTZWN0aWdvIFJTQSBPcmdhbml6
YXRpb24gVmFsaWRhdGlvbiBTZWN1cmUgU2VydmVyIENBMIIBIjANBgkqhkiG9w0B
AQEFAAOCAQ8AMIIBCgKCAQEAnJMCRkVKUkiS/FeN+S3qU76zLNXYqKXsW2kDwB0Q
9lkz3v4HSKjojHpnSvH1jcM3ZtAykffEnQRgxLVK4oOLp64m1F06XvjRFnG7ir1x
on3IzqJgJLBSoDpFUd54k2xiYPHkVpy3O/c8Vdjf1XoxfDV/ElFw4Sy+BKzL+k/h
fGVqwECn2XylY4QZ4ffK76q06Fha2ZnjJt+OErK43DOyNtoUHZZYQkBuCyKFHFEi
rsTIBkVtkuZntxkj5Ng2a4XQf8dS48+wdQHgibSov4o2TqPgbOuEQc6lL0giE5dQ
YkUeCaXMn2xXcEAG2yDoG9bzk4unMp63RBUJ16/9fAEc2wIDAQABo4IBbjCCAWow
HwYDVR0jBBgwFoAUU3m/WqorSs9UgOHYm8Cd8rIDZsswHQYDVR0OBBYEFBfZ1iUn
Z/kxwklD2TA2RIxsqU/rMA4GA1UdDwEB/wQEAwIBhjASBgNVHRMBAf8ECDAGAQH/
AgEAMB0GA1UdJQQWMBQGCCsGAQUFBwMBBggrBgEFBQcDAjAbBgNVHSAEFDASMAYG
BFUdIAAwCAYGZ4EMAQICMFAGA1UdHwRJMEcwRaBDoEGGP2h0dHA6Ly9jcmwudXNl
cnRydXN0LmNvbS9VU0VSVHJ1c3RSU0FDZXJ0aWZpY2F0aW9uQXV0aG9yaXR5LmNy
bDB2BggrBgEFBQcBAQRqMGgwPwYIKwYBBQUHMAKGM2h0dHA6Ly9jcnQudXNlcnRy
dXN0LmNvbS9VU0VSVHJ1c3RSU0FBZGRUcnVzdENBLmNydDAlBggrBgEFBQcwAYYZ
aHR0cDovL29jc3AudXNlcnRydXN0LmNvbTANBgkqhkiG9w0BAQwFAAOCAgEAThNA
lsnD5m5bwOO69Bfhrgkfyb/LDCUW8nNTs3Yat6tIBtbNAHwgRUNFbBZaGxNh10m6
pAKkrOjOzi3JKnSj3N6uq9BoNviRrzwB93fVC8+Xq+uH5xWo+jBaYXEgscBDxLmP
bYox6xU2JPti1Qucj+lmveZhUZeTth2HvbC1bP6mESkGYTQxMD0gJ3NR0N6Fg9N3
OSBGltqnxloWJ4Wyz04PToxcvr44APhL+XJ71PJ616IphdAEutNCLFGIUi7RPSRn
R+xVzBv0yjTqJsHe3cQhifa6ezIejpZehEU4z4CqN2mLYBd0FUiRnG3wTqN3yhsc
SPr5z0noX0+FCuKPkBurcEya67emP7SsXaRfz+bYipaQ908mgWB2XQ8kd5GzKjGf
FlqyXYwcKapInI5v03hAcNt37N3j0VcFcC3mSZiIBYRiBXBWdoY5TtMibx3+bfEO
s2LEPMvAhblhHrrhFYBZlAyuBbuMf1a+HNJav5fyakywxnB2sJCNwQs2uRHY1ihc
6k/+JLcYCpsM0MF8XPtpvcyiTcaQvKZN8rG61ppnW5YCUtCC+cQKXA0o4D/I+pWV
idWkvklsQLI+qGu41SWyxP7x09fn1txDAXYw+zuLXfdKiXyaNb78yvBXAfCNP6CH
MntHWpdLgtJmwsQt6j8k9Kf5qLnjatkYYaA7jBU=
-----END CERTIFICATE-----`;
const CA = [...tls.rootCertificates, SECTIGO_OV_INTERMEDIO];

/** null si la página no existe; un error del servidor sí falla, para no dejarlo en caché. */
function getHtml(url: URL): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ca: CA, timeout: 15_000 }, (res) => {
      const status = res.statusCode ?? 0;
      if (status !== 200) {
        res.resume();
        if (status >= 500) reject(new Error(`El SIGEP respondió ${status}; intenta de nuevo en un momento.`));
        else resolve(null);
        return;
      }
      let html = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => (html += chunk));
      res.on("end", () => resolve(html));
    });
    req.on("timeout", () => req.destroy(new Error("SIGEP no respondió a tiempo.")));
    req.on("error", reject);
  });
}

const FUENTE =
  "Función Pública: Personas Expuestas Políticamente (datos.gov.co) y directorio de hojas de vida del SIGEP";

const texto = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

/** "20/07/2018" → valor ordenable. */
const fechaOrden = (f?: string) => {
  const m = f?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0;
};

function seccion(html: string, id: string) {
  const start = html.indexOf(`id="${id}"`);
  if (start < 0) return "";
  const next = html.indexOf('<div id="', start + id.length + 5);
  return html.slice(start, next < 0 ? undefined : next);
}

// ------------------------------------------------------------- nombres ---

const PARTICULAS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y"]);

/** "José de la Espriella" → ["JOSE", "ESPRIELLA"]: sin tildes, eñes ni partículas. */
const palabras = (nombre: string) =>
  nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((p) => p && !PARTICULAS.has(p));

/** El mismo nombre aunque cambie el orden ("Padilla Villarraga" en el tarjetón, "Villarraga Padilla" en el SIGEP). */
const clave = (nombre: string) => palabras(nombre).sort().join(" ");

// --------------------------------------------------------------- SIGEP ---

type FilaSigep = PersonaSigep & { id: string };

/** Entidades de elección popular, ya sin partículas ("CAMARA REPRESENTANTES"). */
const CORPORACION = /\b(SENADO|CAMARA REPRESENTANTES|ASAMBLEA|CONCEJO|JUNTA ADMINISTRADORA LOCAL)\b/;

const enlaceHv = (id: string) => `${SIGEP}/detallarHV/${id}`;

/** El buscador del directorio, con todas las palabras del nombre (ignora tildes y eñes). */
const urlBusqueda = (nombre: string) =>
  `${SIGEP}/index?${new URLSearchParams({ find: "FindNext", query: palabras(nombre).join(" ") })}`;

/** Los primeros 50 resultados del directorio para ese nombre. */
async function buscarEnSigep(nombre: string): Promise<FilaSigep[]> {
  const html = await getHtml(new URL(`${urlBusqueda(nombre)}&offset=0&max=50`));
  if (!html) return [];
  return [...html.matchAll(/<td class="columna-datos">([\s\S]*?)<\/td>/g)].flatMap(([, td]) => {
    const a = td.match(/href="\/dafpIndexerBHV\/hvSigep\/detallarHV\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) return [];
    // Bloques: nombre, tipo de vínculo, entidad y "correo / teléfono / municipio - departamento".
    const [, tipo = "", entidad = "", contacto = ""] = [...td.matchAll(/<span>([\s\S]*?)<\/span>/g)].map((m) =>
      texto(m[1])
    );
    return [{ id: a[1], nombre: texto(a[2]), tipo, entidad, lugar: contacto.split(" / ").pop() ?? "", enlace: enlaceHv(a[1]) }];
  });
}

/**
 * La hoja de vida que corresponde al nombre, si se puede saber cuál es: el
 * nombre completo tiene que coincidir palabra por palabra, y si hay varias
 * personas lo decide la entidad que reporta la lista PEP (por cédula).
 */
async function ubicarPorNombre(
  nombre: string,
  entidadesPep: Set<string>
): Promise<{ fila?: FilaSigep; homonimos: FilaSigep[] }> {
  const buscado = clave(nombre);
  // Una persona puede tener varias filas (una por entidad) con el mismo número
  // antes del primer guion; se prefiere su vínculo de servidor público (-4).
  const porPersona = new Map<string, FilaSigep>();
  for (const fila of await buscarEnSigep(nombre)) {
    if (clave(fila.nombre) !== buscado) continue;
    const persona = fila.id.split("-")[0];
    const previa = porPersona.get(persona);
    if (!previa || (!previa.id.endsWith("-4") && fila.id.endsWith("-4"))) porPersona.set(persona, fila);
  }
  const personas = [...porPersona.values()];
  const enPep = personas.filter((p) => entidadesPep.has(clave(p.entidad)));
  if (enPep.length === 1) return { fila: enPep[0], homonimos: [] };
  if (personas.length === 1) {
    // Cuatro palabras bastan; con tres, solo si trabaja en una corporación de
    // elección popular. Si no, puede ser un homónimo (hay un "Santiago Montoya
    // Montoya" auxiliar del Metro de Medellín) y queda para revisar a mano.
    const n = palabras(nombre).length;
    if (n >= 4 || (n === 3 && CORPORACION.test(palabras(personas[0].entidad).join(" ")))) {
      return { fila: personas[0], homonimos: [] };
    }
  }
  return { homonimos: personas };
}

/** La página de la hoja de vida es HTML de plantilla fija: se leen sus bloques. */
async function leerSigep(id: string) {
  const html = await getHtml(new URL(enlaceHv(encodeURIComponent(id))));
  if (!html) return null;
  const parrafo = (clase: string) => texto(html.match(new RegExp(`<p class="${clase}">([\\s\\S]*?)</p>`))?.[1] ?? "");

  const formacion = [...seccion(html, "formacionAcademica").matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
    .map((m) => texto(m[1]))
    .filter(Boolean);
  // Solo la primera tabla: después vienen las escalas salariales de la entidad.
  const tablaExperiencia = seccion(html, "experienciaLaboral").split("</table>")[0];
  const experiencia = [...tablaExperiencia.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
    .map((m) => [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((td) => texto(td[1])))
    .filter((c) => c.length >= 4)
    .map(([cargo, entidad, inicio, fin]) => ({ cargo, entidad, inicio, fin }));
  const nacimiento = html.match(/Municipio de Nacimiento:<\/span>[\s\S]*?<span>([\s\S]*?)<\/span>/)?.[1];
  const cargo = parrafo("cargo_funcionario").replace(/^no reportado$/i, "");
  const entidad = parrafo("institucion_funcionario");
  return {
    formacion,
    experiencia,
    nacimiento: nacimiento ? lugarDeNacimiento(texto(nacimiento)) : undefined,
    nombre: parrafo("nombre_funcionario") || undefined,
    cargoActual: cargo || entidad ? { cargo, entidad } : undefined,
  };
}

/** "BOGOTÁ. D.C., BOGOTÁ. D.C. - COLOMBIA" → "BOGOTÁ D.C."; el país solo si no es Colombia. */
function lugarDeNacimiento(s: string) {
  const [lugar, pais = ""] = s.split(/\s+-\s+/);
  const partes = lugar
    .split(",")
    .map((p) => p.replace(/\.\s*D\.C\./, " D.C.").trim())
    .filter((p, i, todas) => p && p !== todas[i - 1]);
  if (pais && pais.toUpperCase() !== "COLOMBIA") partes.push(pais);
  return partes.join(", ");
}

// ----------------------------------------------------------- consulta ---

async function buscar(cedula: string, nombre: string): Promise<HojaDeVida> {
  // La cédula identifica sin dudas; el nombre se usa cuando la Registraduría no
  // la publicó (2022) o cuando la lista PEP no enlaza la hoja de vida.
  const rows = cedula
    ? await querySocrataDataset<PepRow>(PEP_DATASET, { $where: `numero_documento='${cedula}'`, $limit: 50 })
    : [];
  const ordenadas = [...rows].sort((a, b) => fechaOrden(b.fecha_vinculacion) - fechaOrden(a.fecha_vinculacion));
  // La lista trae filas repetidas (el mismo cargo reportado dos veces).
  const cargos = [
    ...new Map(
      ordenadas.map((r) => {
        const cargo: CargoPublico = {
          cargo: r.denominacion_cargo ?? "",
          entidad: r.nombre_entidad ?? "",
          ...(r.fecha_vinculacion ? { desde: r.fecha_vinculacion } : {}),
          ...(r.fecha_desvinculacion ? { hasta: r.fecha_desvinculacion } : {}),
        };
        return [JSON.stringify(cargo), cargo] as const;
      })
    ).values(),
  ];
  const idPep = ordenadas
    .map((r) => r.enlace_hoja_vida_sigep?.url?.match(/\/detallarHV\/([^/?#]+)$/)?.[1])
    .find((id) => id && id !== "0-0-0");

  let id = idPep;
  let homonimos: PersonaSigep[] = [];
  if (!id && nombre) {
    const ubicada = await ubicarPorNombre(nombre, new Set(ordenadas.map((r) => clave(r.nombre_entidad ?? ""))));
    id = ubicada.fila?.id;
    homonimos = ubicada.homonimos.map((fila) => ({
      nombre: fila.nombre,
      tipo: fila.tipo,
      entidad: fila.entidad,
      lugar: fila.lugar,
      enlace: fila.enlace,
    }));
  }
  const sigep = id ? await leerSigep(id) : null;

  return {
    encontrada: rows.length > 0 || sigep !== null,
    ...(sigep ? { ubicadaPor: idPep ? ("cedula" as const) : ("nombre" as const) } : {}),
    nombre: sigep?.nombre ?? ordenadas[0]?.nombre_pep ?? nombre,
    ...(sigep?.nacimiento ? { nacimiento: sigep.nacimiento } : {}),
    ...(sigep?.cargoActual ? { cargoActual: sigep.cargoActual } : {}),
    cargos,
    formacion: sigep?.formacion ?? [],
    experiencia: sigep?.experiencia ?? [],
    ...(sigep && id ? { enlace: enlaceHv(id) } : {}),
    homonimos,
    busqueda: urlBusqueda(nombre || ordenadas[0]?.nombre_pep || ""),
    fuente: FUENTE,
  };
}

/** Las hojas de vida cambian poco: una semana en caché. */
export const getHojaDeVida = unstable_cache(buscar, ["hoja-de-vida-v2"], { revalidate: 7 * 24 * 3600 });
