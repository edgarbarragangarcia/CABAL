import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comunidad · Fundación Escuela Libertad",
  description: "Afíliate y sé parte de la comunidad de María Fernanda Cabal y la Fundación Escuela Libertad.",
};

/** Sin cromo del sitio: la comunidad se ve y se siente como una app, sobre todo en el celular. */
export default function ComunidadLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-surface-muted text-foreground">{children}</div>;
}
