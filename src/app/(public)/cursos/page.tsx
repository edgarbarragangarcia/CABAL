"use client";

import Link from "next/link";
import { BookOpenText, GraduationCap, Layers } from "lucide-react";

import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/sections/page-header";
import { RevealGroup, Reveal } from "@/components/animations/reveal";
import { useLmsCourses } from "@/lib/lms-store";

export default function CursosPage() {
  const { courses, ready } = useLmsCourses();
  const publicados = courses.filter((c) => c.status === "publicado");

  return (
    <>
      <PageHeader
        eyebrow="Academia"
        title="Cursos de la Fundación Escuela Libertad"
        description="Formación en libertad económica, institucionalidad y liderazgo comunitario. Nuevos cursos se publican aquí a medida que están listos."
      />

      <Container as="section" className="pb-32">
        {ready && publicados.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <GraduationCap className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">Muy pronto</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Estamos preparando el primer curso. Vuelve pronto.
            </p>
          </div>
        )}

        <RevealGroup as="div" className="grid gap-6 sm:grid-cols-2">
          {publicados.map((course) => {
            const totalLessons = course.modules.reduce((a, m) => a + m.lessons.length, 0);
            return (
              <Reveal key={course.id} as="li" className="list-none">
                <Link
                  href={`/cursos/${course.id}`}
                  className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface p-8 transition-shadow hover:shadow-xl"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <GraduationCap className="size-5" aria-hidden="true" />
                  </span>
                  <h2 className="text-lg font-semibold">{course.title}</h2>
                  {course.description && (
                    <p className="text-sm text-muted-foreground">{course.description}</p>
                  )}
                  <div className="mt-auto flex items-center gap-3 pt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="size-3.5" aria-hidden="true" />
                      {course.modules.length} módulos
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpenText className="size-3.5" aria-hidden="true" />
                      {totalLessons} lecciones
                    </span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </RevealGroup>
      </Container>
    </>
  );
}
