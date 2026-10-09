import "server-only";

import { cacheSiCompleto } from "./cache";
import { SECOP_DATASETS as DS } from "./datasets";
import { consultaNombre, contieneNombre, documentoSegunTipo, normalizarNombre, palabrasNombre } from "./documento";
import { limpio, medir, plano, type Fila } from "./fuentes";
import type { Candidato, EstadoFuente, RolContrato } from "./tipos";

/**
 * Buscar por nombre: quién se llama así en el SECOP. Un nombre no identifica a nadie (hay
 * homónimos), así que no se devuelven contratos sino una lista de personas y empresas con su
 * documento, para elegir la correcta y abrir su ficha.
 *
 * Usa la búsqueda de texto completo de Socrata (`$q`): ~0,5 s, ordena por relevancia y no
 * distingue tildes, a diferencia de un LIKE (2–6 s y sensible a tildes). Como mezcla todas las
 * columnas, cada fila se revisa aquí: solo cuentan los nombres que contienen todas las palabras.
 */

const POR_RONDA = 120;
const RONDAS = 3;
const MAX_CANDIDATOS = 24;

type Identidad = { nombre: string; documento: string | null; crudo: string; rol: RolContrato; tipoDoc: string; entidad: string };

type Origen = { id: string; titulo: string; select: string; excluir: string; leer: (f: Fila) => Identidad[] };

const ref = (nombre: unknown, crudo: unknown, rol: RolContrato, tipoDoc: unknown, entidad: unknown): Identidad | null => {
  const n = limpio(nombre);
  return n ? { nombre: n, documento: documentoSegunTipo(String(crudo ?? ""), limpio(tipoDoc)), crudo: String(crudo ?? ""), rol, tipoDoc: limpio(tipoDoc), entidad: limpio(entidad) } : null;
};
const sinNulos = (l: (Identidad | null)[]) => l.filter((x): x is Identidad => x !== null);

const ORIGENES: Origen[] = [
  {
    id: DS.contratosII.id,
    titulo: "SECOP II · contratos",
    select: "documento_proveedor,proveedor_adjudicado,tipodocproveedor,nombre_entidad,nombre_representante_legal,identificaci_n_representante_legal,nombre_supervisor,n_mero_de_documento_supervisor,nombre_ordenador_del_gasto,n_mero_de_documento_ordenador_del_gasto,nombre_ordenador_de_pago,n_mero_de_documento_ordenador_de_pago",
    excluir: "documento_proveedor",
    leer: (f) =>
      sinNulos([
        ref(f.proveedor_adjudicado, f.documento_proveedor, "contratista", f.tipodocproveedor, f.nombre_entidad),
        // Una persona natural figura como su propio representante legal: eso no es otro papel.
        normalizarNombre(String(f.nombre_representante_legal ?? "")) === normalizarNombre(String(f.proveedor_adjudicado ?? ""))
          ? null
          : ref(f.nombre_representante_legal, f.identificaci_n_representante_legal, "representante", "", f.nombre_entidad),
        ref(f.nombre_supervisor, f.n_mero_de_documento_supervisor, "supervisor", "", f.nombre_entidad),
        ref(f.nombre_ordenador_del_gasto, f.n_mero_de_documento_ordenador_del_gasto, "ordenador_gasto", "", f.nombre_entidad),
        ref(f.nombre_ordenador_de_pago, f.n_mero_de_documento_ordenador_de_pago, "ordenador_pago", "", f.nombre_entidad),
      ]),
  },
  ...[DS.procesosI, DS.procesosIHistorico].map(
    (d): Origen => ({
      id: d.id,
      titulo: d.id === DS.procesosI.id ? "SECOP I · procesos" : "SECOP I (histórico)",
      select: "identificacion_del_contratista,nom_razon_social_contratista,tipo_identifi_del_contratista,nombre_entidad,identific_representante_legal,nombre_del_represen_legal",
      excluir: "identificacion_del_contratista",
      leer: (f) =>
        sinNulos([
          ref(f.nom_razon_social_contratista, f.identificacion_del_contratista, "contratista", f.tipo_identifi_del_contratista, f.nombre_entidad),
          normalizarNombre(String(f.nombre_del_represen_legal ?? "")) === normalizarNombre(String(f.nom_razon_social_contratista ?? ""))
            ? null
            : ref(f.nombre_del_represen_legal, f.identific_representante_legal, "representante", "", f.nombre_entidad),
        ]),
    })
  ),
  {
    id: DS.proveedoresII.id,
    titulo: "SECOP II · proveedores registrados",
    select: "nit,nombre,tipo_empresa,nombre_representante_legal,n_mero_doc_representante_legal",
    excluir: "nit",
    leer: (f) => sinNulos([ref(f.nombre, f.nit, "contratista", /natural/i.test(String(f.tipo_empresa ?? "")) ? "Cédula de Ciudadanía" : "NIT", ""), ref(f.nombre_representante_legal, f.n_mero_doc_representante_legal, "representante", "", "")]),
  },
];

type Grupo = { clave: string; nombres: Map<string, number>; documento: string | null; tipos: Map<string, number>; roles: Map<RolContrato, number>; entidades: Map<string, number>; n: number };

async function buscar(nombre: string): Promise<{ candidatos: Candidato[]; completa: boolean; fuentes: EstadoFuente[] }> {
  const palabras = palabrasNombre(nombre);
  if (palabras.length === 0 || (palabras.length === 1 && palabras[0].length < 4)) throw new Error("Escribe al menos un nombre y un apellido (o el nombre de la empresa).");
  const q = consultaNombre(nombre);

  const grupos = new Map<string, Grupo>();
  const crudosVistos = new Map<string, Set<string>>(ORIGENES.map((o) => [o.id, new Set<string>()]));
  const fuentes = new Map<string, EstadoFuente>();
  let completa = true;

  for (let ronda = 0; ronda < RONDAS; ronda++) {
    const respuestas = await Promise.all(
      ORIGENES.map((o) => {
        const vistos = [...(crudosVistos.get(o.id) ?? [])].slice(0, 60);
        const sin = vistos.length ? `${o.excluir} NOT IN (${vistos.map((v) => `'${v.replace(/'/g, "''")}'`).join(",")})` : undefined;
        return medir(o.titulo, o.id, { $q: q, $select: o.select, $limit: POR_RONDA, ...(sin ? { $where: sin } : {}) });
      })
    );

    let nuevos = 0;
    let llenas = false;
    respuestas.forEach((r, k) => {
      const origen = ORIGENES[k];
      const previo = fuentes.get(origen.id);
      fuentes.set(origen.id, { ...r.estado, n: (previo?.n ?? 0) + r.estado.n, ms: (previo?.ms ?? 0) + r.estado.ms });
      if (r.filas.length >= POR_RONDA) llenas = true;
      for (const f of r.filas) {
        // Para que la ronda siguiente salte lo ya visto: el valor crudo de la columna por la que se excluye.
        const columna = origen.excluir;
        if (typeof f[columna] === "string") crudosVistos.get(origen.id)!.add(f[columna] as string);
        for (const id of origen.leer(f)) {
          if (!contieneNombre(nombre, id.nombre)) continue;
          const clave = id.documento ?? `n:${normalizarNombre(id.nombre)}`;
          let g = grupos.get(clave);
          if (!g) {
            g = { clave, nombres: new Map(), documento: id.documento, tipos: new Map(), roles: new Map(), entidades: new Map(), n: 0 };
            grupos.set(clave, g);
            nuevos++;
          }
          g.n++;
          g.nombres.set(id.nombre, (g.nombres.get(id.nombre) ?? 0) + 1);
          if (id.tipoDoc) g.tipos.set(plano(id.tipoDoc), (g.tipos.get(plano(id.tipoDoc)) ?? 0) + 1);
          g.roles.set(id.rol, (g.roles.get(id.rol) ?? 0) + 1);
          if (id.entidad) g.entidades.set(id.entidad, (g.entidades.get(id.entidad) ?? 0) + 1);
        }
      }
    });
    // Se sigue solo mientras aparezcan personas nuevas y todavía haya filas por ver.
    completa = !llenas;
    if (nuevos === 0 || !llenas) break;
  }

  // Un nombre sin documento (la persona natural que se representa a sí misma no lo trae) suele ser la
  // misma persona que otro candidato con documento: si hay uno solo con ese nombre, se suman.
  const sumarMapa = <K>(a: Map<K, number>, b: Map<K, number>) => b.forEach((v, k) => a.set(k, (a.get(k) ?? 0) + v));
  const conDocumento = [...grupos.values()].filter((g) => g.documento);
  for (const g of [...grupos.values()].filter((g) => !g.documento)) {
    const claves = new Set([...g.nombres.keys()].map(normalizarNombre));
    const destinos = conDocumento.filter((d) => [...d.nombres.keys()].some((n) => claves.has(normalizarNombre(n))));
    if (destinos.length !== 1) continue;
    const d = destinos[0];
    d.n += g.n;
    sumarMapa(d.nombres, g.nombres);
    sumarMapa(d.roles, g.roles);
    sumarMapa(d.entidades, g.entidades);
    grupos.delete(g.clave);
  }

  if ([...fuentes.values()].every((f) => !f.ok)) throw new Error("El portal de datos abiertos (datos.gov.co) no respondió. Intenta de nuevo en unos minutos.");

  const top = <K>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  const candidatos = [...grupos.values()].map((g): Candidato => {
    const nombreMostrado = top(g.nombres)[0][0];
    const tipo = top(g.tipos)[0]?.[0] ?? "";
    return {
      clave: g.clave,
      nombre: nombreMostrado,
      documento: g.documento,
      tipoDoc: /\bnit\b/.test(tipo) ? "nit" : /cedula|ciudadania|extranjeria/.test(tipo) ? "cedula" : null,
      roles: top(g.roles).map(([rol, n]) => ({ rol, n })),
      n: g.n,
      entidades: top(g.entidades).slice(0, 3).map(([e]) => e),
      exacta: [...g.nombres.keys()].some((n) => palabrasNombre(n).length === palabras.length),
    };
  });
  candidatos.sort((a, b) => Number(b.exacta) - Number(a.exacta) || Number(!!b.documento) - Number(!!a.documento) || b.n - a.n);
  return { candidatos: candidatos.slice(0, MAX_CANDIDATOS), completa: completa && candidatos.length <= MAX_CANDIDATOS, fuentes: [...fuentes.values()] };
}

/** Una búsqueda por nombre cuesta hasta una docena de consultas: se guarda 15 minutos, y solo si respondieron todas las fuentes. */
export const buscarCandidatos = cacheSiCompleto(buscar, ["secop-candidatos-v2"], 900, (r) => r.fuentes.every((f) => f.ok));
