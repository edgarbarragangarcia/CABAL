import Link from "next/link";
import { ArrowUpRight, Bank, ChartLineUp, Gavel, Scales } from "@phosphor-icons/react/dist/ssr";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";

/** Bordes superior e inferior inclinados, paralelos: la misma cuchilla del panel de la portada. */
const CORTE = "clamp(2rem, 5.5vw, 5rem)";
const SILUETA = `polygon(0 ${CORTE}, 100% 0, 100% calc(100% - ${CORTE}), 0 100%)`;

const ITEMS: { href: string; title: string; body: string; tag: string }[] = [
  {
    href: "/academia/observatorio-legislativo",
    title: "Observatorio Legislativo",
    body: "Trazabilidad de cada proyecto de ley relevante: ponencias, votaciones nominales y quién sostuvo qué.",
    tag: "Actualizado semanalmente",
  },
  {
    href: "/academia/observatorio-economico",
    title: "Observatorio Económico",
    body: "Series oficiales sobre gasto, empleo e inflación, leídas sin retórica.",
    tag: "Datos DANE y Socrata",
  },
  {
    href: "/academia/publicaciones",
    title: "Publicaciones",
    body: "Investigación propia y documentos de posición.",
    tag: "Archivo completo",
  },
  {
    href: "/academia/boletines",
    title: "Boletines",
    body: "El resumen de la semana, en cinco minutos.",
    tag: "Suscripción abierta",
  },
];

/**
 * Índice editorial sobre fondo oscuro: el título se queda fijo a la izquierda mientras se recorre la lista de la
 * derecha. Cada fila es un enlace entero; al pasar el cursor se corre el título y el círculo se llena de dorado.
 */
export function Observatories() {
  return (
    <section style={{ clipPath: SILUETA }} className="relative isolate overflow-hidden bg-[#0a0c0b] pb-32 pt-36 text-[#f1efe9] sm:pb-44 sm:pt-48">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-70 [background:radial-gradient(45%_50%_at_8%_20%,rgba(10,79,55,0.55),transparent_65%),radial-gradient(35%_40%_at_96%_90%,rgba(179,137,60,0.22),transparent_60%)]" />
      <div aria-hidden className="bg-grain pointer-events-none absolute inset-0 -z-10 opacity-[0.14] mix-blend-overlay" />
      {/* Íconos de línea finísima, como los del panel de la portada */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden text-white/[0.06] lg:block">
        <Scales weight="thin" className="absolute right-[4%] top-[18%] size-36 rotate-6" />
        <Bank weight="thin" className="absolute right-[30%] bottom-[14%] size-32 -rotate-6" />
        <Gavel weight="thin" className="absolute left-[3%] bottom-[18%] size-28 -rotate-[18deg]" />
        <ChartLineUp weight="thin" className="absolute bottom-[10%] left-[24%] size-28 rotate-6" />
      </div>

      <Container className="grid gap-14 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <span className="eyebrow inline-flex items-center gap-2.5 !text-[#e0bd7c]">
              <span className="h-px w-8 bg-[#e0bd7c]/60" aria-hidden="true" />
              Observatorios
            </span>
            <h2 className="mt-5 max-w-[14ch] text-balance font-display text-4xl font-light leading-[1.08] text-[#f1efe9] sm:text-5xl">
              El debate público <span className="font-bold">merece evidencia</span>
            </h2>
            <p className="mt-6 max-w-xs text-base leading-relaxed text-[#f1efe9]/65">Seguimiento legislativo, series oficiales e investigación propia, siempre con la fuente a la vista.</p>
            <Link href="/academia" className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#e0bd7c]">
              <span className="underline decoration-[#e0bd7c]/40 decoration-2 underline-offset-[6px] transition-colors group-hover:decoration-[#e0bd7c]">Ver todos</span>
              <ArrowUpRight weight="bold" className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        <ol className="border-t border-white/12 lg:col-span-8">
          {ITEMS.map((item, i) => (
            <Reveal as="li" key={item.href} delay={i * 0.07} className="border-b border-white/12">
              <Link href={item.href} className="group relative grid grid-cols-[auto_1fr_auto] items-start gap-x-5 py-8 outline-none focus-visible:ring-2 focus-visible:ring-[#e0bd7c]/60 sm:gap-x-8 sm:py-10">
                <span aria-hidden className="absolute -inset-x-4 inset-y-0 -z-10 rounded-2xl bg-white/[0.045] opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100" />
                <span aria-hidden className="tabular pt-1.5 font-display text-xl text-[#e0bd7c]/60 sm:text-2xl">
                  0{i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-2xl font-normal tracking-tight transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-2 sm:text-[2rem]">{item.title}</h3>
                  <p className="mt-2.5 max-w-lg text-[0.95rem] leading-relaxed text-[#f1efe9]/60">{item.body}</p>
                  <p className="eyebrow mt-4 !text-[0.625rem] !text-[#e0bd7c]/80">{item.tag}</p>
                </div>
                <span className="mt-1 grid size-11 shrink-0 place-items-center rounded-full border border-white/20 transition-all duration-300 group-hover:border-[#e0bd7c] group-hover:bg-[#e0bd7c] group-hover:text-[#1c1405]">
                  <ArrowUpRight weight="bold" className="size-5 transition-transform duration-300 group-hover:rotate-12" aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
