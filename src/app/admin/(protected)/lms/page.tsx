"use client";

import * as React from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpenText, Layers, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLmsCourses } from "@/lib/lms-store";

export default function LmsPage() {
  const { courses, ready, addCourse, deleteCourse, toggleStatus } = useLmsCourses();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addCourse({ title: title.trim(), description: description.trim() });
    setTitle("");
    setDescription("");
    setOpen(false);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">LMS · Cursos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo de cursos y contenido formativo.
          </p>
        </div>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <Button size="sm">
              <Plus className="size-4" aria-hidden="true" />
              Nuevo curso
            </Button>
          </Dialog.Trigger>
          <AnimatePresence>
            {open && (
              <Dialog.Portal forceMount>
                <Dialog.Overlay asChild forceMount>
                  <motion.div
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                </Dialog.Overlay>
                <Dialog.Content asChild forceMount aria-describedby={undefined}>
                  <motion.form
                    onSubmit={onCreate}
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 10 }}
                    transition={{ duration: 0.18 }}
                    className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-2xl"
                  >
                    <div className="flex items-center justify-between">
                      <Dialog.Title className="text-base font-semibold">
                        Nuevo curso
                      </Dialog.Title>
                      <Dialog.Close
                        type="button"
                        className="rounded-full p-1 text-muted-foreground hover:bg-surface-muted"
                        aria-label="Cerrar"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Dialog.Close>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Título</label>
                        <input
                          autoFocus
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand"
                          placeholder="Ej. Introducción al liderazgo comunitario"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">
                          Descripción
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={3}
                          className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
                          placeholder="De qué trata el curso"
                        />
                      </div>
                    </div>

                    <Button type="submit" size="sm" className="mt-5 w-full">
                      Crear curso
                    </Button>
                  </motion.form>
                </Dialog.Content>
              </Dialog.Portal>
            )}
          </AnimatePresence>
        </Dialog.Root>
      </div>

      {ready && courses.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Aún no hay cursos. Crea el primero con &ldquo;Nuevo curso&rdquo;.
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {courses.map((course) => {
          const totalLessons = course.modules.reduce((a, m) => a + m.lessons.length, 0);
          return (
            <div key={course.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold leading-snug">{course.title}</h2>
                <button
                  type="button"
                  onClick={() => toggleStatus(course.id)}
                  className={
                    course.status === "publicado"
                      ? "shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand"
                      : "shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  }
                  title="Cambiar estado"
                >
                  {course.status}
                </button>
              </div>

              {course.description && (
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                  {course.description}
                </p>
              )}

              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="size-3.5" aria-hidden="true" />
                  {course.modules.length} módulos
                </span>
                <span className="flex items-center gap-1">
                  <BookOpenText className="size-3.5" aria-hidden="true" />
                  {totalLessons} lecciones
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/admin/lms/${course.id}`}
                  className="flex-1 rounded-lg border border-border py-2 text-center text-xs font-medium hover:bg-surface-muted"
                >
                  Ver contenido
                </Link>
                {course.status === "publicado" && (
                  <Link
                    href={`/cursos/${course.id}`}
                    target="_blank"
                    className="flex-1 rounded-lg border border-border py-2 text-center text-xs font-medium hover:bg-surface-muted"
                  >
                    Ver público
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => deleteCourse(course.id)}
                  aria-label="Eliminar curso"
                  className="rounded-lg border border-border p-2 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
