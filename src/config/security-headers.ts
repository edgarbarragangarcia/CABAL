/**
 * Cabecera de seguridad centralizada (OWASP Secure Headers).
 * Se aplica globalmente desde `next.config.ts`.
 */

// CSP en modo estricto. Next.js requiere 'unsafe-inline' en style-src para
// los estilos inyectados en runtime (Framer Motion / Tailwind JIT), y
// 'wasm-unsafe-eval' es necesario para algunas optimizaciones de Next 15+.
// En desarrollo, React usa eval() para funciones de depuración (Fast
// Refresh, stack traces): se permite 'unsafe-eval' solo fuera de
// producción para no debilitar la política del sitio desplegado.
// Ajusta connect-src si agregas Supabase / Sanity / pasarelas de pago.
// El micrófono se permite solo para el propio sitio (el asistente de voz del panel): ninguna página incrustada de terceros puede usarlo.
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${isDev ? "'unsafe-eval'" : ""} https://vercel.live https://accounts.google.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self' data:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://audio.wherrera.com https://www.googleapis.com https://accounts.google.com;
  media-src 'self' blob: https://audio.wherrera.com;
  frame-src 'self' https://checkout.wompi.co https://checkout.bold.co https://www.youtube.com https://accounts.google.com;
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

export const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(self), geolocation=(), interest-cohort=(), browsing-topics=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
];

/**
 * Los portales públicos (/p/*) pueden mostrarse dentro del propio sitio: el editor de diseño del panel los enseña en un marco con
 * el borrador aplicado. Solo el mismo origen puede enmarcarlos (nadie más): las demás rutas siguen sin poder enmarcarse.
 */
export const securityHeadersPortales = securityHeaders.map((h) => {
  if (h.key === "X-Frame-Options") return { ...h, value: "SAMEORIGIN" };
  if (h.key === "Content-Security-Policy") return { ...h, value: h.value.replace("frame-ancestors 'none'", "frame-ancestors 'self'") };
  return h;
});
