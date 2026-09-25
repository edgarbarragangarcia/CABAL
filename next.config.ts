import type { NextConfig } from "next";
import { adminContentSecurityPolicy, securityHeaders } from "./src/config/security-headers";

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
        // Va después: con la misma cabecera, la última regla que coincide gana.
        source: "/admin/:path*",
        headers: [{ key: "Content-Security-Policy", value: adminContentSecurityPolicy }],
      },
    ];
  },
};

export default nextConfig;
