import "server-only";

/**
 * Envío de correo del CRM. El proyecto no trae proveedor: se usa Resend si se configuran RESEND_API_KEY y CORREO_DESDE
 * (por ejemplo «Salud en Comunidad <hola@tudominio.com>», con el dominio verificado en Resend). Sin eso, el CRM prepara y
 * exporta pero no envía, y la pantalla lo dice.
 */

export type Mensaje = { para: string; asunto: string; html: string; texto: string; encabezados?: Record<string, string> };

export function correoConfigurado(): { listo: boolean; proveedor: "resend" | null; desde: string | null } {
  const llave = process.env.RESEND_API_KEY;
  const desde = process.env.CORREO_DESDE?.trim() || null;
  return { listo: !!llave && !!desde, proveedor: llave ? "resend" : null, desde };
}

type ResultadoLote = { enviados: number; fallidos: number; errores: string[] };

/** Envía hasta 100 correos por petición (el lote de Resend). Un lote que falla cuenta todos sus correos como fallidos. */
export async function enviarCorreos(mensajes: Mensaje[]): Promise<ResultadoLote> {
  const { listo, desde } = correoConfigurado();
  if (!listo || !desde) throw new Error("No hay un proveedor de correo configurado (RESEND_API_KEY y CORREO_DESDE).");
  const total: ResultadoLote = { enviados: 0, fallidos: 0, errores: [] };
  for (let i = 0; i < mensajes.length; i += 100) {
    const lote = mensajes.slice(i, i + 100);
    try {
      const r = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(lote.map((m) => ({ from: desde, to: [m.para], subject: m.asunto, html: m.html, text: m.texto, headers: m.encabezados }))),
        signal: AbortSignal.timeout(25_000),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        total.fallidos += lote.length;
        total.errores.push(`Resend respondió ${r.status}: ${t.slice(0, 160)}`);
      } else total.enviados += lote.length;
    } catch (e) {
      total.fallidos += lote.length;
      total.errores.push(e instanceof Error ? e.message : "Fallo de red al enviar.");
    }
  }
  return total;
}
