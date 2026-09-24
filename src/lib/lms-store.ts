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

const STORAGE_KEY = "el-admin-lms-courses-v2";
/** La v1 solo traía 2 cursos semilla en borrador; de ella se rescatan los cursos creados a mano. */
const LEGACY_STORAGE_KEY = "el-admin-lms-courses-v1";
const LEGACY_SEED_TITLES = new Set(["Fundamentos de libertad económica", "Formación política municipal"]);

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const DAY = 24 * 60 * 60 * 1000;
const SEED_DATE = Date.UTC(2026, 8, 1);

/**
 * Curso de ejemplo con ids fijos derivados del slug: con ids al azar el HTML
 * del servidor y el del navegador no coinciden, y el enlace a un curso deja
 * de funcionar al recargar la página.
 */
function seedCourse(
  slug: string,
  title: string,
  description: string,
  modules: [string, [string, number][]][],
  daysAgo: number
): Course {
  return {
    id: slug,
    title,
    description,
    status: "publicado",
    createdAt: SEED_DATE - daysAgo * DAY,
    modules: modules.map(([moduleTitle, lessons], m) => ({
      id: `${slug}-m${m + 1}`,
      title: `Módulo ${m + 1} · ${moduleTitle}`,
      lessons: lessons.map(([lessonTitle, durationMin], l) => ({
        id: `${slug}-m${m + 1}-l${l + 1}`,
        title: lessonTitle,
        durationMin,
      })),
    })),
  };
}

/** Cursos de ejemplo para ver la Academia con contenido. Se editan, despublican
 * o borran desde el LMS del admin; reemplázalos por el material real. */
const SEED_COURSES: Course[] = [
  seedCourse(
    "fundamentos-libertad-economica",
    "Fundamentos de libertad económica",
    "Mercado, propiedad privada y desarrollo: las ideas básicas para entender por qué unas sociedades prosperan y otras no.",
    [
      [
        "Introducción",
        [
          ["¿Qué es la libertad económica?", 12],
          ["Historia del pensamiento liberal", 18],
          ["Cómo se mide: índices y comparaciones", 15],
        ],
      ],
      [
        "Mercado y precios",
        [
          ["Oferta, demanda y señales de precios", 20],
          ["El papel del emprendedor", 14],
          ["Competencia y monopolios", 16],
        ],
      ],
      [
        "Propiedad y desarrollo",
        [
          ["Derechos de propiedad y seguridad jurídica", 17],
          ["La informalidad en Colombia", 19],
          ["Casos de reformas que funcionaron", 22],
        ],
      ],
    ],
    0
  ),
  seedCourse(
    "instituciones-estado-de-derecho",
    "Instituciones y Estado de derecho",
    "Separación de poderes, pesos y contrapesos y control ciudadano: cómo funcionan las instituciones que protegen la libertad.",
    [
      [
        "El Estado limitado",
        [
          ["Constitución y derechos fundamentales", 16],
          ["Separación de poderes", 14],
        ],
      ],
      [
        "Justicia y seguridad",
        [
          ["Independencia judicial", 18],
          ["Seguridad ciudadana y confianza", 15],
          ["Corrupción: causas y remedios", 20],
        ],
      ],
      [
        "Control ciudadano",
        [
          ["Veedurías y rendición de cuentas", 13],
          ["Datos abiertos para vigilar lo público", 17],
        ],
      ],
    ],
    6
  ),
  seedCourse(
    "liderazgo-comunitario",
    "Liderazgo comunitario y participación ciudadana",
    "Herramientas prácticas para organizar a tu comunidad, incidir en lo local y participar con propuestas.",
    [
      [
        "Organizar la comunidad",
        [
          ["Mapear actores y necesidades", 15],
          ["Cómo convocar y sostener un grupo", 12],
        ],
      ],
      [
        "Incidencia local",
        [
          ["Juntas de acción comunal y concejos", 18],
          ["Derechos de petición y mecanismos de participación", 16],
          ["Presupuestos participativos", 14],
        ],
      ],
    ],
    12
  ),
  seedCourse(
    "economia-para-no-economistas",
    "Economía para no economistas",
    "Inflación, impuestos, deuda y empleo explicados sin tecnicismos, con ejemplos de la vida diaria.",
    [
      [
        "Dinero e inflación",
        [
          ["¿Qué es la inflación y quién la causa?", 14],
          ["Tasas de interés y Banco de la República", 16],
        ],
      ],
      [
        "Impuestos y gasto público",
        [
          ["¿Quién paga realmente los impuestos?", 15],
          ["Deuda pública y generaciones futuras", 17],
        ],
      ],
      [
        "Empleo y crecimiento",
        [
          ["Por qué crece (o no) una economía", 18],
          ["Formalidad laboral y salario mínimo", 16],
        ],
      ],
    ],
    20
  ),
  seedCourse(
    "historia-ideas-libertad",
    "Historia de las ideas de la libertad",
    "De Locke y Adam Smith a Hayek: los pensadores que dieron forma a la tradición liberal y su eco en América Latina.",
    [
      [
        "Los clásicos",
        [
          ["John Locke y los derechos naturales", 16],
          ["Adam Smith y el orden espontáneo", 18],
        ],
      ],
      [
        "El siglo XX",
        [
          ["Hayek y el problema del conocimiento", 20],
          ["Milton Friedman y la libertad de elegir", 17],
        ],
      ],
      [
        "América Latina",
        [
          ["Ideas liberales en la Independencia", 15],
          ["Reformas y contrarreformas", 19],
        ],
      ],
    ],
    27
  ),
  seedCourse(
    "comunicacion-debate-publico",
    "Comunicación y debate público",
    "Argumentar con datos, hablar en público y comunicar en redes sin perder el rigor.",
    [
      [
        "Argumentar",
        [
          ["Cómo construir un argumento sólido", 14],
          ["Falacias comunes y cómo responderlas", 16],
        ],
      ],
      [
        "Hablar en público",
        [
          ["Preparar una intervención", 12],
          ["Debates y entrevistas", 15],
        ],
      ],
      [
        "Redes sociales",
        [
          ["Mensajes claros en pocos caracteres", 11],
          ["Verificar antes de compartir", 13],
        ],
      ],
    ],
    34
  ),
];

function readCourses(): Course[] {
  if (typeof window === "undefined") return SEED_COURSES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Course[]) : SEED_COURSES;
    }
    // Primera vez con la v2: los cursos creados a mano en la v1 se conservan
    // junto a los de ejemplo (los 2 semilla viejos se reemplazan).
    const legacy = JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? "[]");
    const own = Array.isArray(legacy)
      ? (legacy as Course[]).filter((c) => !LEGACY_SEED_TITLES.has(c.title))
      : [];
    return [...own, ...SEED_COURSES];
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
