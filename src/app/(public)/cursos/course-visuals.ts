import type { LucideIcon } from "lucide-react";
import {
  Coins,
  GraduationCap,
  Landmark,
  Megaphone,
  ScrollText,
  TrendingUp,
  Users,
} from "lucide-react";

import type { Course } from "@/lib/lms-store";

/** Portadas con color propio, asignadas por posición para que las vecinas no se repitan. */
const COVERS = [
  "linear-gradient(135deg, #0a4f37 0%, #1f9d6c 55%, #7ee2b8 100%)",
  "linear-gradient(135deg, #0c4a6e 0%, #0891b2 55%, #67e8f9 100%)",
  "linear-gradient(135deg, #8a5a14 0%, #d19a3a 55%, #f6d58e 100%)",
  "linear-gradient(135deg, #3f6212 0%, #65a30d 55%, #bef264 100%)",
  "linear-gradient(135deg, #312e81 0%, #6366f1 55%, #c7d2fe 100%)",
  "linear-gradient(135deg, #7c2d12 0%, #ea580c 55%, #fdba74 100%)",
];

/** Área e ícono según el título, para que también los cursos creados en el LMS tengan portada. */
const TOPICS: { match: RegExp; label: string; icon: LucideIcon }[] = [
  { match: /economistas|inflaci|impuesto/i, label: "Economía", icon: Coins },
  { match: /econ[oó]mic|mercado/i, label: "Economía", icon: TrendingUp },
  { match: /instituci|estado|derecho|justicia/i, label: "Instituciones", icon: Landmark },
  { match: /lideraz|comunidad|comunitari|ciudadan/i, label: "Liderazgo", icon: Users },
  { match: /historia|ideas|pensamiento/i, label: "Historia", icon: ScrollText },
  { match: /comunicaci|debate|discurso/i, label: "Comunicación", icon: Megaphone },
];

/**
 * Identidad visual de un curso. `index` es su posición entre los cursos
 * publicados: así la ficha del curso repite el color de su tarjeta.
 */
export function courseVisual(course: Course, index: number) {
  const topic = TOPICS.find((t) => t.match.test(course.title)) ?? {
    label: "Curso",
    icon: GraduationCap,
  };
  return {
    cover: COVERS[Math.max(index, 0) % COVERS.length],
    label: topic.label,
    icon: topic.icon,
  };
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const courseMinutes = (course: Course) =>
  course.modules.reduce((acc, m) => acc + m.lessons.reduce((a, l) => a + l.durationMin, 0), 0);
