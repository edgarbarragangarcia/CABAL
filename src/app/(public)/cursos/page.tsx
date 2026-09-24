"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpenText, Clock, GraduationCap, Layers } from "lucide-react";

import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/sections/page-header";
import { RevealGroup, Reveal } from "@/components/animations/reveal";
import { useLmsCourses, type Course } from "@/lib/lms-store";
import { courseMinutes, courseVisual, formatDuration } from "./course-visuals";

function CourseCard({ course, index }: { course: Course; index: number }) {
  const { cover, label, icon: Icon } = courseVisual(course, index);
  const lessons = course.modules.flatMap((m) => m.lessons);
  const minutes = courseMinutes(course);

  return (
    <Link
      href={`/cursos/${course.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-[var(--shadow-1)] transition duration-500 ease-out hover:-translate-y-1.5 hover:border-transparent hover:shadow-[var(--shadow-3)]"
    >
      {/* Portada */}
      <div
        className="relative h-44 overflow-hidden"
        style={{ backgroundImage: cover }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.55)_1px,transparent_0)] [background-size:16px_16px] [mask-image:linear-gradient(to_bottom_left,black,transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="absolute -left-10 -top-16 size-48 rounded-full bg-white/25 blur-3xl transition-transform duration-700 group-hover:translate-x-6"
        />
        <span className="absolute left-5 top-5 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
          {label}
        </span>
        <Icon
          aria-hidden="true"
          strokeWidth={1.25}
          className="absolute -bottom-5 right-4 size-32 text-white/85 drop-shadow-lg transition-transform duration-700 ease-out group-hover:-translate-y-2 group-hover:-rotate-6 group-hover:scale-105"
        />
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col p-6">
        <h2 className="text-lg font-semibold leading-snug">{course.title}</h2>
        {course.description && (
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{course.description}</p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1">
            <Layers className="size-3.5" aria-hidden="true" />
            {course.modules.length} módulos
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1">
            <BookOpenText className="size-3.5" aria-hidden="true" />
            {lessons.length} lecciones
          </span>
          {minutes > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {formatDuration(minutes)}
            </span>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm font-semibold text-brand">Ver curso</span>
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-brand-foreground">
            <ArrowUpRight
              className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </div>
    </Link>
  );
}

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

        <RevealGroup as="div" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {publicados.map((course, i) => (
            <Reveal key={course.id} as="li" className="list-none">
              <CourseCard course={course} index={i} />
            </Reveal>
          ))}
        </RevealGroup>
      </Container>
    </>
  );
}
