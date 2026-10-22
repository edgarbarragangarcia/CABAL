import { NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/lib/admin-auth";
import { autenticarConSupabase, esPrincipal, supabaseAuthConfigurado, verificarUsuario } from "@/lib/admin-usuarios";

/**
 * Inicio de sesión del panel: el correo y la clave se comprueban en Supabase Auth. Entra el administrador principal (el que marca Supabase) o
 * quien tenga acceso activo en admin_usuarios (con su rol).
 */
export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!supabaseAuthConfigurado()) {
    return NextResponse.json({ ok: false, error: "El servidor no tiene configurado Supabase (faltan SUPABASE_URL y su llave en las variables de Vercel)." }, { status: 503 });
  }
  // Supabase Auth dice si el correo y la clave son correctos; el administrador principal entra con eso, los demás además deben estar dados de alta.
  const claveValida = !!email && !!password && (await autenticarConSupabase(email, password).catch(() => false));
  const principal = claveValida && (await esPrincipal(email).catch(() => false));
  const usuario = !principal && email && password ? await verificarUsuario(email, password).catch(() => null) : null;
  if (!principal && !usuario) {
    // Se distingue «la clave no es» de «la clave es, pero este correo no tiene acceso»: así se sabe qué arreglar.
    return NextResponse.json(
      { ok: false, error: claveValida ? "Supabase aceptó la clave, pero este correo no es el administrador principal ni está dado de alta en el panel." : "Correo o clave incorrectos." },
      { status: claveValida ? 403 : 401 }
    );
  }

  let token: string;
  try {
    token = await createSessionToken(email, usuario?.rol, usuario?.cambiar);
  } catch {
    return NextResponse.json({ ok: false, error: "El servidor no tiene configurado ADMIN_SESSION_SECRET." }, { status: 503 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
