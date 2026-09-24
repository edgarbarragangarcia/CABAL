import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { siteConfig } from "@/config/site";
import { ThemeProvider } from "@/components/animations/theme-provider";
import { SmoothScrollProvider } from "@/components/animations/smooth-scroll-provider";
import { MafeChat } from "@/components/mafe/mafe-chat";

/* Inter para la interfaz: neutral, legible y con cifras tabulares para
   las estadísticas. Fraunces para los titulares: serif variable con eje
   óptico, da el aire editorial/premium sin perder personalidad. */
const sans = Inter({
  variable: "--font-sans-src",
  subsets: ["latin"],
  display: "swap",
});

const display = Fraunces({
  variable: "--font-display-src",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "WONK"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-src",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Educación y desarrollo social en Colombia`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  robots: { index: true, follow: true },
  // PWA: permite "Agregar a pantalla de inicio" en iOS con barra de
  // estado a juego con el tema, sin la barra de Safari.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteConfig.shortName,
  },
  other: {
    // Next.js solo emite el `mobile-web-app-capable` moderno (iOS 17.4+).
    // Este es el que reconocen las versiones de iOS anteriores — sin él,
    // "Agregar a inicio" abre igual, pero con la barra de Safari visible
    // en vez de verse como una app instalada.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ece4d3" },
    { media: "(prefers-color-scheme: dark)", color: "#070908" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-CO"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        {/* Script anti-parpadeo como archivo estático con `src` (no inline
            dangerouslySetInnerHTML): React 19 solo aplica su hoisting de
            recursos —y evita el aviso de "script tag" en hidratación— a
            <script> con `src`; uno inline dispara la advertencia incluso
            dentro de un Server Component. */}
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body className="h-full antialiased">
        <ThemeProvider>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
          {/* MaFe en todas las páginas: sitio público y panel administrativo. */}
          <MafeChat />
        </ThemeProvider>
      </body>
    </html>
  );
}
