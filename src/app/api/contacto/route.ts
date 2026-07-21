import { NextResponse } from "next/server";
import DOMPurify from "isomorphic-dompurify";
import { contactFormSchema } from "@/lib/validations/contact";

export const runtime = "nodejs";

/**
 * Elimina cualquier marcado HTML/script de un texto de entrada. Aunque los
 * campos ya se validan con Zod, se sanitiza defensivamente antes de
 * persistir o reenviar el contenido (defensa en profundidad contra XSS).
 */
function sanitize(value: string): string {
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido." }, { status: 400 });
  }

  const parsed = contactFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos.", issues: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  // Campo honeypot: si viene relleno, se responde 200 "silencioso" para no
  // delatar la trampa a bots automatizados.
  if (parsed.data.website) {
    return NextResponse.json({ success: true });
  }

  const sanitized = {
    name: sanitize(parsed.data.name),
    email: sanitize(parsed.data.email),
    phone: parsed.data.phone ? sanitize(parsed.data.phone) : undefined,
    subject: sanitize(parsed.data.subject),
    message: sanitize(parsed.data.message),
  };

  // TODO de integración (no placeholder de UI): aquí se conecta el envío
  // real — p. ej. persistir en Supabase (tabla `contact_messages`) y/o
  // notificar por correo transaccional (Resend, SES). Se deja fuera del
  // alcance de este endpoint porque requiere credenciales del proyecto.
  console.info("Nuevo mensaje de contacto recibido", {
    subject: sanitized.subject,
    email: sanitized.email,
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
