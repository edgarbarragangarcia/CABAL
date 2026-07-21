import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";

export const metadata: Metadata = {
  title: "Proyectos",
  description: "Explora los programas e iniciativas activas de la Fundación Escuela Libertad.",
};

const PROJECTS = [
  {
    name: "Escuelas que Transforman",
    category: "Educación",
    description:
      "Fortalecimiento de instituciones educativas rurales con formación docente y dotación escolar.",
  },
  {
    name: "Rutas de Futuro",
    category: "Empleabilidad juvenil",
    description:
      "Formación técnica y acompañamiento para la inserción laboral de jóvenes en zonas vulnerables.",
  },
  {
    name: "Comunidad Libertad",
    category: "Desarrollo comunitario",
    description:
      "Programas de liderazgo local y fortalecimiento del tejido social en comunidades priorizadas.",
  },
];

export default function ProyectosPage() {
  return (
    <Container as="section" className="py-32">
      <Reveal className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Proyectos</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Programas activos con impacto medible en educación, empleabilidad y
          desarrollo comunitario.
        </p>
      </Reveal>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PROJECTS.map((project, i) => (
          <Reveal
            key={project.name}
            delay={i * 0.08}
            className="group rounded-2xl border border-border bg-surface p-8 transition-shadow hover:shadow-xl"
          >
            <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
              {project.category}
            </span>
            <h2 className="mt-4 text-lg font-semibold">{project.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
          </Reveal>
        ))}
      </div>
    </Container>
  );
}
