import { NextResponse } from "next/server";

import { limitar } from "@/lib/comunidad/api";
import { nombreValido } from "@/lib/comunidad/cedula-ocr";
import { ErrorIa, generarConImagen } from "@/lib/ia-config";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `Lees fotos de cédulas de ciudadanía colombianas (la amarilla con hologramas o la digital de policarbonato, frente o reverso) para rellenar un formulario de afiliación. Copia SOLO lo que se lea con claridad, letra por letra; si un dato está borroso, tapado por un reflejo o no se ve, déjalo vacío. NUNCA inventes, completes ni "corrijas" nombres. Ignora hologramas, marcas de agua, la foto y las huellas.
El número está junto a «NÚMERO» o «NUIP» (por ejemplo 1.234.567.890 o 79.153.093). «APELLIDOS» y «NOMBRES» son campos distintos; en el reverso está la «FECHA DE NACIMIENTO», no la de expedición.
Responde ÚNICAMENTE con un JSON: {"esCedula": true|false, "cedula": "solo dígitos, sin puntos", "apellidos": "ambos apellidos tal como están impresos", "nombres": "todos los nombres tal como están impresos", "fechaNacimiento": "AAAA-MM-DD o vacío"}
Si la imagen no es una cédula colombiana, "esCedula": false.`;

const cad = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Pública (quien se afilia aún no tiene cuenta). La imagen se lee en memoria y NO se guarda. */
export async function POST(req: Request) {
  const limite = await limitar(req, "leer-cedula");
  if (limite) return limite;
  const body = await req.json().catch(() => null);
  const m = typeof body?.imagen === "string" ? body.imagen.match(/^data:(image\/jpeg|image\/png);base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!m || m[2].length > 3_000_000) return NextResponse.json({ error: "La foto no es válida o es muy pesada. Toma otra." }, { status: 400 });
  try {
    const texto = await generarConImagen({ system: SYSTEM, user: "Lee esta cédula.", imagenBase64: m[2], mime: m[1] as "image/jpeg" | "image/png", maxTokens: 600 });
    const ini = texto.indexOf("{");
    const fin = texto.lastIndexOf("}");
    if (ini < 0 || fin <= ini) throw new ErrorIa("ia_error", "La IA no devolvió JSON.");
    const j = JSON.parse(texto.slice(ini, fin + 1));
    const cedula = cad(j.cedula).replace(/\D/g, "").replace(/^0+/, "");
    if (j.esCedula === false || cedula.length < 5 || cedula.length > 10) return NextResponse.json({ codigo: "ilegible", error: "No pude leer la cédula en esa foto. Acércate, con buena luz y sin reflejos, e intenta de nuevo." }, { status: 422 });
    const f = cad(j.fechaNacimiento);
    // Un nombre que no parece un nombre se descarta: es mejor que la persona lo escriba a que quede basura.
    const nombreOk = (v: unknown, max: number) => {
      const t = cad(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-ZÑ ]/g, " ").replace(/\s+/g, " ").trim();
      return nombreValido(t, max) ? cad(v).replace(/\s+/g, " ") : "";
    };
    return NextResponse.json({ cedula, apellidos: nombreOk(j.apellidos, 5), nombres: nombreOk(j.nombres, 4), fechaNacimiento: /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null });
  } catch (e) {
    // Sin clave de IA o con la IA caída, la pantalla pasa sola a leer la foto en el teléfono.
    const codigo = e instanceof ErrorIa ? e.codigo : "ia_error";
    console.error("[leer-cedula]", codigo, e instanceof Error ? e.message : e);
    return NextResponse.json({ codigo, error: "El lector inteligente no está disponible ahora." }, { status: codigo === "sin_clave" ? 503 : 502 });
  }
}
