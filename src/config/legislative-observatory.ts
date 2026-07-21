/**
 * Cifras del Observatorio Legislativo. Fuente de verdad única y editable:
 * al actualizar este archivo (y desplegar), las cifras se reflejan en toda
 * la página. Pensado para migrar a una tabla de Supabase más adelante sin
 * cambiar la interfaz de los componentes que consumen `legislativeStats`.
 */
export type LegislativeStat = {
  id: string;
  label: string;
  value: number;
  suffix?: string;
};

export const legislativeStats: LegislativeStat[] = [
  { id: "en-seguimiento", label: "Proyectos en seguimiento", value: 24 },
  { id: "en-tramite", label: "En trámite actualmente", value: 9 },
  { id: "aprobados", label: "Aprobados esta legislatura", value: 6 },
  { id: "archivados", label: "Archivados", value: 8 },
];

export const legislativeStatsUpdatedAt = "2026-07-01";
