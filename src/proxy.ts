import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { siteConfig } from "@/config/site";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";

// Rutas de API que mutan estado (contacto, donaciones, newsletter) y por
// tanto requieren rate limiting + verificación de origen (defensa CSRF).
const PROTECTED_API_PREFIX = "/api/";

const ALLOWED_ORIGINS = new Set(
  [siteConfig.url, "http://localhost:3000"].map((url) => new URL(url).origin)
);

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "127.0.0.1";
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  // Las solicitudes same-origin de navegadores modernos incluyen el header
  // Origin en peticiones mutantes (POST/PUT/PATCH/DELETE). Si no viene,
  // se valida contra el header Referer como respaldo.
  if (origin) return ALLOWED_ORIGINS.has(origin);

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return ALLOWED_ORIGINS.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }

  // Sin Origin ni Referer: se rechaza por precaución en mutaciones.
  return false;
}

/** Protege /admin/* con la sesión de admin-auth (usuario fijo, sin BD). */
async function guardAdmin(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/admin/login";

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (session && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const redirect = await guardAdmin(request);
    if (redirect) return redirect;
  }

  if (!pathname.startsWith(PROTECTED_API_PREFIX)) {
    return NextResponse.next();
  }

  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);

  if (isMutation && !isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Origen de la solicitud no permitido." },
      { status: 403 }
    );
  }

  if (isMutation) {
    const ip = getClientIp(request);
    const result = await rateLimit(`${pathname}:${ip}`);

    if (!result.success) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Intenta de nuevo en un momento." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((result.reset - Date.now()) / 1000).toString(),
            "X-RateLimit-Limit": result.limit.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
          },
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
};
