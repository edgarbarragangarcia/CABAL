import { seededRandom } from "./network";
import type { CrmContact, CrmField, CrmSnapshot } from "./types";

/**
 * Contactos INVENTADOS para ver la Red Cabal antes de conectar Bitrix24.
 * Son siempre los mismos (semilla fija) e imitan cómo suele verse el CRM de
 * la Fundación: gente agrupada por ciudad y barrio, con intereses, eventos y
 * cursos en común, y líderes que traen a personas de su zona.
 */

const TOTAL = 360;

type Zone = {
  ciudad: string;
  depto: string;
  peso: number;
  barrios: string[];
  intereses: string[];
  actividades: string[];
  lider: string;
};

const ZONES: Zone[] = [
  {
    ciudad: "Cali",
    depto: "Valle del Cauca",
    peso: 5,
    barrios: ["San Fernando", "Ciudad Jardín", "El Ingenio", "Granada", "Pance"],
    intereses: ["Seguridad", "Emprendimiento"],
    actividades: ["Encuentro regional Valle", "Taller de liderazgo"],
    lider: "Patricia Londoño",
  },
  {
    ciudad: "Bogotá",
    depto: "Bogotá D.C.",
    peso: 5,
    barrios: ["Suba", "Usaquén", "Chapinero", "Kennedy", "Engativá"],
    intereses: ["Educación", "Seguridad"],
    actividades: ["Escuela de formación política", "Foro Libertad 2026"],
    lider: "Hernán Ocampo",
  },
  {
    ciudad: "Medellín",
    depto: "Antioquia",
    peso: 4,
    barrios: ["Laureles", "El Poblado", "Belén", "La América"],
    intereses: ["Emprendimiento", "Economía"],
    actividades: ["Diplomado en economía", "Foro Libertad 2026"],
    lider: "Beatriz Arango",
  },
  {
    ciudad: "Palmira",
    depto: "Valle del Cauca",
    peso: 2,
    barrios: ["Centro", "Zamorano", "La Emilia"],
    intereses: ["Campo", "Economía"],
    actividades: ["Encuentro regional Valle"],
    lider: "Óscar Valencia",
  },
  {
    ciudad: "Tuluá",
    depto: "Valle del Cauca",
    peso: 2,
    barrios: ["Alvernia", "La Victoria"],
    intereses: ["Campo", "Familia"],
    actividades: ["Taller de liderazgo"],
    lider: "Gloria Serna",
  },
  {
    ciudad: "Barranquilla",
    depto: "Atlántico",
    peso: 2,
    barrios: ["El Prado", "Riomar", "Boston"],
    intereses: ["Salud", "Familia"],
    actividades: ["Escuela de formación política"],
    lider: "Rafael Fontalvo",
  },
  {
    ciudad: "Bucaramanga",
    depto: "Santander",
    peso: 2,
    barrios: ["Cabecera", "Provenza"],
    intereses: ["Educación", "Cultura"],
    actividades: ["Diplomado en economía"],
    lider: "Silvia Rueda",
  },
];

const INTERESES = ["Seguridad", "Educación", "Economía", "Emprendimiento", "Campo", "Familia", "Salud", "Cultura"];
const ACTIVIDADES = [
  "Foro Libertad 2026",
  "Escuela de formación política",
  "Taller de liderazgo",
  "Diplomado en economía",
  "Encuentro regional Valle",
];
const TIPOS: [string, number][] = [
  ["Simpatizante", 50],
  ["Voluntario", 25],
  ["Estudiante", 13],
  ["Donante", 12],
];
const NOMBRES = [
  "Ana", "Luis", "María", "Carlos", "Paula", "Jorge", "Diana", "Andrés", "Laura", "Felipe",
  "Sofía", "Juan", "Camila", "Santiago", "Valentina", "Julián", "Daniela", "Mateo", "Natalia",
  "Sebastián", "Carolina", "Alejandro", "Isabela", "Miguel", "Gabriela", "Nicolás", "Mariana",
  "David", "Lucía", "Esteban",
];
const APELLIDOS = [
  "Gómez", "Rodríguez", "López", "Martínez", "García", "Pérez", "Sánchez", "Ramírez", "Torres",
  "Díaz", "Rojas", "Vargas", "Moreno", "Jiménez", "Castro", "Ortiz", "Muñoz", "Herrera",
  "Castaño", "Ospina", "Restrepo", "Cardona", "Osorio", "Quintero", "Mejía",
];

// Campos como los que tendría el CRM (códigos DEMO_* para no mezclarse con los reales).
const FIELDS: Omit<CrmField, "values" | "filled">[] = [
  { key: "DEMO_CIUDAD", label: "Ciudad", type: "string", auto: "lugar" },
  { key: "DEMO_DEPTO", label: "Departamento", type: "string", auto: "lugar" },
  { key: "DEMO_BARRIO", label: "Barrio", type: "string", auto: "lugar" },
  { key: "DEMO_INTERESES", label: "Temas de interés", type: "enum", auto: "intereses" },
  { key: "DEMO_TIPO", label: "Tipo de contacto", type: "status", auto: "intereses" },
  { key: "DEMO_EVENTOS", label: "Eventos y cursos", type: "enum", auto: "actividades" },
  { key: "DEMO_REFERIDO", label: "Referido por", type: "contact", auto: "referidos" },
  { key: "DEMO_LIDER", label: "Líder de zona", type: "employee", auto: "referidos" },
];
const [CIUDAD, DEPTO, BARRIO, INTERES, TIPO, EVENTO, REFERIDO, LIDER] = FIELDS.map((_, i) => i);

function build(): CrmSnapshot {
  const random = seededRandom(20260925);
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
  const weighted = <T,>(items: [T, number][]) => {
    let r = random() * items.reduce((s, [, w]) => s + w, 0);
    for (const [item, w] of items) if ((r -= w) < 0) return item;
    return items[items.length - 1][0];
  };

  const dicts = FIELDS.map(() => ({ values: [] as string[], index: new Map<string, number>(), refs: [] as string[] }));
  const valueOf = (field: number, label: string, ref?: string) => {
    const d = dicts[field];
    let i = d.index.get(label);
    if (i === undefined) {
      i = d.values.length;
      d.index.set(label, i);
      d.values.push(label);
      if (ref) d.refs.push(ref);
    }
    return i;
  };

  const used = new Set<string>();
  const people = Array.from({ length: TOTAL }, (_, n) => {
    let name = "";
    do name = `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`;
    while (used.has(name));
    used.add(name);

    const zone = weighted(ZONES.map((z) => [z, z.peso]));
    // Unos barrios concentran más gente que otros.
    const barrio = zone.barrios[Math.floor(random() ** 1.6 * zone.barrios.length)];
    const intereses = new Set([random() < 0.75 ? pick(zone.intereses) : pick(INTERESES)]);
    if (random() < 0.45) intereses.add(pick(INTERESES));
    const eventos = new Set<string>();
    if (random() < 0.6) eventos.add(pick(zone.actividades));
    if (random() < 0.2) eventos.add(pick(ACTIVIDADES));

    const v: [number, number[]][] = [
      [CIUDAD, [valueOf(CIUDAD, zone.ciudad)]],
      [DEPTO, [valueOf(DEPTO, zone.depto)]],
      [BARRIO, [valueOf(BARRIO, `${barrio} (${zone.ciudad})`)]],
      [INTERES, [...intereses].map((x) => valueOf(INTERES, x))],
      [TIPO, [valueOf(TIPO, weighted(TIPOS))]],
    ];
    if (eventos.size) v.push([EVENTO, [...eventos].map((x) => valueOf(EVENTO, x))]);
    if (random() < 0.25) v.push([LIDER, [valueOf(LIDER, zone.lider)]]);
    const contact: CrmContact = { id: `ejemplo-${n + 1}`, name, v };
    return { contact, zone };
  });

  // Multiplicadores: traen de 2 a 9 personas, casi siempre de su misma ciudad.
  for (let k = 0; k < 30; k++) {
    const referrer = pick(people);
    const ref = valueOf(REFERIDO, referrer.contact.name, referrer.contact.id);
    const count = 2 + Math.floor(random() * 8);
    for (let i = 0; i < count; i++) {
      const sameZone = random() < 0.9;
      const pool = people.filter(
        (p) =>
          p !== referrer &&
          (!sameZone || p.zone === referrer.zone) &&
          !p.contact.v.some(([f]) => f === REFERIDO)
      );
      if (!pool.length) break;
      pick(pool).contact.v.push([REFERIDO, [ref]]);
    }
  }

  const contacts = people.map((p) => p.contact);
  const fields: CrmField[] = FIELDS.map((f, i) => ({
    ...f,
    values: dicts[i].values,
    ...(f.type === "contact" ? { contactRefs: dicts[i].refs } : {}),
    filled: contacts.filter((c) => c.v.some(([fi]) => fi === i)).length,
  }));
  return { portal: "ejemplo", fetchedAt: "2026-09-25T00:00:00.000Z", total: TOTAL, fields, contacts };
}

let cached: CrmSnapshot | null = null;

/** La red de ejemplo (se arma una sola vez). */
export function demoSnapshot(): CrmSnapshot {
  return (cached ??= build());
}
