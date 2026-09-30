/**
 * Datasets de datos.gov.co usados por Avales — distintos de `GOV_DATASETS`
 * (../queries.ts), que están acotados a las cifras del Observatorio público.
 * Estos alimentan la ficha de verificación de candidatos en el panel admin.
 *
 * Se descartó el dataset "Responsabilidad Fiscal" (jr8e-e8tu) como fuente
 * automática: solo tiene 60 filas y todas son NIT de personas jurídicas (se
 * verificó en vivo, `$group=identificaci_n` → 100% "NIT"), así que nunca
 * encontraría una sanción real contra una persona natural — mostrar "sin
 * sanciones fiscales" ahí sería un falso negativo, peor que no mostrar nada.
 * El certificado de la Contraloría queda en el checklist manual.
 */
export const AVALES_DATASETS = {
  antecedentesDisciplinarios: {
    id: "iaeu-rcn6",
    title: "Antecedentes de SIRI (sanciones e inhabilidades disciplinarias)",
    source: "Función Pública — Sistema de Información de Registro de Sanciones e Inhabilidades (SIRI)",
    url: "https://www.datos.gov.co/Funci-n-p-blica/Antecedentes-de-SIRI/iaeu-rcn6",
  },
} as const;
