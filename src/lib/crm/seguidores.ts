import type { Network } from "./network";
import type { CrmSnapshot } from "./types";
import { RE_DEPARTAMENTO, RE_MUNICIPIO, mismoLugar } from "./votos";

/**
 * Los contactos del CRM que viven en un departamento o municipio, ordenados por a cuánta gente trajeron y con cuántos están
 * conectados: sus principales seguidores en ese lugar. Con Bitrix24 sin conectar, son los contactos de ejemplo.
 */

export type Seguidor = { id: string; nombre: string; municipio: string | null; trajo: number; conexiones: number; comunidad: number };
export type Seguidores = {
  /** El CRM tiene un campo de departamento o municipio con el que ubicar a la gente. */
  hayCampo: boolean;
  /** Cuántos contactos hay en ese lugar. */
  total: number;
  seguidores: Seguidor[];
};

const campo = (snapshot: CrmSnapshot, re: RegExp) => snapshot.fields.findIndex((f) => (f.type === "string" || f.type === "enum") && re.test(f.label));

export function seguidoresEn(
  snapshot: CrmSnapshot,
  red: Network,
  lugar: { nivel: "departamento" | "municipio"; nombre: string; departamento?: string },
  limite = 8
): Seguidores {
  const iDepto = campo(snapshot, RE_DEPARTAMENTO);
  const iMuni = campo(snapshot, RE_MUNICIPIO);
  const iLugar = lugar.nivel === "departamento" ? iDepto : iMuni;
  if (iLugar < 0) return { hayCampo: false, total: 0, seguidores: [] };

  const valor = (j: number, i: number) => {
    const par = snapshot.contacts[j].v.find(([f]) => f === i);
    return par ? snapshot.fields[i].values[par[1][0]] : undefined;
  };
  const enLugar: Seguidor[] = [];
  for (let j = 0; j < snapshot.contacts.length; j++) {
    const v = valor(j, iLugar);
    if (!v || !mismoLugar(v, lugar.nombre)) continue;
    // Un municipio se confirma con su departamento si el CRM lo tiene, para no mezclar homónimos (Bolívar del Cauca y de Santander).
    if (lugar.nivel === "municipio" && lugar.departamento && iDepto >= 0) {
      const d = valor(j, iDepto);
      if (d && !mismoLugar(d, lugar.departamento)) continue;
    }
    const nodo = red.nodes[j];
    if (!nodo) continue;
    enLugar.push({
      id: nodo.id,
      nombre: nodo.name,
      municipio: iMuni >= 0 ? (valor(j, iMuni) ?? null) : null,
      trajo: nodo.referred.length,
      conexiones: nodo.degree,
      comunidad: nodo.community,
    });
  }
  enLugar.sort((a, b) => b.trajo - a.trajo || b.conexiones - a.conexiones || a.nombre.localeCompare(b.nombre, "es"));
  return { hayCampo: true, total: enLugar.length, seguidores: enLugar.slice(0, limite) };
}
