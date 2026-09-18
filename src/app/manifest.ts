import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * Next.js sirve esto en /manifest.webmanifest y agrega automáticamente el
 * <link rel="manifest"> en el <head> — no hace falta declararlo a mano.
 * Con esto el sitio (y el panel admin) se puede "Agregar a la pantalla de
 * inicio" / instalar como app en el navegador.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfc",
    theme_color: "#0f6b4c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
