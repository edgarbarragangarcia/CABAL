"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLmsCourses } from "@/lib/lms-store";

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const { courses, ready, addModule, deleteModule, addLesson, deleteLesson } = useLmsCourses();

  const course = courses.find((c) => c.id === params.courseId);

  const [newModuleTitle, setNewModuleTitle] = React.useState("");
  const [lessonDraft, setLessonDraft] = React.useState<Record<string, { title: string; minutes: string }>>({});

  if (ready && !course) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm text-muted-foreground">Este curso no existe (o se borró).</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/admin/lms")}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al LMS
        </Button>
      </div>
    );
  }

  if (!course) return null;

  function onAddModule(e: React.FormEvent) {
    e.preventDefault();
    if (!newModuleTitle.trim() || !course) return;
    addModule(course.id, newModuleTitle.trim());
    setNewModuleTitle("");
  }

  function onAddLesson(moduleId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!course) return;
    const draft = lessonDraft[moduleId];
    if (!draft?.title.trim()) return;
    addLesson(course.id, moduleId, draft.title.trim(), Number(draft.minutes) || 0);
    setLessonDraft((prev) => ({ ...prev, [moduleId]: { title: "", minutes: "" } }));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/lms"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        LMS
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{course.title}</h1>
      {course.description && (
        <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
      )}

      <div className="mt-6 space-y-4">
        {course.modules.map((module) => (
          <div key={module.id} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{module.title}</h2>
              <button
                type="button"
                onClick={() => deleteModule(course.id, module.id)}
                aria-label="Eliminar módulo"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-destructive"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </div>

            <ul className="mt-3 divide-y divide-border">
              {module.lessons.map((lesson) => (
                <li key={lesson.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{lesson.title}</span>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {lesson.durationMin} min
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteLesson(course.id, module.id, lesson.id)}
                      aria-label="Eliminar lección"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
              {module.lessons.length === 0 && (
                <li className="py-2 text-xs text-muted-foreground">Sin lecciones todavía.</li>
              )}
            </ul>

            <form
              onSubmit={(e) => onAddLesson(module.id, e)}
              className="mt-3 flex flex-wrap items-center gap-2"
            >
              <input
                value={lessonDraft[module.id]?.title ?? ""}
                onChange={(e) =>
                  setLessonDraft((prev) => ({
                    ...prev,
                    [module.id]: { title: e.target.value, minutes: prev[module.id]?.minutes ?? "" },
                  }))
                }
                placeholder="Nueva lección"
                className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand"
              />
              <input
                value={lessonDraft[module.id]?.minutes ?? ""}
                onChange={(e) =>
                  setLessonDraft((prev) => ({
                    ...prev,
                    [module.id]: { title: prev[module.id]?.title ?? "", minutes: e.target.value },
                  }))
                }
                type="number"
                min={0}
                placeholder="min"
                className="h-9 w-20 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand"
              />
              <Button type="submit" size="sm" variant="outline">
                <Plus className="size-3.5" aria-hidden="true" />
                Añadir
              </Button>
            </form>
          </div>
        ))}
      </div>

      <form
        onSubmit={onAddModule}
        className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-border p-4"
      >
        <input
          value={newModuleTitle}
          onChange={(e) => setNewModuleTitle(e.target.value)}
          placeholder="Nuevo módulo (ej. Módulo 2 · Práctica)"
          className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand"
        />
        <Button type="submit" size="sm">
          <Plus className="size-4" aria-hidden="true" />
          Añadir módulo
        </Button>
      </form>
    </div>
  );
}
