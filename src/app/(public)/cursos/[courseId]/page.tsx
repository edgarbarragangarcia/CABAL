"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock, GraduationCap } from "lucide-react";

import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/sections/page-header";
import { Reveal } from "@/components/animations/reveal";
import { useLmsCourses } from "@/lib/lms-store";

export default function CursoDetailPage() {
  const params = useParams<{ courseId: string }>();
  const { courses, ready } = useLmsCourses();
  const course = courses.find((c) => c.id === params.courseId && c.status === "publicado");

  if (ready && !course) {
    return (
      <Container as="section" className="pb-32 pt-40 text-center sm:pt-48">
        <GraduationCap className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium">Este curso no está disponible.</p>
        <Link
          href="/cursos"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Ver todos los cursos
        </Link>
      </Container>
    );
  }

  if (!course) return null;

  return (
    <>
      <PageHeader eyebrow="Academia" title={course.title} description={course.description} />

      <Container as="section" className="pb-32">
        <Link
          href="/cursos"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Todos los cursos
        </Link>

        <div className="space-y-4">
          {course.modules.map((module) => (
            <Reveal key={module.id} className="rounded-2xl border border-border bg-surface p-6">
              <h2 className="font-semibold">{module.title}</h2>
              <ul className="mt-3 divide-y divide-border">
                {module.lessons.map((lesson) => (
                  <li key={lesson.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span>{lesson.title}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {lesson.durationMin} min
                    </span>
                  </li>
                ))}
                {module.lessons.length === 0 && (
                  <li className="py-2.5 text-xs text-muted-foreground">
                    Contenido en preparación.
                  </li>
                )}
              </ul>
            </Reveal>
          ))}
          {course.modules.length === 0 && (
            <p className="text-sm text-muted-foreground">
              El contenido de este curso se publicará pronto.
            </p>
          )}
        </div>
      </Container>
    </>
  );
}
