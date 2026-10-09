/** Lo que comparten el buscador de contratos, su ficha y la sección de Avales. */

export type Consulta = { modo: "cedula" | "nit" | "nombre"; q: string; nombre?: string };
export type Navegar = (c: Consulta) => void;

/** Un documento de 9 dígitos casi siempre es un NIT; el resto, una cédula. La búsqueda es la misma: solo cambia si se mira como entidad. */
export const consultaDe = (documento: string): Consulta => ({ modo: documento.length === 9 ? "nit" : "cedula", q: documento });
