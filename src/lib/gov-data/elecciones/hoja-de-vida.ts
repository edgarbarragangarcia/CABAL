import "server-only";

import https from "node:https";
import tls from "node:tls";
import { unstable_cache } from "next/cache";

import { querySocrataDataset } from "../socrata";

/**
 * Hoja de vida pública de un candidato, de fuentes oficiales de Función
 * Pública:
 * - "Personas Expuestas Políticamente (PEP)" en datos.gov.co (3qxn-uc22):
 *   cargos públicos por cédula, con el enlace a su hoja de vida en el SIGEP.
 * - La hoja de vida del SIGEP (directorio de servidores públicos): formación
 *   académica y experiencia laboral, publicadas por la Ley de Transparencia.
 * Solo tienen hoja de vida quienes han sido servidores públicos; el resto
 * de candidatos no aparece.
 */

const PEP_DATASET = "3qxn-uc22";
const SIGEP_HOST = "www1.funcionpublica.gov.co";
const SIGEP_PATH = "/dafpIndexerBHV/hvSigep/detallarHV/";

export type CargoPublico = { cargo: string; entidad: string; desde?: string; hasta?: string };
export type Experiencia = { cargo: string; entidad: string; inicio: string; fin: string };

export type HojaDeVida = {
  encontrada: boolean;
  nombre?: string;
  nacimiento?: string;
  cargos: CargoPublico[];
  formacion: string[];
  experiencia: Experiencia[];
  enlace?: string;
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

function getHtml(url: URL): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ca: CA, timeout: 15_000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        resolve(null);
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

/** La página del SIGEP es HTML de plantilla fija: se leen sus tres bloques. */
async function leerSigep(url: string) {
  const u = new URL(url);
  if (u.hostname !== SIGEP_HOST || !u.pathname.startsWith(SIGEP_PATH)) return null;
  const html = await getHtml(u);
  if (!html) return null;

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
  const nombre = html.match(/<p class="nombre_funcionario">([\s\S]*?)<\/p>/)?.[1];
  return {
    formacion,
    experiencia,
    nacimiento: nacimiento ? texto(nacimiento).replace(/\s*,\s*/g, ", ").replace(/ - /g, " · ") : undefined,
    nombre: nombre ? texto(nombre) : undefined,
  };
}

async function buscar(cedula: string): Promise<HojaDeVida> {
  // Solo por cédula: por nombre aparecen homónimos (otro "Federico Gutiérrez"),
  // y mostrar la hoja de vida de otra persona sería peor que no mostrar nada.
  const rows = await querySocrataDataset<PepRow>(PEP_DATASET, {
    $where: `numero_documento='${cedula}'`,
    $limit: 50,
  });
  if (rows.length === 0) return { encontrada: false, cargos: [], formacion: [], experiencia: [], fuente: FUENTE };

  const ordenadas = [...rows].sort((a, b) => fechaOrden(b.fecha_vinculacion) - fechaOrden(a.fecha_vinculacion));
  const cargos = ordenadas.map((r) => ({
    cargo: r.denominacion_cargo ?? "",
    entidad: r.nombre_entidad ?? "",
    ...(r.fecha_vinculacion ? { desde: r.fecha_vinculacion } : {}),
    ...(r.fecha_desvinculacion ? { hasta: r.fecha_desvinculacion } : {}),
  }));
  const enlace = ordenadas
    .map((r) => r.enlace_hoja_vida_sigep?.url)
    .find((url) => url && !url.endsWith("/0-0-0"));

  let sigep: Awaited<ReturnType<typeof leerSigep>> = null;
  if (enlace) {
    try {
      sigep = await leerSigep(enlace);
    } catch {
      sigep = null;
    }
  }
  return {
    encontrada: true,
    nombre: sigep?.nombre ?? ordenadas[0].nombre_pep,
    ...(sigep?.nacimiento ? { nacimiento: sigep.nacimiento } : {}),
    cargos,
    formacion: sigep?.formacion ?? [],
    experiencia: sigep?.experiencia ?? [],
    ...(enlace ? { enlace } : {}),
    fuente: FUENTE,
  };
}

/** Las hojas de vida cambian poco: una semana en caché. */
export const getHojaDeVida = unstable_cache(buscar, ["hoja-de-vida-v1"], { revalidate: 7 * 24 * 3600 });
