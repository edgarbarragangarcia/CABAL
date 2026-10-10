import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import { ArrowRight, ChatsCircle, IdentificationCard, UsersThree } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { Eyebrow } from "@/components/fx/eyebrow";

const PASOS: { n: string; titulo: string; texto: string; icono: Icon }[] = [
  {
    n: "01",
    titulo: "Afíliate",
    texto: "Completa tus datos y crea tu cuenta en unos minutos. Tu cédula, tu teléfono y tu dirección no son públicos.",
    icono: IdentificationCard,
  },
  {
    n: "02",
    titulo: "Conecta",
    texto: "Sigue a María Fernanda Cabal y a otros afiliados, y entra a los grupos de tu municipio y de tu barrio.",
    icono: UsersThree,
  },
  {
    n: "03",
    titulo: "Participa",
    texto: "Publica en el muro, comenta y entérate de lo que hace la Fundación donde tú vives.",
    icono: ChatsCircle,
  },
];

/** La comunidad de afiliados: qué es y cómo entrar, en tres pasos con filetes. Una sola acción principal. */
export function Community() {
  return (
    <section className="relative py-24 sm:py-32">
      <Container className="grid gap-14 lg:grid-cols-12 lg:gap-12">
        <Reveal className="lg:col-span-5">
          <Eyebrow>Comunidad</Eyebrow>
          <h2 className="mt-5 max-w-[14ch] text-balance font-display text-4xl font-light leading-[1.08] sm:text-5xl">
            Una red de afiliados, <span className="font-bold">barrio por barrio</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            Afíliate, crea tu perfil y conversa con quienes comparten tu municipio y tu barrio. De ti solo se ve tu nombre, tu barrio y lo que decidas publicar.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button asChild size="lg" className="h-14 gap-3 bg-[#06281c] pl-2 pr-7 text-base text-[#f1efe9] shadow-[0_24px_44px_-16px_rgba(6,40,28,0.75)] hover:bg-[#0a3a29] dark:bg-[#0d5e42] dark:hover:bg-[#12714f]">
              <Link href="/unete">
                <span className="grid size-10 place-items-center rounded-full bg-[#e0bd7c] text-[#1c1405]">
                  <ArrowRight weight="bold" className="!size-5" aria-hidden="true" />
                </span>
                Afiliarme
              </Link>
            </Button>
            <Link href="/comunidad/ingresar" className="group inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="underline decoration-accent/60 decoration-2 underline-offset-[6px] transition-colors group-hover:decoration-accent">Ya soy afiliado</span>
            </Link>
          </div>
        </Reveal>

        <ol className="border-t border-border lg:col-span-7">
          {PASOS.map((p, i) => (
            <Reveal as="li" key={p.n} delay={i * 0.08} className="border-b border-border">
              <div className="group grid grid-cols-[3.25rem_1fr_auto] items-start gap-x-5 py-8 sm:grid-cols-[4.5rem_1fr_auto] sm:gap-x-8 sm:py-10">
                <span aria-hidden className="tabular font-display text-4xl leading-none text-accent/55 sm:text-5xl">
                  {p.n}
                </span>
                <div>
                  <h3 className="font-display text-2xl font-normal tracking-tight sm:text-[2rem]">{p.titulo}</h3>
                  <p className="mt-2.5 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">{p.texto}</p>
                </div>
                <p.icono weight="duotone" aria-hidden="true" className="size-9 text-brand transition-transform duration-500 group-hover:-translate-y-1" />
              </div>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
