"use client";

import * as React from "react";

/**
 * Almacén del LMS — sin base de datos por ahora: vive en `localStorage`
 * del navegador. Sirve para operar el panel ya mismo; cuando haya un
 * backend real (p. ej. Supabase, ya conectado en el proyecto), esta es la
 * forma que debe tener el modelo de datos.
 */

export type Lesson = {
  id: string;
  title: string;
  durationMin: number;
};

export type Module = {
  id: string;
  title: string;
  lessons: Lesson[];
};

export type Course = {
  id: string;
  title: string;
  description: string;
  status: "borrador" | "publicado";
  modules: Module[];
  createdAt: number;
};

const STORAGE_KEY = "el-admin-lms-courses-v1";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const SEED_COURSES: Course[] = [
  {
    id: uid(),
    title: "Fundamentos de libertad económica",
    description:
      "Curso introductorio sobre mercado libre, propiedad privada y desarrollo. Contenido de ejemplo — reemplázalo por el material real.",
    status: "borrador",
    createdAt: Date.now(),
    modules: [
      {
        id: uid(),
        title: "Módulo 1 · Introducción",
        lessons: [
          { id: uid(), title: "¿Qué es la libertad económica?", durationMin: 12 },
          { id: uid(), title: "Historia del pensamiento liberal", durationMin: 18 },
        ],
      },
    ],
  },
  {
    id: uid(),
    title: "Formación política municipal",
    description:
      "Taller para líderes comunitarios sobre participación y control social. Contenido de ejemplo.",
    status: "borrador",
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    modules: [],
  },
];

function readCourses(): Course[] {
  if (typeof window === "undefined") return SEED_COURSES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_COURSES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return SEED_COURSES;
    return parsed as Course[];
  } catch {
    return SEED_COURSES;
  }
}

function writeCourses(courses: Course[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

/** Hook de lectura/escritura del catálogo de cursos, persistido en el navegador. */
export function useLmsCourses() {
  const [courses, setCourses] = React.useState<Course[]>(SEED_COURSES);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // Lectura única de localStorage tras montar (evita el desajuste de
    // hidratación de leerlo durante el render inicial en servidor/cliente).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCourses(readCourses());
    setReady(true);
  }, []);

  const update = React.useCallback((next: Course[] | ((prev: Course[]) => Course[])) => {
    setCourses((prev) => {
      const value = typeof next === "function" ? (next as (p: Course[]) => Course[])(prev) : next;
      writeCourses(value);
      return value;
    });
  }, []);

  const addCourse = React.useCallback(
    (input: { title: string; description: string }) => {
      const course: Course = {
        id: uid(),
        title: input.title,
        description: input.description,
        status: "borrador",
        modules: [],
        createdAt: Date.now(),
      };
      update((prev) => [course, ...prev]);
      return course;
    },
    [update]
  );

  const deleteCourse = React.useCallback(
    (id: string) => update((prev) => prev.filter((c) => c.id !== id)),
    [update]
  );

  const toggleStatus = React.useCallback(
    (id: string) =>
      update((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status: c.status === "publicado" ? "borrador" : "publicado" }
            : c
        )
      ),
    [update]
  );

  const addModule = React.useCallback(
    (courseId: string, title: string) =>
      update((prev) =>
        prev.map((c) =>
          c.id === courseId
            ? { ...c, modules: [...c.modules, { id: uid(), title, lessons: [] }] }
            : c
        )
      ),
    [update]
  );

  const deleteModule = React.useCallback(
    (courseId: string, moduleId: string) =>
      update((prev) =>
        prev.map((c) =>
          c.id === courseId
            ? { ...c, modules: c.modules.filter((m) => m.id !== moduleId) }
            : c
        )
      ),
    [update]
  );

  const addLesson = React.useCallback(
    (courseId: string, moduleId: string, title: string, durationMin: number) =>
      update((prev) =>
        prev.map((c) =>
          c.id === courseId
            ? {
                ...c,
                modules: c.modules.map((m) =>
                  m.id === moduleId
                    ? { ...m, lessons: [...m.lessons, { id: uid(), title, durationMin }] }
                    : m
                ),
              }
            : c
        )
      ),
    [update]
  );

  const deleteLesson = React.useCallback(
    (courseId: string, moduleId: string, lessonId: string) =>
      update((prev) =>
        prev.map((c) =>
          c.id === courseId
            ? {
                ...c,
                modules: c.modules.map((m) =>
                  m.id === moduleId
                    ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
                    : m
                ),
              }
            : c
        )
      ),
    [update]
  );

  return {
    courses,
    ready,
    addCourse,
    deleteCourse,
    toggleStatus,
    addModule,
    deleteModule,
    addLesson,
    deleteLesson,
  };
}
