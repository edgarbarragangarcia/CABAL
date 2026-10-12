/**
 * Los indicadores de conflicto y problemas por municipio: qué son, de dónde salen y cómo se muestran. Sin nada de servidor: lo usan
 * el cargador (que los trae de datos.gov.co), la API y la pantalla.
 */

export type Grupo = "conflicto" | "seguridad" | "economia-ilegal" | "territorio";

export type Indicador = {
  grupo: Grupo;
  etiqueta: string;
  /** Qué se está contando (para el texto «N personas», «N casos»...). */
  unidad: string;
  ayuda: string;
  fuente: string;
  /** Se muestra por cada 1.000 habitantes (`mil`), por cada 100.000 y por año (`cienMilAnual`) o solo el total. */
  tasa?: "mil" | "cienMilAnual";
  /** El valor es una ventana de años («2021-2025»): se compara con la ventana anterior. */
  ventana?: boolean;
  /** Se muestra en la tarjeta principal de la sección. */
  principal?: boolean;
};

const RUV = "Unidad para las Víctimas (Registro Único de Víctimas)";
const POLICIA = "Policía Nacional, vía el Ministerio de Defensa (datos.gov.co)";

export const INDICADORES: Record<string, Indicador> = {
  victimas_total: { grupo: "conflicto", etiqueta: "Víctimas del conflicto armado", unidad: "personas", ayuda: "Personas registradas como víctimas por hechos ocurridos en el municipio (acumulado histórico).", fuente: RUV, tasa: "mil", principal: true },
  victimas_desplazamiento: { grupo: "conflicto", etiqueta: "Desplazamiento forzado", unidad: "personas", ayuda: "Víctimas de desplazamiento forzado por hechos ocurridos en el municipio.", fuente: RUV, tasa: "mil", principal: true },
  victimas_homicidio: { grupo: "conflicto", etiqueta: "Homicidio (hecho victimizante)", unidad: "personas", ayuda: "Víctimas del conflicto por homicidio.", fuente: RUV, tasa: "mil" },
  victimas_amenaza: { grupo: "conflicto", etiqueta: "Amenazas", unidad: "personas", ayuda: "Víctimas de amenazas en el marco del conflicto.", fuente: RUV, tasa: "mil" },
  victimas_desaparicion: { grupo: "conflicto", etiqueta: "Desaparición forzada", unidad: "personas", ayuda: "Víctimas de desaparición forzada.", fuente: RUV, tasa: "mil" },
  victimas_confinamiento: { grupo: "conflicto", etiqueta: "Confinamiento", unidad: "personas", ayuda: "Víctimas de confinamiento (comunidades que no pueden salir de su territorio).", fuente: RUV, tasa: "mil" },
  victimas_secuestro: { grupo: "conflicto", etiqueta: "Secuestro (hecho victimizante)", unidad: "personas", ayuda: "Víctimas del conflicto por secuestro.", fuente: RUV, tasa: "mil" },
  victimas_reclutamiento: { grupo: "conflicto", etiqueta: "Reclutamiento de niños, niñas y adolescentes", unidad: "personas", ayuda: "Vinculación de menores a actividades relacionadas con el conflicto.", fuente: RUV, tasa: "mil" },
  victimas_despojo: { grupo: "conflicto", etiqueta: "Despojo y abandono de tierras", unidad: "personas", ayuda: "Víctimas de abandono o despojo forzado de tierras.", fuente: RUV, tasa: "mil" },
  victimas_minas: { grupo: "conflicto", etiqueta: "Víctimas de minas antipersonal", unidad: "personas", ayuda: "Víctimas de minas antipersonal, munición sin explotar y artefactos explosivos.", fuente: RUV, tasa: "mil" },
  victimas_acto_terrorista: { grupo: "conflicto", etiqueta: "Actos terroristas, combates y hostigamientos", unidad: "personas", ayuda: "Víctimas de actos terroristas, atentados, combates y hostigamientos.", fuente: RUV, tasa: "mil" },
  victimas_sexual: { grupo: "conflicto", etiqueta: "Violencia sexual", unidad: "personas", ayuda: "Delitos contra la libertad y la integridad sexual en el marco del conflicto.", fuente: RUV, tasa: "mil" },
  minas_eventos: { grupo: "conflicto", etiqueta: "Eventos con minas antipersonal", unidad: "eventos", ayuda: "Accidentes e incidentes por minas antipersonal y artefactos explosivos improvisados, y sospechas de campos minados.", fuente: "Descontamina Colombia, Presidencia de la República (datos.gov.co)" },
  homicidios: { grupo: "seguridad", etiqueta: "Homicidios", unidad: "casos", ayuda: "Víctimas de homicidio en los últimos cinco años completos.", fuente: POLICIA, tasa: "cienMilAnual", ventana: true, principal: true },
  secuestros: { grupo: "seguridad", etiqueta: "Secuestros", unidad: "casos", ayuda: "Secuestros (simple y extorsivo) en los últimos cinco años completos.", fuente: POLICIA, tasa: "cienMilAnual", ventana: true },
  extorsiones: { grupo: "seguridad", etiqueta: "Extorsiones", unidad: "casos", ayuda: "Extorsiones denunciadas en los últimos cinco años completos.", fuente: POLICIA, tasa: "cienMilAnual", ventana: true },
  masacres_casos: { grupo: "seguridad", etiqueta: "Masacres", unidad: "casos", ayuda: "Homicidios intencionales simultáneos de tres o más personas, acumulado en el periodo que cubre la fuente.", fuente: POLICIA },
  masacres_victimas: { grupo: "seguridad", etiqueta: "Víctimas de masacres", unidad: "personas", ayuda: "Personas muertas en masacres, acumulado en el periodo que cubre la fuente.", fuente: POLICIA },
  coca_ha: { grupo: "economia-ilegal", etiqueta: "Cultivos de coca", unidad: "hectáreas", ayuda: "Hectáreas de coca detectadas a 31 de diciembre del último año publicado.", fuente: "Ministerio de Justicia, con el monitoreo de UNODC/SIMCI (datos.gov.co)", principal: true },
  pdet: { grupo: "territorio", etiqueta: "Municipio PDET", unidad: "", ayuda: "Municipio priorizado por la Agencia de Renovación del Territorio por su afectación por el conflicto, pobreza y debilidad institucional (Programas de Desarrollo con Enfoque Territorial).", fuente: "Agencia de Renovación del Territorio (datos.gov.co)", principal: true },
};

export const GRUPOS: Record<Grupo, string> = {
  conflicto: "Conflicto armado",
  seguridad: "Seguridad",
  "economia-ilegal": "Economías ilegales",
  territorio: "Territorio",
};

/** Las fuentes que se cargan, cada una con los indicadores que deja. */
export const FUENTES_CARGA: Record<string, { nombre: string; indicadores: string[] }> = {
  victimas: { nombre: "Víctimas del conflicto (Unidad para las Víctimas)", indicadores: Object.keys(INDICADORES).filter((k) => k.startsWith("victimas_")) },
  seguridad: { nombre: "Homicidios, secuestros, extorsión y masacres (Policía Nacional)", indicadores: ["homicidios", "secuestros", "extorsiones", "masacres_casos", "masacres_victimas"] },
  minas: { nombre: "Minas antipersonal (Descontamina Colombia)", indicadores: ["minas_eventos"] },
  coca: { nombre: "Cultivos de coca (Ministerio de Justicia)", indicadores: ["coca_ha"] },
  pdet: { nombre: "Municipios PDET (Agencia de Renovación del Territorio)", indicadores: ["pdet"] },
};
export type FuenteCarga = keyof typeof FUENTES_CARGA;
