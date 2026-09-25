import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MapPin, Users } from "lucide-react";

import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/sections/page-header";
import { Reveal } from "@/components/animations/reveal";

export const metadata: Metadata = {
  title: "Proyectos",
  description:
    "Explora los programas e iniciativas activas de la Fundación Escuela Libertad.",
};

/**
 * `reach` / `people` en `null` = cobertura aún no verificada: la fila no
 * muestra la línea de datos en vez de inventar una cifra. Al tener el
 * dato real, basta con poner la cadena.
 */
type Project = {
  n: string;
  name: string;
  category: string;
  description: string;
  reach: string | null;
  people: string | null;
  tint: string;
};

const PROJECTS: Project[] = [
  {
    n: "01",
    name: "Escuelas que Transforman",
    category: "Educación",
    description:
      "Fortalecimiento de instituciones educativas rurales con formación docente y dotación escolar. Trabajamos con el rector y el cuerpo docente durante todo el año lectivo, no con una visita y una foto.",
    reach: null,
    people: null,
    // Cada programa lleva su propio ángulo de degradado: sin fotografía,
    // es lo que le da identidad visible a cada tarjeta.
    tint: "from-[#0a4f37] to-[#0d7a54]",
  },
  {
    n: "02",
    name: "Rutas de Futuro",
    category: "Empleabilidad juvenil",
    description:
      "Formación técnica y acompañamiento para la inserción laboral de jóvenes en zonas vulnerables, con empresas aliadas que se comprometen a contratar antes de que empiece el curso.",
    reach: null,
    people: null,
    tint: "from-[#8a6520] to-[#c79a4a]",
  },
  {
    n: "03",
    name: "Comunidad Libertad",
    category: "Desarrollo comunitario",
    description:
      "Programas de liderazgo local y fortalecimiento del tejido social en comunidades priorizadas, diseñados con las juntas de acción comunal que después los sostienen.",
    reach: null,
    people: null,
    tint: "from-[#123a2c] to-[#3fcf97]",
  },
];

export default function ProyectosPage() {
  return (
    <>
      <PageHeader
        eyebrow="Proyectos"
        title="Programas con impacto medible"
        description="Educación, empleabilidad y desarrollo comunitario. Tres frentes activos, con cifras de cobertura que actualizamos cada trimestre."
      />

      {/* Filas grandes alternadas en vez de tres tarjetas pequeñas: cada
          programa recibe el ancho suficiente para contarse. */}
      <Container as="section" className="pb-24 sm:pb-32">
        <div className="border-t border-border">
          {PROJECTS.map((p, i) => (
            <Reveal key={p.n} delay={i * 0.08}>
              <article className="group grid gap-8 border-b border-border py-12 lg:grid-cols-12 lg:gap-12 lg:py-16">
                {/* Placa de color: sustituye a la fotografía que aún no
                    existe, sin recurrir a un stock genérico. */}
                <div
                  // `lg:order-2` alterna el lado de la placa. Sin una clase
                  // de orden que compita: dos utilidades de `order` sobre el
                  // mismo elemento se resuelven por orden en el CSS, no por
                  // el que se escriba último aquí.
                  className={`relative aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br ${p.tint} lg:col-span-5 lg:aspect-[4/3] ${
                    i % 2 === 1 ? "lg:order-2" : ""
                  }`}
                >
                  <div
                    className="bg-grain absolute inset-0 opacity-25 mix-blend-overlay"
                    aria-hidden="true"
                  />
                  <span
                    className="absolute -bottom-8 -right-4 select-none font-display text-[10rem] leading-none text-white/10 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2"
                    aria-hidden="true"
                  >
                    {p.n}
                  </span>
                  <span className="absolute left-6 top-6 rounded-full bg-black/25 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                    {p.category}
                  </span>
                </div>

                <div className="flex flex-col justify-center lg:col-span-7">
                  <h2 className="font-display text-3xl font-normal leading-tight tracking-tight sm:text-[2.75rem]">
                    {p.name}
                  </h2>
                  <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {p.description}
                  </p>

                  {(p.reach || p.people) && (
                    <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
                      {p.reach && (
                        <div className="flex items-center gap-2.5">
                          <MapPin
                            className="size-4 text-accent-ink"
                            aria-hidden="true"
                          />
                          <dt className="sr-only">Cobertura</dt>
                          <dd className="text-sm font-medium">{p.reach}</dd>
                        </div>
                      )}
                      {p.people && (
                        <div className="flex items-center gap-2.5">
                          <Users
                            className="size-4 text-accent-ink"
                            aria-hidden="true"
                          />
                          <dt className="sr-only">Beneficiarios</dt>
                          <dd className="text-sm font-medium">{p.people}</dd>
                        </div>
                      )}
                    </dl>
                  )}

                  <Link
                    href="/contacto"
                    className="mt-8 inline-flex items-center gap-2 self-start text-sm font-medium text-brand"
                  >
                    Quiero apoyar este programa
                    <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </>
  );
}
