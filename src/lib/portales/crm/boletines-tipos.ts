import { z } from "zod";

import { IDS_ETAPA, IDS_ORIGEN, type Etapa, type Origen } from "./tipos";

/** Boletines (campañas por correo) de un portal: tipos y validaciones, sin servidor. */

export type Segmento = {
  etapas?: Etapa[];
  origenes?: Origen[];
  etiqueta?: string;
  ciudad?: string;
};

export const segmentoSchema = z.object({
  etapas: z.array(z.enum(IDS_ETAPA)).max(5).optional(),
  origenes: z.array(z.enum(IDS_ORIGEN)).max(6).optional(),
  etiqueta: z.string().trim().max(40).optional(),
  ciudad: z.string().trim().max(80).optional(),
});

export const boletinSchema = z.object({
  asunto: z.string().trim().min(3, "Escribe el asunto.").max(150),
  cuerpo: z.string().max(20_000).default(""),
  segmento: segmentoSchema.default({}),
});
export type DatosBoletin = z.infer<typeof boletinSchema>;

export type EstadoBoletin = "borrador" | "enviando" | "enviada" | "fallida";

export type Boletin = {
  id: string;
  portalId: string;
  asunto: string;
  cuerpo: string;
  segmento: Segmento;
  estado: EstadoBoletin;
  destinatarios: number;
  enviados: number;
  fallidos: number;
  enviadaEn: string | null;
  creadoPor: string;
  creadoEn: string;
  actualizadoEn: string;
};
