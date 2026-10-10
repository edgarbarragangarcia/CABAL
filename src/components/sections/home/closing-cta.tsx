import Link from "next/link";
import { ArrowRight, HandHeart, Receipt, ShieldCheck, UsersThree } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";

const GARANTIAS = [
  { icono: Receipt, texto: "Donación deducible" },
  { icono: ShieldCheck, texto: "Pago seguro" },
  { icono: HandHeart, texto: "Sin permanencia" },
];

/** Cierre en una losa de verde bosque con filos dorados: una sola idea, una sola acción. */
export function ClosingCta() {
  return (
    <section className="relative py-20 sm:py-28">
      <Container>
        <div className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0f6b4c] via-[#0a4f37] to-[#06281c] px-6 py-16 text-center text-[#f1efe9] shadow-[0_50px_100px_-40px_rgba(6,40,28,0.9)] sm:rounded-[2.5rem] sm:px-12 sm:py-24">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(60%_70%_at_50%_0%,rgba(224,189,124,0.22),transparent_70%),radial-gradient(45%_60%_at_100%_100%,rgba(0,0,0,0.35),transparent_70%)]" />
          <div aria-hidden className="bg-grain pointer-events-none absolute inset-0 -z-10 opacity-[0.12] mix-blend-overlay" />
          <span aria-hidden className="absolute inset-x-[12%] top-0 h-px bg-gradient-to-r from-transparent via-[#e0bd7c]/80 to-transparent" />
          <svg aria-hidden="true" viewBox="0 0 400 400" className="pointer-events-none absolute -left-24 -top-24 -z-10 size-[24rem] text-[#e0bd7c]/20">
            {[70, 120, 170].map((r) => <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="currentColor" strokeWidth="1" />)}
          </svg>

          <Reveal>
            <span className="eyebrow inline-flex items-center gap-2.5 !text-[#e0bd7c]">
              <span className="h-px w-8 bg-[#e0bd7c]/60" aria-hidden="true" />
              Súmate
              <span className="h-px w-8 bg-[#e0bd7c]/60" aria-hidden="true" />
            </span>
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="mx-auto mt-6 max-w-[15ch] text-balance font-display text-[2.5rem] font-normal leading-[1.05] tracking-[-0.025em] sm:text-6xl lg:text-7xl">
              Cada aporte se vuelve <span className="italic text-[#e0bd7c]">una clase</span>
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-[#f1efe9]/75">
              Financiamos becas, materiales y presencia en territorio. El informe de ejecución es público, y siempre lo será.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="accent" className="shadow-[0_22px_44px_-18px_rgba(224,189,124,0.8)]">
                <Link href="/donar">
                  <HandHeart weight="duotone" className="!size-5" aria-hidden="true" />
                  Donar ahora
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/5 text-[#f1efe9] hover:border-white/50 hover:bg-white/10">
                <Link href="/unete">
                  <UsersThree weight="duotone" className="!size-5" aria-hidden="true" />
                  Unirme a la comunidad
                  <ArrowRight weight="bold" className="!size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.32}>
            <ul className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[0.7rem] font-semibold tracking-[0.16em] text-[#f1efe9]/65 uppercase">
              {GARANTIAS.map((g) => (
                <li key={g.texto} className="flex items-center gap-2">
                  <g.icono weight="duotone" className="size-5 text-[#e0bd7c]" aria-hidden="true" />
                  {g.texto}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
