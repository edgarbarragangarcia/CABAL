import Image from "next/image";
import Link from "next/link";
import { ArrowRight, HandHeart, Receipt, ShieldCheck } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";

const GARANTIAS = [
  { icono: Receipt, texto: "Donación deducible" },
  { icono: ShieldCheck, texto: "Pago seguro" },
  { icono: HandHeart, texto: "Sin permanencia" },
];

/**
 * Cierre en una losa de verde bosque. En pantallas anchas el retrato asoma por encima del borde de la losa (la misma
 * idea que el panel de la portada): la losa vive en su propia capa recortada y el retrato queda fuera de ese recorte.
 */
export function ClosingCta() {
  return (
    <section className="relative pb-20 pt-16 sm:pb-28 lg:pt-40">
      <Container>
        <div className="relative">
          {/* Capa de la losa: aquí sí se recorta el brillo y la textura */}
          <div aria-hidden className="absolute inset-0 isolate overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0f6b4c] via-[#0a4f37] to-[#06281c] shadow-[0_50px_100px_-40px_rgba(6,40,28,0.9)] sm:rounded-[2.5rem]">
            <div className="absolute inset-0 [background:radial-gradient(60%_70%_at_20%_0%,rgba(224,189,124,0.2),transparent_70%),radial-gradient(38%_70%_at_82%_60%,rgba(48,170,120,0.5),transparent_72%),radial-gradient(45%_60%_at_100%_100%,rgba(0,0,0,0.35),transparent_70%)]" />
            <div className="bg-grain absolute inset-0 opacity-[0.12] mix-blend-overlay" />
            <span className="absolute inset-x-[12%] top-0 h-px bg-gradient-to-r from-transparent via-[#e0bd7c]/80 to-transparent" />
            <svg viewBox="0 0 400 400" className="absolute -left-24 -top-24 size-[24rem] text-[#e0bd7c]/12">
              {[70, 120, 170].map((r) => (
                <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="currentColor" strokeWidth="1" />
              ))}
            </svg>
          </div>

          {/* Aro dorado detrás de la cabeza: cruza el borde de la losa */}
          <span aria-hidden className="pointer-events-none absolute right-[7%] -top-24 hidden size-[22rem] rounded-full border border-[#e0bd7c]/40 lg:block" />
          <Image
            src="/cabal-recorte.webp"
            alt=""
            width={928}
            height={1456}
            sizes="(min-width: 1024px) 440px, 0px"
            className="pointer-events-none absolute bottom-0 right-[5%] hidden h-[calc(100%+7rem)] w-auto max-w-none drop-shadow-[0_24px_30px_rgba(2,18,12,0.45)] lg:block"
          />

          <div className="relative grid px-6 py-16 text-center text-[#f1efe9] sm:px-12 sm:py-20 lg:grid-cols-12 lg:py-24 lg:text-left">
            <div className="lg:col-span-7">
              <Reveal>
                <span className="eyebrow inline-flex items-center gap-2.5 !text-[#e0bd7c]">
                  <span className="h-px w-8 bg-[#e0bd7c]/60" aria-hidden="true" />
                  Súmate
                  <span className="h-px w-8 bg-[#e0bd7c]/60 lg:hidden" aria-hidden="true" />
                </span>
              </Reveal>

              <Reveal delay={0.08}>
                <h2 className="mx-auto mt-6 max-w-[15ch] text-balance font-display text-[2.5rem] font-light leading-[1.05] tracking-[-0.025em] sm:text-6xl lg:mx-0 lg:text-7xl">
                  Cada aporte se vuelve <span className="font-bold italic text-[#e0bd7c]">una clase</span>
                </h2>
              </Reveal>

              <Reveal delay={0.16}>
                <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-[#f1efe9]/75 lg:mx-0">
                  Financiamos becas, materiales y presencia en territorio. El informe de ejecución es público, y siempre lo será.
                </p>
              </Reveal>

              <Reveal delay={0.24}>
                <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                  <Button asChild size="lg" variant="accent" className="h-14 gap-3 pl-2 pr-7 text-base shadow-[0_22px_44px_-18px_rgba(224,189,124,0.8)]">
                    <Link href="/donar">
                      <span className="grid size-10 place-items-center rounded-full bg-[#06281c] text-[#e0bd7c]">
                        <HandHeart weight="bold" className="!size-5" aria-hidden="true" />
                      </span>
                      Donar ahora
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-14 border-[1.5px] border-white/40 bg-transparent px-7 text-base text-[#f1efe9] hover:border-white hover:bg-white hover:text-[#06281c]">
                    <Link href="/proyectos">
                      Conocer los programas
                      <ArrowRight weight="bold" className="!size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </Reveal>

              <Reveal delay={0.32}>
                <ul className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[0.7rem] font-semibold tracking-[0.16em] text-[#f1efe9]/65 uppercase lg:justify-start">
                  {GARANTIAS.map((g) => (
                    <li key={g.texto} className="flex items-center gap-2">
                      <g.icono weight="duotone" className="size-5 text-[#e0bd7c]" aria-hidden="true" />
                      {g.texto}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
