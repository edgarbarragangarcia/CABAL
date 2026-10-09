import "server-only";

import { esCelebrado, relacionesDe, senalesDe, totalesDe } from "./analisis";
import { cacheSiCompleto } from "./cache";
import { SECOP_DATASETS as DS, VALOR_MAXIMO } from "./datasets";
import { clausulaDocumento as doc, digitoVerificacion, documentoSegunTipo, mismoDocumento, normalizarNombre, palabrasNombre, parecido, parseDocumento } from "./documento";
import { hoyCO } from "./formato";
import { deSecopI, deSecopII, limpio, lugar, medir, persona, plano, SELECT_I, SELECT_II, sinRepetidos, type Fila } from "./fuentes";
import type { ContratoSecop, EstadoFuente, Ficha, RegistroProveedor, RolContrato, Vinculo } from "./tipos";

/**
 * Todo lo que el SECOP I y II dicen de un documento (cédula o NIT): sus contratos, los de las
 * empresas que representa, su papel de supervisor u ordenador y con quiénes se relaciona.
 * Las consultas por documento responden en ~0,5–1 s, así que se hacen todas a la vez.
 */

const TOPE_CONTRATISTA = 300;
const TOPE_REPRESENTANTE = 200;
const TOPE_FUNCIONARIO = 300;
const SIN_ATIPICOS = `valor_del_contrato < ${VALOR_MAXIMO}`;

const porFecha = (a: ContratoSecop, b: ContratoSecop) => (b.fechaFirma ?? "").localeCompare(a.fechaFirma ?? "");
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Ejecuta una consulta solo si hace falta; si no, un resultado vacío. */
const si = <T>(cond: boolean, tarea: () => Promise<T>): Promise<T | null> => (cond ? tarea() : Promise.resolve(null));

/** El mismo nombre aunque cambie el orden («PEREZ JUAN» / «JUAN PEREZ») o el sufijo societario («S.A.S» / «S.A.»). */
const claveNombre = (s: string) => {
  const p = palabrasNombre(s);
  return p.length ? [...new Set(p)].sort().join(" ") : normalizarNombre(s);
};

function nombresDe(contratos: ContratoSecop[]): { nombre: string; n: number }[] {
  const cuenta = new Map<string, { nombre: string; n: number; variantes: Map<string, number> }>();
  for (const c of contratos) {
    const crudo = c.contratista.nombre;
    if (!crudo) continue;
    const clave = claveNombre(crudo);
    const e = cuenta.get(clave) ?? { nombre: crudo, n: 0, variantes: new Map() };
    e.n++;
    e.variantes.set(crudo, (e.variantes.get(crudo) ?? 0) + 1);
    cuenta.set(clave, e);
  }
  return [...cuenta.values()]
    .map((e) => ({ nombre: [...e.variantes.entries()].sort((a, b) => b[1] - a[1])[0][0], n: e.n }))
    .sort((a, b) => b.n - a.n);
}

const SOCIETARIO = /\b(sas|s a s|ltda|s a|e s p|esp|fundacion|corporacion|asociacion|union temporal|consorcio|cooperativa|sociedad|empresa|compania|e u|y cia)\b/;

function tipoDe(contratos: ContratoSecop[], registros: RegistroProveedor[], nombre: string | undefined): Ficha["tipo"] {
  let persona_ = 0;
  let empresa = 0;
  for (const c of contratos) {
    const t = plano(c.tipoDocContratista);
    if (/\bnit\b/.test(t)) empresa++;
    else if (/cedula|ciudadania|extranjeria/.test(t)) persona_++;
  }
  for (const r of registros.filter((r) => r.relacion === "propio")) {
    const t = plano(r.tipo);
    if (/persona natural/.test(t)) persona_++;
    else if (t) empresa++;
  }
  if (nombre && SOCIETARIO.test(normalizarNombre(nombre).toLowerCase().replace(/\./g, " "))) empresa += 2;
  if (persona_ === empresa) return "indeterminado";
  return persona_ > empresa ? "persona" : "empresa";
}

function aRegistro(r: Fila, numero: string): RegistroProveedor | null {
  const propio = mismoDocumento(String(r.nit ?? ""), numero);
  const representado = mismoDocumento(String(r.n_mero_doc_representante_legal ?? ""), numero);
  if (!propio && !representado) return null;
  const activa = limpio(r.esta_activa).toLowerCase();
  return {
    nit: parseDocumento(String(r.nit ?? ""))?.numero ?? limpio(r.nit),
    nombre: limpio(r.nombre),
    tipo: limpio(r.tipo_empresa),
    ubicacion: lugar(r.municipio, r.departamento),
    creado: typeof r.fecha_creacion === "string" ? r.fecha_creacion.slice(0, 10) : null,
    activo: activa === "si" ? true : activa === "no" ? false : null,
    representante: persona(r.nombre_representante_legal, r.n_mero_doc_representante_legal),
    relacion: propio ? "propio" : "representado",
  };
}

/** Lo mínimo del SECOP I para saber con quién contrata alguien: pasa por `deSecopI` como cualquier otro contrato. */
const SELECT_I_RELACION = [
  "uid", "estado_del_proceso", "fecha_de_firma_del_contrato", "fecha_fin_ejec_contrato", "cuantia_contrato", "valor_contrato_con_adiciones",
  "identificacion_del_contratista", "tipo_identifi_del_contratista", "nom_razon_social_contratista", "nombre_entidad", "nit_de_la_entidad",
].join(",");
const TOPE_RELACION_I = 150;

/** Otras empresas que comparten representante legal con una empresa (segundo salto de la red), en SECOP II, SECOP I y el registro de proveedores. */
async function relacionadasPor(numero: string, representantes: Vinculo[], hoy: string): Promise<{ lista: Vinculo[]; fuentes: EstadoFuente[] }> {
  const reps = representantes.filter((r) => r.documento && r.documento !== numero).slice(0, 3);
  if (reps.length === 0) return { lista: [], fuentes: [] };

  const tareas = reps.map(async (r) => {
    const deSecop1 = (id: string, titulo: string) =>
      medir(titulo, id, {
        $select: SELECT_I_RELACION,
        $where: `${doc("identific_representante_legal", r.documento!)} AND NOT ${doc("identificacion_del_contratista", numero)}`,
        $order: "fecha_de_firma_del_contrato DESC NULLS LAST",
        $limit: TOPE_RELACION_I,
      });
    const [c, g, i1, i2] = await Promise.all([
      medir(`SECOP II · otras empresas de ${r.nombre}`, DS.contratosII.id, {
        $select: "documento_proveedor,tipodocproveedor,proveedor_adjudicado,count(*) as n,sum(valor_del_contrato) as v,max(fecha_de_firma) as u",
        $where: `${doc("identificaci_n_representante_legal", r.documento!)} AND NOT ${doc("documento_proveedor", numero)} AND ${SIN_ATIPICOS}`,
        $group: "documento_proveedor,tipodocproveedor,proveedor_adjudicado",
        $order: "n DESC",
        $limit: 20,
      }),
      medir(`Registro · otras empresas de ${r.nombre}`, DS.proveedoresII.id, { $where: doc("n_mero_doc_representante_legal", r.documento!), $limit: 30 }),
      deSecop1(DS.procesosI.id, `SECOP I · otras empresas de ${r.nombre}`),
      deSecop1(DS.procesosIHistorico.id, `SECOP I (histórico) · otras empresas de ${r.nombre}`),
    ]);
    return { r, c, g, i1, i2 };
  });

  const resultados = await Promise.all(tareas);
  const mapa = new Map<string, Vinculo & { _n: Map<string, number> }>();
  const acumular = (clave: string, nombre: string, documento: string | null, n: number, valor: number, ultima: string | null, de: string) => {
    const v = mapa.get(clave) ?? { clave, nombre, documento, n: 0, valor: 0, ultima: null, detalle: `mismo representante: ${de}`, _n: new Map() };
    v.n += n;
    v.valor += valor;
    if (ultima && (!v.ultima || ultima > v.ultima)) v.ultima = ultima;
    v._n.set(nombre, (v._n.get(nombre) ?? 0) + n);
    mapa.set(clave, v);
  };
  for (const { r, c, g, i1, i2 } of resultados) {
    for (const f of c.filas) {
      const d = documentoSegunTipo(String(f.documento_proveedor ?? ""), limpio(f.tipodocproveedor));
      const nombre = limpio(f.proveedor_adjudicado);
      // Si el representante contrata a título personal, esa no es «otra empresa».
      if ((!d && !nombre) || d === r.documento) continue;
      acumular(d ?? normalizarNombre(nombre), nombre, d, num(f.n), num(f.v), typeof f.u === "string" ? f.u.slice(0, 10) : null, r.nombre);
    }
    // SECOP I repite el contrato por rubro (uno por `uid`) y solo cuentan los celebrados.
    for (const k of sinRepetidos([...i1.filas, ...i2.filas].map((f) => deSecopI(f, hoy))).filter(esCelebrado)) {
      const d = k.contratista.documento;
      const nombre = k.contratista.nombre;
      if ((!d && !nombre) || d === numero || d === r.documento) continue;
      acumular(d ?? normalizarNombre(nombre), nombre, d, 1, k.valor ?? 0, k.fechaFirma, r.nombre);
    }
    for (const f of g.filas) {
      const d = parseDocumento(String(f.nit ?? ""))?.numero ?? null;
      if (!d || d === numero || d === r.documento || mismoDocumento(String(f.nit ?? ""), numero)) continue;
      if (!mapa.has(d)) acumular(d, limpio(f.nombre), d, 0, 0, null, r.nombre);
    }
  }
  const lista = [...mapa.values()]
    .map(({ _n, ...v }) => ({ ...v, nombre: [..._n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? v.nombre }))
    .sort((a, b) => b.n - a.n || b.valor - a.valor)
    .slice(0, 10);
  return { lista, fuentes: resultados.flatMap((x) => [x.c.estado, x.g.estado, x.i1.estado, x.i2.estado]) };
}

export async function construirFicha(numero: string, modo: "cedula" | "nit"): Promise<Ficha> {
  const hoy = hoyCO();
  const { contratosII: II, procesosI: I1, procesosIHistorico: I2, proveedoresII: REG } = DS;
  const orden2 = "fecha_de_firma DESC NULLS LAST"; // los borradores sin fecha no deben desplazar a los contratos reales
  const orden1 = "fecha_de_firma_del_contrato DESC NULLS LAST";
  const esNit = modo === "nit";

  const [c2, r2, f2, c1a, c1b, r1a, r1b, regs, entTotal, entTop, entNombre] = await Promise.all([
    medir("SECOP II · como contratista", II.id, { $select: SELECT_II, $where: doc("documento_proveedor", numero), $order: orden2, $limit: TOPE_CONTRATISTA }),
    medir("SECOP II · como representante legal", II.id, {
      $select: SELECT_II,
      $where: `${doc("identificaci_n_representante_legal", numero)} AND NOT ${doc("documento_proveedor", numero)}`,
      $order: orden2,
      $limit: TOPE_REPRESENTANTE,
    }),
    medir("SECOP II · como supervisor u ordenador", II.id, {
      $select: SELECT_II,
      $where: `${doc("n_mero_de_documento_supervisor", numero)} OR ${doc("n_mero_de_documento_ordenador_del_gasto", numero)} OR ${doc("n_mero_de_documento_ordenador_de_pago", numero)}`,
      $order: orden2,
      $limit: TOPE_FUNCIONARIO,
    }),
    medir("SECOP I · como contratista", I1.id, { $select: SELECT_I, $where: doc("identificacion_del_contratista", numero), $order: orden1, $limit: TOPE_CONTRATISTA }),
    medir("SECOP I (histórico) · como contratista", I2.id, { $select: SELECT_I, $where: doc("identificacion_del_contratista", numero), $order: orden1, $limit: TOPE_CONTRATISTA }),
    medir("SECOP I · como representante legal", I1.id, {
      $select: SELECT_I,
      $where: `${doc("identific_representante_legal", numero)} AND NOT ${doc("identificacion_del_contratista", numero)}`,
      $order: orden1,
      $limit: TOPE_REPRESENTANTE,
    }),
    medir("SECOP I (histórico) · como representante legal", I2.id, {
      $select: SELECT_I,
      $where: `${doc("identific_representante_legal", numero)} AND NOT ${doc("identificacion_del_contratista", numero)}`,
      $order: orden1,
      $limit: TOPE_REPRESENTANTE,
    }),
    medir("SECOP II · proveedores registrados", REG.id, { $where: `${doc("nit", numero)} OR ${doc("n_mero_doc_representante_legal", numero)}`, $limit: 100 }),
    si(esNit, () => medir("SECOP II · como entidad contratante", II.id, { $select: "count(*) as n,sum(valor_del_contrato) as v", $where: `nit_entidad=${numero} AND ${SIN_ATIPICOS}` })),
    si(esNit, () =>
      medir("SECOP II · principales contratistas de la entidad", II.id, {
        $select: "documento_proveedor,tipodocproveedor,proveedor_adjudicado,count(*) as n,sum(valor_del_contrato) as v,max(fecha_de_firma) as u",
        $where: `nit_entidad=${numero} AND ${SIN_ATIPICOS}`,
        $group: "documento_proveedor,tipodocproveedor,proveedor_adjudicado",
        $order: "v DESC",
        $limit: 8,
      })
    ),
    si(esNit, () => medir("SECOP II · nombre de la entidad", II.id, { $select: "nombre_entidad,count(*) as n", $where: `nit_entidad=${numero}`, $group: "nombre_entidad", $order: "n DESC", $limit: 3 })),
  ]);

  // Si ninguna fuente respondió, mostrar «sin contratos» sería mentir: es un error del portal, no un resultado.
  if ([c2, r2, f2, c1a, c1b, r1a, r1b, regs].every((x) => !x.estado.ok)) {
    throw new Error("El portal de datos abiertos (datos.gov.co) no respondió. Intenta de nuevo en unos minutos.");
  }

  // Como contratista: SECOP II y SECOP I (sin los repetidos por rubro), verificando que el documento sea exactamente este.
  const ya = (c: ContratoSecop) => mismoDocumento(c.contratista.documento, numero);
  const contratos: ContratoSecop[] = sinRepetidos([
    ...c2.filas.map((r) => deSecopII(r, hoy)),
    ...[...c1a.filas, ...c1b.filas].map((r) => deSecopI(r, hoy)),
  ])
    .filter(ya)
    .map((c) => ({ ...c, roles: ["contratista" as RolContrato] }))
    .sort(porFecha);

  // Si además lo supervisa u ordena, el contrato lo dice en sus roles.
  const rolesFuncionario = (c: ContratoSecop): RolContrato[] =>
    [
      mismoDocumento(c.ordenadorGasto?.documento, numero) && "ordenador_gasto",
      mismoDocumento(c.supervisor?.documento, numero) && "supervisor",
      mismoDocumento(c.ordenadorPago?.documento, numero) && "ordenador_pago",
    ].filter(Boolean) as RolContrato[];
  for (const c of contratos) c.roles.push(...rolesFuncionario(c));

  const idsPropios = new Set(contratos.map((c) => `${c.fuente}:${c.id}`));
  const comoRepresentante: ContratoSecop[] = sinRepetidos([
    ...r2.filas.map((r) => deSecopII(r, hoy)),
    ...[...r1a.filas, ...r1b.filas].map((r) => deSecopI(r, hoy)),
  ])
    .filter((c) => mismoDocumento(c.representante?.documento, numero) && !ya(c))
    .map((c) => ({ ...c, roles: ["representante" as RolContrato] }))
    .sort(porFecha);

  const comoFuncionario: ContratoSecop[] = sinRepetidos(f2.filas.map((r) => deSecopII(r, hoy)))
    .map((c) => ({ ...c, roles: rolesFuncionario(c) }))
    .filter((c) => c.roles.length > 0 && !idsPropios.has(`${c.fuente}:${c.id}`))
    .sort(porFecha);

  const registros = regs.filas.map((r) => aRegistro(r, numero)).filter((r): r is RegistroProveedor => r !== null);

  // El mismo documento con otros nombres suele ser un error de digitación (o un homónimo mal asignado).
  const nombres = nombresDe(contratos);
  const dominante = nombres[0]?.nombre ?? registros.find((r) => r.relacion === "propio")?.nombre;
  if (dominante) {
    for (const c of contratos) {
      if (c.contratista.nombre && Math.max(parecido(dominante, c.contratista.nombre), parecido(c.contratista.nombre, dominante)) < 0.5) c.nombreDistinto = true;
    }
  }

  const resumen = { contratista: totalesDe(contratos), representante: totalesDe(comoRepresentante), funcionario: totalesDe(comoFuncionario) };

  // Si es una empresa: otras empresas que comparten representante (segundo salto).
  const base = relacionesDe({ numero, contratos, comoRepresentante, comoFuncionario, registros, relacionadas: [] });
  const tipo = tipoDe(contratos, registros, dominante);
  const salto = tipo === "persona" ? { lista: [], fuentes: [] } : await relacionadasPor(numero, base.representantes, hoy);
  const relaciones = { ...base, relacionadas: salto.lista };

  // Como entidad contratante (un NIT puede ser el de una empresa o el de una entidad).
  const nEnt = num(entTotal?.filas[0]?.n);
  const comoEntidad =
    nEnt > 0
      ? {
          n: nEnt,
          valor: num(entTotal?.filas[0]?.v),
          nombres: (entNombre?.filas ?? []).map((f) => limpio(f.nombre_entidad)).filter(Boolean),
          contratistas: (entTop?.filas ?? [])
            .map((f): Vinculo => {
              const d = documentoSegunTipo(String(f.documento_proveedor ?? ""), limpio(f.tipodocproveedor));
              const nombre = limpio(f.proveedor_adjudicado);
              return { clave: d ?? normalizarNombre(nombre), nombre, documento: d, n: num(f.n), valor: num(f.v), ultima: typeof f.u === "string" ? f.u.slice(0, 10) : null };
            })
            .filter((v) => v.nombre || v.documento),
        }
      : null;

  const fuentes = [...[c2, r2, f2, c1a, c1b, r1a, r1b, regs, entTotal, entTop, entNombre].map((x) => x?.estado), ...salto.fuentes].filter((e): e is EstadoFuente => !!e);
  const tope = {
    contratista: [c2, c1a, c1b].some((x) => x.estado.truncado),
    representante: [r2, r1a, r1b].some((x) => x.estado.truncado),
    funcionario: !!f2.estado.truncado,
  };
  const truncado = tope.contratista || tope.representante || tope.funcionario;

  const parcial: Omit<Ficha, "senales"> = {
    numero,
    dv: String(digitoVerificacion(numero)),
    modo,
    tipo,
    nombres: nombres.slice(0, 6),
    contratos,
    comoRepresentante,
    comoFuncionario,
    registros,
    resumen,
    comoEntidad,
    relaciones,
    fuentes,
    truncado,
    tope,
    generadoEn: new Date().toISOString(),
  };
  const ficha: Ficha = { ...parcial, senales: [] };
  return { ...ficha, senales: senalesDe(ficha, hoy) };
}

/**
 * Los datos del SECOP cambian a diario y los contratos vigentes importan: una hora de caché, y solo si respondieron
 * todas las fuentes. La caché de Next sobrevive a los despliegues: si cambia la forma de `Ficha`, hay que subir la versión de la clave.
 */
export const fichaDe = cacheSiCompleto(construirFicha, ["secop-ficha-v5"], 3600, (f) => f.fuentes.every((s) => s.ok));
