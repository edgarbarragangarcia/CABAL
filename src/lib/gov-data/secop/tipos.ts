/** Lo que devuelve la consulta de contratación pública. Sin dependencias de servidor: lo usa también el panel. */

export type FuenteSecop = "SECOP I" | "SECOP II";
export type RolContrato = "contratista" | "representante" | "supervisor" | "ordenador_gasto" | "ordenador_pago";

/**
 * - vigente: en ejecución y con plazo por delante.
 * - por_cerrar: la entidad lo reporta en ejecución, pero el plazo ya venció.
 * - terminado: terminado, cerrado o liquidado.
 * - no_firmado: borrador, en aprobación, enviado o solo adjudicado: no es un contrato celebrado.
 * - cancelado: cancelado o descartado.
 */
export type ClaseEstado = "vigente" | "por_cerrar" | "terminado" | "no_firmado" | "cancelado";

export type PersonaRef = { nombre: string; documento: string | null };

export type ContratoSecop = {
  id: string;
  fuente: FuenteSecop;
  /** Cómo se relaciona con el contrato la persona o empresa consultada. */
  roles: RolContrato[];
  entidad: string;
  nitEntidad: string | null;
  ubicacion: string;
  contratista: PersonaRef;
  tipoDocContratista: string;
  representante: PersonaRef | null;
  supervisor: PersonaRef | null;
  ordenadorGasto: PersonaRef | null;
  ordenadorPago: PersonaRef | null;
  objeto: string;
  tipo: string;
  modalidad: string;
  /** Tal como lo reporta la entidad. */
  estado: string;
  clase: ClaseEstado;
  fechaFirma: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  /** Pesos. null cuando el valor no es confiable (ver `valorAtipico`). */
  valor: number | null;
  /** El valor reportado es absurdo (error de digitación) y no se suma. */
  valorAtipico: boolean;
  /** El contratista figura con otro nombre que el resto de contratos de este documento. */
  nombreDistinto?: boolean;
  referencia: string;
  url: string | null;
};

export type Totales = {
  /** Contratos celebrados (vigentes, por cerrar o terminados). */
  n: number;
  valor: number;
  vigentes: number;
  valorVigente: number;
  entidades: number;
  /** Borradores, adjudicados sin firmar y cancelados: se listan pero no cuentan. */
  otros: number;
  /** Contratos cuyo valor se descartó por absurdo. */
  atipicos: number;
  primera: string | null;
  ultima: string | null;
  porFuente: Record<FuenteSecop, number>;
};

export type Vinculo = {
  clave: string;
  nombre: string;
  documento: string | null;
  n: number;
  valor: number;
  ultima: string | null;
  detalle?: string;
};

export type Relaciones = {
  /** Entidades que han contratado directamente al sujeto. */
  entidades: Vinculo[];
  /** Entidades que contratan a las empresas que el sujeto representa. */
  entidadesViaEmpresas: Vinculo[];
  /** Empresas que el sujeto representa (si es una persona). */
  empresas: Vinculo[];
  /** Personas que han sido sus representantes legales (si es una empresa). */
  representantes: Vinculo[];
  /** Otras empresas que comparten representante legal con el sujeto (si es una empresa). */
  relacionadas: Vinculo[];
  /** Funcionarios que firman o supervisan sus contratos. */
  funcionarios: Vinculo[];
  /** Si el sujeto es funcionario: a quiénes contrata o supervisa. */
  supervisados: Vinculo[];
};

export type Senal = { nivel: "alerta" | "aviso" | "info"; titulo: string; detalle: string };

export type RegistroProveedor = {
  nit: string;
  nombre: string;
  tipo: string;
  ubicacion: string;
  creado: string | null;
  activo: boolean | null;
  representante: PersonaRef | null;
  /** propio: es el registro del sujeto; representado: empresa cuyo representante es el sujeto. */
  relacion: "propio" | "representado";
};

export type EstadoFuente = { id: string; titulo: string; ok: boolean; n: number; ms: number; truncado?: boolean; error?: string };

export type Ficha = {
  numero: string;
  /** Dígito de verificación calculado (el que lleva el NIT o el RUT). */
  dv: string;
  modo: "cedula" | "nit";
  tipo: "persona" | "empresa" | "indeterminado";
  /** Nombres con los que figura este documento, el más frecuente primero. */
  nombres: { nombre: string; n: number }[];
  /** Como contratista. */
  contratos: ContratoSecop[];
  /** De otras empresas, cuando el sujeto es su representante legal. */
  comoRepresentante: ContratoSecop[];
  /** Como supervisor u ordenador (solo SECOP II lo reporta). */
  comoFuncionario: ContratoSecop[];
  registros: RegistroProveedor[];
  resumen: { contratista: Totales; representante: Totales; funcionario: Totales };
  /** Cuando el NIT es el de una entidad que contrata. */
  comoEntidad: { n: number; valor: number; nombres: string[]; contratistas: Vinculo[] } | null;
  relaciones: Relaciones;
  senales: Senal[];
  fuentes: EstadoFuente[];
  /** Alguna lista llegó al tope: hay más contratos de los que se muestran. */
  truncado: boolean;
  /** Cuáles listas llegaron al tope: en esas, los conteos son «al menos». */
  tope: { contratista: boolean; representante: boolean; funcionario: boolean };
  generadoEn: string;
};

export type Candidato = {
  clave: string;
  nombre: string;
  /** Sin documento reportado no se puede abrir la ficha. */
  documento: string | null;
  tipoDoc: "cedula" | "nit" | null;
  /** En qué papel aparece este nombre en la muestra consultada. */
  roles: { rol: RolContrato; n: number }[];
  n: number;
  entidades: string[];
  /** Todas las palabras de la búsqueda están en el nombre, y no hay palabras de más. */
  exacta: boolean;
};

export type RespuestaBusqueda =
  | { tipo: "ficha"; ficha: Ficha }
  | { tipo: "candidatos"; consulta: string; candidatos: Candidato[]; completa: boolean; fuentes: EstadoFuente[] };
