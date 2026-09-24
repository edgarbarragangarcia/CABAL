"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpenText,
  CheckCircle2,
  Clock,
  GraduationCap,
  Layers,
  Play,
} from "lucide-react";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/animations/reveal";
import { useLmsCourses } from "@/lib/lms-store";
import { courseMinutes, courseVisual, formatDuration } from "../course-visuals";

/** Los módulos semilla se llaman "Módulo 1 · …": el número ya va en la insignia. */
const moduleName = (title: string) => title.replace(/^m[oó]dulo\s+\d+\s*[·:.-]\s*/i, "");

export default function CursoDetailPage() {
  const params = useParams<{ courseId: string }>();
  const { courses, ready } = useLmsCourses();
  const publicados = courses.filter((c) => c.status === "publicado");
  const index = publicados.findIndex((c) => c.id === params.courseId);
  const course = publicados[index];

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

  const { cover, label, icon: Icon } = courseVisual(course, index);
  const lessonCount = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const minutes = courseMinutes(course);
  const stats = [
    { icon: Layers, text: `${course.modules.length} módulos` },
    { icon: BookOpenText, text: `${lessonCount} lecciones` },
    ...(minutes > 0 ? [{ icon: Clock, text: formatDuration(minutes) }] : []),
  ];

  return (
    <Container as="section" className="pb-32 pt-32 sm:pt-40">
      <Link
        href="/cursos"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Todos los cursos
      </Link>

      {/* Portada: mismo color e ícono que su tarjeta en /cursos */}
      <Reveal
        as="section"
        className="relative mt-5 overflow-hidden rounded-[2rem] px-6 py-10 text-white shadow-[var(--shadow-3)] sm:px-12 sm:py-14"
      >
        <div aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: cover }} />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.5)_1px,transparent_0)] [background-size:18px_18px] [mask-image:linear-gradient(to_left,black,transparent_75%)]"
        />
        <div
          aria-hidden="true"
          className="absolute -left-20 -top-24 size-80 rounded-full bg-white/20 blur-3xl"
        />
        <Icon
          aria-hidden="true"
          strokeWidth={1}
          className="absolute -bottom-10 -right-6 size-64 text-white/25 sm:size-80"
        />

        <div className="relative max-w-3xl">
          <span className="inline-flex rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-md">
            Academia · {label}
          </span>
          <h1 className="mt-5 text-balance font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            {course.title}
          </h1>
          {course.description && (
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/85">
              {course.description}
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-2">
            {stats.map(({ icon: StatIcon, text }) => (
              <span
                key={text}
                className="flex items-center gap-1.5 rounded-full border border-white/25 bg-black/15 px-3 py-1.5 text-sm backdrop-blur-md"
              >
                <StatIcon className="size-4" aria-hidden="true" />
                {text}
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">Contenido del curso</h2>

          {course.modules.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              El contenido de este curso se publicará pronto.
            </p>
          ) : (
            <ol className="relative mt-6 space-y-5">
              {/* Línea de tiempo entre los módulos */}
              <span
                aria-hidden="true"
                className="absolute bottom-6 left-[2.15rem] top-6 hidden w-px bg-border sm:block"
              />
              {course.modules.map((module, i) => {
                const moduleMinutes = module.lessons.reduce((acc, l) => acc + l.durationMin, 0);
                return (
                  <Reveal
                    key={module.id}
                    as="li"
                    className="relative rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-1)] transition-shadow duration-300 hover:shadow-[var(--shadow-2)] sm:p-6"
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl font-display text-lg text-white shadow-md"
                        style={{ backgroundImage: cover }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Módulo {i + 1}
                        </p>
                        <h3 className="text-lg font-semibold leading-snug">
                          {moduleName(module.title)}
                        </h3>
                      </div>
                      {module.lessons.length > 0 && (
                        <span className="ml-auto hidden shrink-0 text-xs text-muted-foreground sm:block">
                          {module.lessons.length} lecciones · {formatDuration(moduleMinutes)}
                        </span>
                      )}
                    </div>

                    <ul className="mt-4 space-y-1 sm:pl-16">
                      {module.lessons.map((lesson) => (
                        <li
                          key={lesson.id}
                          className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface-muted"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-transparent group-hover:bg-brand group-hover:text-brand-foreground">
                            <Play className="size-3.5 translate-x-px" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1 text-sm">{lesson.title}</span>
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-xs text-muted-foreground">
                            <Clock className="size-3" aria-hidden="true" />
                            {lesson.durationMin} min
                          </span>
                        </li>
                      ))}
                      {module.lessons.length === 0 && (
                        <li className="px-3 py-2.5 text-xs text-muted-foreground">
                          Contenido en preparación.
                        </li>
                      )}
                    </ul>
                  </Reveal>
                );
              })}
            </ol>
          )}
        </div>

        {/* Resumen, fijo al hacer scroll en escritorio */}
        <aside className="h-fit rounded-3xl border border-border bg-surface p-6 shadow-[var(--shadow-2)] lg:sticky lg:top-28">
          <p className="text-sm font-semibold">Resumen del curso</p>
          <dl className="mt-4 grid grid-cols-[1fr_1fr_1.5fr] gap-2 text-center">
            {[
              [String(course.modules.length), "módulos"],
              [String(lessonCount), "lecciones"],
              [minutes > 0 ? formatDuration(minutes) : "—", "duración"],
            ].map(([value, name]) => (
              <div key={name} className="flex flex-col-reverse rounded-2xl bg-surface-muted px-2 py-3">
                <dt className="text-[11px] text-muted-foreground">{name}</dt>
                <dd className="whitespace-nowrap text-sm font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {course.modules.length > 0 && (
            <>
              <p className="mt-6 text-sm font-semibold">Lo que verás</p>
              <ul className="mt-3 space-y-2">
                {course.modules.map((module) => (
                  <li key={module.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                    {moduleName(module.title)}
                  </li>
                ))}
              </ul>
            </>
          )}

          <Link
            href="/contacto"
            className="group mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition hover:opacity-90"
          >
            Quiero tomar este curso
            <ArrowUpRight
              className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Escríbenos y te contamos cómo inscribirte.
          </p>
        </aside>
      </div>
    </Container>
  );
}
