/**
 * Oportunidad por puesto de votación: dónde un candidato tiene más votos por
 * ganar. Es aritmética sobre el preconteo, sin IA ni estimaciones ajenas:
 *
 * - cuota      = votos del candidato / votantes del puesto
 * - potencial  = abstencionistas que quedarían si el puesto votara como el
 *                promedio del territorio, por la cuota del candidato
 *              = max(0, participación media × censo − votantes) × cuota
 *
 * Cada puesto se clasifica por dos cortes, el de su cuota y el de su
 * participación, frente a la mediana del territorio:
 *   Bastión   cuota alta y participación alta  → conservar
 *   Movilizar cuota alta y participación baja  → llevar a votar a los suyos
 *   Persuadir cuota baja y participación alta  → convencer a quien ya vota
 *   Difícil   ambas bajas                      → menor prioridad
 */

export type PuestoDatos = {
  codigo: string;
  nombre: string;
  /** Zona o localidad (código del padre), para agrupar. */
  zona: string;
  censo: number;
  votantes: number;
  votos: number;
};

export type Segmento = "bastion" | "movilizar" | "persuadir" | "dificil";

export type PuestoOportunidad = PuestoDatos & {
  /** Votos del candidato sobre los votantes del puesto, 0–1. */
  cuota: number;
  /** Votantes sobre el censo del puesto, 0–1. */
  participacion: number;
  abstencion: number;
  /** Votos que podría sumar si el puesto llegara a la participación media. */
  potencial: number;
  segmento: Segmento;
};

export type ResumenSegmento = { segmento: Segmento; puestos: number; votos: number; potencial: number };

export type Oportunidad = {
  puestos: PuestoOportunidad[];
  /** Participación media ponderada del territorio (votantes / censo). */
  participacionMedia: number;
  cuotaMedia: number;
  medianaCuota: number;
  medianaParticipacion: number;
  potencialTotal: number;
  segmentos: ResumenSegmento[];
};

export const SEGMENTO_NOMBRE: Record<Segmento, string> = {
  bastion: "Bastión",
  movilizar: "Movilizar",
  persuadir: "Persuadir",
  dificil: "Difícil",
};

const mediana = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function calcularOportunidad(datos: PuestoDatos[]): Oportunidad {
  // Puestos sin censo o sin votantes no dicen nada (mesas sin informar).
  const validos = datos.filter((d) => d.censo > 0 && d.votantes > 0);
  const censo = validos.reduce((s, d) => s + d.censo, 0);
  const votantes = validos.reduce((s, d) => s + d.votantes, 0);
  const votos = validos.reduce((s, d) => s + d.votos, 0);
  const participacionMedia = censo ? votantes / censo : 0;
  const cuotaMedia = votantes ? votos / votantes : 0;

  const base = validos.map((d) => ({
    ...d,
    cuota: d.votos / d.votantes,
    participacion: d.votantes / d.censo,
    abstencion: Math.max(0, d.censo - d.votantes),
  }));
  const medianaCuota = mediana(base.map((d) => d.cuota));
  const medianaParticipacion = mediana(base.map((d) => d.participacion));

  const puestos: PuestoOportunidad[] = base
    .map((d) => {
      const altaCuota = d.cuota >= medianaCuota;
      const altaPart = d.participacion >= medianaParticipacion;
      const segmento: Segmento = altaCuota ? (altaPart ? "bastion" : "movilizar") : altaPart ? "persuadir" : "dificil";
      return {
        ...d,
        potencial: Math.max(0, participacionMedia * d.censo - d.votantes) * d.cuota,
        segmento,
      };
    })
    .sort((a, b) => b.potencial - a.potencial);

  const segmentos = (Object.keys(SEGMENTO_NOMBRE) as Segmento[]).map((segmento) => {
    const del = puestos.filter((p) => p.segmento === segmento);
    return {
      segmento,
      puestos: del.length,
      votos: del.reduce((s, p) => s + p.votos, 0),
      potencial: Math.round(del.reduce((s, p) => s + p.potencial, 0)),
    };
  });

  return {
    puestos,
    participacionMedia,
    cuotaMedia,
    medianaCuota,
    medianaParticipacion,
    potencialTotal: Math.round(puestos.reduce((s, p) => s + p.potencial, 0)),
    segmentos,
  };
}
