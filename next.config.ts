import type { NextConfig } from "next";
import { securityHeaders, securityHeadersPortales } from "./src/config/security-headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "cdn.sanity.io" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  async headers() {
    return [
      {
        // Aplica las cabeceras de seguridad OWASP a todas las rutas.
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Los portales públicos se pueden enmarcar desde el propio sitio (vista previa del editor de diseño).
        source: "/p/:path*",
        headers: securityHeadersPortales,
      },
    ];
  },
};

export default nextConfig;
