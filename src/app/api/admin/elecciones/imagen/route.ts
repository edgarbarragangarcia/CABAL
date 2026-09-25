import { findEleccion, type EleccionInfo } from "@/lib/gov-data/elecciones/catalogo";

/**
 * Logos de partido y fotos de candidato, tal como los publica la
 * Registraduría en cada sitio de preconteo. Se sirven desde aquí (y quedan
 * en la caché de Vercel) para no depender de que el navegador llegue a sus
 * servidores. `?e=<elección>&t=partido|candidato&logo=<codpar del
 * nomenclátor>&codcan=&sorteo=&cedula=`.
 */

type Params = { tipo: string; logo: string; codcan: string; sorteo: string; cedula: string };

/** Nombres de archivo posibles, en orden, según la generación del sitio (vistos en sus bundles y en web.archive.org). */
function rutas(e: EleccionInfo, { tipo, logo, codcan, sorteo, cedula }: Params): string[] {
  const p4 = logo.padStart(4, "0");
  const p5 = logo.padStart(5, "0");
  const c3 = codcan.padStart(3, "0");
  const s3 = sorteo ? sorteo.padStart(3, "0") : "";
  const partido = tipo === "partido";
  const out: (string | false)[] = e.id.startsWith("presidencia-2026")
    ? partido
      ? [`/logos/${p5}.jpg`, `/logos/${p5}.png`]
      : [codcan && `/logos/${c3}-${p5}-P.png`, !!s3 && `/logos/${s3}-${p5}-P.png`, !!cedula && `/logos/${cedula}.png`]
    : e.id === "congreso-2026"
      ? partido
        ? [`/logos/${p5}.png`, `/logos/${p5}.jpg`]
        : [!!cedula && `/logos/${cedula}.png`, codcan && `/logos/${p5}_${codcan}.png`]
      : e.id === "territoriales-2023"
        ? partido
          ? [`/logos/${p4}.png`]
          : [!!cedula && `/fotos/${cedula}.jpg`, !!cedula && `/fotos/${cedula}.png`]
        : e.id.startsWith("presidencia-2022")
          ? partido
            ? [`/assets/img/logo/${p4}.png`]
            : [codcan && `/assets/img/candidatos/${c3}-${p4}-P.webp`]
          : partido
            ? [`/assets/img/logo/${p4}.png`]
            : [codcan && `/assets/img/candidatos/${c3}-${p4}.png`];
  return out.filter((x): x is string => !!x);
}

const digits = (v: string | null) => (v && /^\d{1,12}$/.test(v) ? v : "");

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eleccion = findEleccion(searchParams.get("e"));
  const params: Params = {
    tipo: searchParams.get("t") === "candidato" ? "candidato" : "partido",
    logo: digits(searchParams.get("logo")),
    codcan: digits(searchParams.get("codcan")),
    sorteo: digits(searchParams.get("sorteo")),
    cedula: digits(searchParams.get("cedula")),
  };
  if (!eleccion || (!params.logo && !params.cedula)) {
    return new Response(null, { status: 400 });
  }

  for (const ruta of rutas(eleccion, params)) {
    try {
      const res = await fetch(`https://${eleccion.host}.registraduria.gov.co${ruta}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) continue;
      return new Response(await res.arrayBuffer(), {
        headers: {
          "Content-Type": type,
          // Imágenes de una elección cerrada: no cambian.
          "Cache-Control": "public, max-age=604800, s-maxage=31536000, immutable",
        },
      });
    } catch {
      // Siguiente nombre posible.
    }
  }
  // Sin imagen: el cliente muestra iniciales. Se cachea un día para no volver a preguntar.
  return new Response(null, { status: 404, headers: { "Cache-Control": "public, s-maxage=86400" } });
}
