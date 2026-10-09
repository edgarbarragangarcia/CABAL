import { normalizarNombre, parecido } from "./documento";
import { fechaCorta, pesosCorto, restarMeses } from "./formato";
import type { ContratoSecop, Ficha, PersonaRef, RegistroProveedor, Relaciones, Senal, Totales, Vinculo } from "./tipos";

/** Cálculos sobre contratos ya normalizados: totales, relaciones y señales a revisar. Funciones puras. */

const CELEBRADO = new Set(["vigente", "por_cerrar", "terminado"]);
export const esCelebrado = (c: ContratoSecop) => CELEBRADO.has(c.clase);

const masReciente = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : (a ?? b));
const masAntigua = (a: string | null, b: string | null) => (a && b ? (a < b ? a : b) : (a ?? b));

export function totalesDe(lista: ContratoSecop[]): Totales {
  const t: Totales = { n: 0, valor: 0, vigentes: 0, valorVigente: 0, entidades: 0, otros: 0, atipicos: 0, primera: null, ultima: null, porFuente: { "SECOP I": 0, "SECOP II": 0 } };
  const entidades = new Set<string>();
  for (const c of lista) {
    if (!esCelebrado(c)) {
      t.otros++;
      continue;
    }
    t.n++;
    t.porFuente[c.fuente]++;
    entidades.add(c.nitEntidad ?? normalizarNombre(c.entidad));
    if (c.valorAtipico) t.atipicos++;
    t.valor += c.valor ?? 0;
    if (c.clase === "vigente") {
      t.vigentes++;
      t.valorVigente += c.valor ?? 0;
    }
    t.primera = masAntigua(t.primera, c.fechaFirma);
    t.ultima = masReciente(t.ultima, c.fechaFirma);
  }
  t.entidades = entidades.size;
  return t;
}

/* ---------------------------------------------------------------- relaciones */

type Acumulador = Map<string, Vinculo & { _roles?: Set<string> }>;

function sumar(mapa: Acumulador, clave: string, base: Pick<Vinculo, "nombre" | "documento">, c: ContratoSecop, roles: string[] = []) {
  const v = mapa.get(clave) ?? { clave, nombre: base.nombre, documento: base.documento, n: 0, valor: 0, ultima: null, _roles: new Set<string>() };
  v.n++;
  v.valor += c.valor ?? 0;
  v.ultima = masReciente(v.ultima, c.fechaFirma);
  for (const r of roles) v._roles?.add(r);
  mapa.set(clave, v);
}

function ordenado(mapa: Acumulador, tope = 12): Vinculo[] {
  return [...mapa.values()]
    .sort((a, b) => b.n - a.n || b.valor - a.valor || a.nombre.localeCompare(b.nombre))
    .slice(0, tope)
    .map(({ _roles, ...v }) => (_roles && _roles.size ? { ...v, detalle: [..._roles].join(" · ") } : v));
}

const claveEntidad = (c: ContratoSecop) => c.nitEntidad ?? normalizarNombre(c.entidad);
const claveRef = (p: PersonaRef) => p.documento ?? normalizarNombre(p.nombre);
const esSujeto = (p: PersonaRef | null, numero: string) => !!p && p.documento === numero;

function entidadesDe(lista: ContratoSecop[]): Vinculo[] {
  const m: Acumulador = new Map();
  for (const c of lista.filter(esCelebrado)) sumar(m, claveEntidad(c), { nombre: c.entidad, documento: c.nitEntidad }, c);
  return ordenado(m);
}

export function relacionesDe(a: {
  numero: string;
  contratos: ContratoSecop[];
  comoRepresentante: ContratoSecop[];
  comoFuncionario: ContratoSecop[];
  registros: RegistroProveedor[];
  relacionadas: Vinculo[];
}): Relaciones {
  const { numero } = a;

  // Empresas que representa: las que firman contratos y aparecen con él como representante legal,
  // más las que lo tienen como representante en el registro de proveedores aunque no tengan contratos.
  const empresas: Acumulador = new Map();
  for (const c of a.comoRepresentante.filter(esCelebrado)) sumar(empresas, claveRef(c.contratista), c.contratista, c, ["representante legal"]);
  for (const r of a.registros.filter((r) => r.relacion === "representado" && r.nit !== numero)) {
    if (!empresas.has(r.nit)) empresas.set(r.nit, { clave: r.nit, nombre: r.nombre, documento: r.nit, n: 0, valor: 0, ultima: null, _roles: new Set(["registrada en SECOP II"]) });
  }

  // Quiénes han sido sus representantes legales (útil cuando el sujeto es una empresa).
  const representantes: Acumulador = new Map();
  for (const c of a.contratos.filter(esCelebrado)) {
    const r = c.representante;
    if (!r || esSujeto(r, numero) || normalizarNombre(r.nombre) === normalizarNombre(c.contratista.nombre)) continue;
    sumar(representantes, claveRef(r), r, c);
  }
  for (const r of a.registros.filter((r) => r.relacion === "propio" && r.representante?.nombre)) {
    const p = r.representante!;
    const clave = claveRef(p);
    // El registro a veces repite el NIT de la empresa en el campo del representante: no es una persona.
    if (p.documento === numero || representantes.has(clave)) continue;
    representantes.set(clave, { clave, nombre: p.nombre, documento: p.documento, n: 0, valor: 0, ultima: null, _roles: new Set(["registrado en SECOP II"]) });
  }

  // Funcionarios que firman o supervisan sus contratos.
  const funcionarios: Acumulador = new Map();
  for (const c of a.contratos.filter(esCelebrado)) {
    // Una persona que firma, supervisa y ordena el pago de un mismo contrato cuenta una sola vez.
    const porPersona = new Map<string, { p: PersonaRef; roles: string[] }>();
    for (const [p, rol] of [[c.ordenadorGasto, "ordenador del gasto"], [c.supervisor, "supervisor"], [c.ordenadorPago, "ordenador de pago"]] as const) {
      if (!p || !p.nombre || esSujeto(p, numero)) continue;
      const e = porPersona.get(claveRef(p)) ?? { p, roles: [] };
      e.roles.push(rol);
      porPersona.set(claveRef(p), e);
    }
    for (const [clave, e] of porPersona) sumar(funcionarios, clave, e.p, c, e.roles);
  }

  // Si el sujeto es funcionario: a quiénes contrata o supervisa.
  const supervisados: Acumulador = new Map();
  for (const c of a.comoFuncionario.filter(esCelebrado)) {
    const roles = [esSujeto(c.ordenadorGasto, numero) && "ordenador del gasto", esSujeto(c.supervisor, numero) && "supervisor", esSujeto(c.ordenadorPago, numero) && "ordenador de pago"].filter(Boolean) as string[];
    sumar(supervisados, claveRef(c.contratista), c.contratista, c, roles);
  }

  return {
    entidades: entidadesDe(a.contratos),
    entidadesViaEmpresas: entidadesDe(a.comoRepresentante),
    empresas: ordenado(empresas),
    representantes: ordenado(representantes, 8),
    relacionadas: a.relacionadas,
    funcionarios: ordenado(funcionarios),
    supervisados: ordenado(supervisados),
  };
}

/* ------------------------------------------------------------------- señales */

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function senalesDe(f: Pick<Ficha, "numero" | "tipo" | "modo" | "contratos" | "comoRepresentante" | "comoFuncionario" | "registros" | "resumen" | "relaciones" | "comoEntidad" | "truncado" | "tope" | "fuentes">, hoy: string): Senal[] {
  const out: Senal[] = [];
  // Una consulta que falló puede esconder contratos: antes que cualquier otra cosa, se avisa.
  const fallidas = f.fuentes.filter((s) => !s.ok);
  if (fallidas.length > 0) {
    out.push({
      nivel: "alerta",
      titulo: "Consulta incompleta",
      detalle: `No respondieron: ${fallidas.map((s) => s.titulo).join("; ")}. Lo que ves puede estar incompleto: vuelve a consultar antes de concluir que no hay contratos.`,
    });
  }
  const { contratista: rc, representante: rr, funcionario: rf } = f.resumen;
  const alMenos = (tope: boolean) => (tope ? "al menos " : "");
  const hayAlgo = f.contratos.length + f.comoRepresentante.length + f.comoFuncionario.length + f.registros.length > 0 || !!f.comoEntidad;

  if (!hayAlgo) {
    out.push({
      nivel: "info",
      titulo: "Sin registros en el SECOP",
      detalle: `No hay contratos ni registro de proveedor con este documento ${fallidas.length ? "en las fuentes que respondieron" : "en SECOP I ni II"}. No es un certificado de que nunca haya contratado: pudo hacerlo con otro documento, en otro sistema o antes de 2003.`,
    });
    return out;
  }

  // Un mismo contrato donde la persona figura a la vez como contratista y como quien lo supervisa u ordena.
  const mismoContrato = f.contratos.filter((c) => esCelebrado(c) && (esSujeto(c.supervisor, f.numero) || esSujeto(c.ordenadorGasto, f.numero) || esSujeto(c.ordenadorPago, f.numero)));
  if (mismoContrato.length > 0) {
    out.push({ nivel: "alerta", titulo: "Contratista y supervisor del mismo contrato", detalle: `En ${plural(mismoContrato.length, "contrato", "contratos")} figura a la vez como contratista y como supervisor u ordenador. Puede ser un error de digitación en el SECOP: revísalo.` });
  } else if (f.comoFuncionario.length > 0 && f.contratos.length > 0) {
    out.push({ nivel: "aviso", titulo: "Contratista y también funcionario", detalle: `Es contratista y además figura como supervisor u ordenador en ${alMenos(f.tope.funcionario)}${plural(rf.n + rf.otros, "contrato", "contratos")}: confirma que no haya conflicto de intereses.` });
  } else if (f.comoFuncionario.length > 0) {
    out.push({ nivel: "info", titulo: "Figura como funcionario en contratos", detalle: `Aparece como supervisor u ordenador en ${alMenos(f.tope.funcionario)}${plural(rf.n + rf.otros, "contrato", "contratos")} de SECOP II (SECOP I no reporta funcionarios).` });
  }

  const conContratos = f.relaciones.empresas.filter((e) => e.n > 0);
  if (conContratos.length > 0 && f.tipo !== "empresa") {
    out.push({
      nivel: "aviso",
      titulo: "Representa empresas que contratan con el Estado",
      detalle: `Figura como representante legal de ${plural(conContratos.length, "empresa", "empresas")} con ${alMenos(f.tope.representante)}${plural(rr.n, "contrato", "contratos")} por ${pesosCorto(rr.valor)}. Contratar por interpuesta persona también cuenta en una revisión de inhabilidades.`,
    });
  } else if (conContratos.length > 0) {
    out.push({
      nivel: "info",
      titulo: "Figura como representante legal de otros contratistas",
      detalle: `Su documento aparece como representante legal en ${plural(rr.n, "contrato", "contratos")} de ${plural(conContratos.length, "contratista", "contratistas")}: puede ser real (consorcios, uniones temporales, franquicias) o un error de digitación.`,
    });
  }

  if (rc.vigentes > 0) {
    out.push({ nivel: "aviso", titulo: "Contratos vigentes", detalle: `${plural(rc.vigentes, "contrato vigente", "contratos vigentes")} por ${pesosCorto(rc.valorVigente)} con ${plural(f.relaciones.entidades.length, "entidad", "entidades")}.` });
  }
  if (rr.vigentes > 0) {
    out.push({ nivel: "aviso", titulo: "Empresas que representa, con contratos vigentes", detalle: `${plural(rr.vigentes, "contrato vigente", "contratos vigentes")} por ${pesosCorto(rr.valorVigente)}.` });
  }

  const desde = restarMeses(hoy, 12);
  const recientes = f.contratos.filter((c) => esCelebrado(c) && c.fechaFirma && c.fechaFirma >= desde);
  if (recientes.length > 0) {
    const valor = recientes.reduce((s, c) => s + (c.valor ?? 0), 0);
    out.push({ nivel: "info", titulo: "Contratos firmados en el último año", detalle: `${plural(recientes.length, "contrato", "contratos")} por ${pesosCorto(valor)} desde el ${fechaCorta(desde)}. Contratar con entidades públicas poco antes de una elección puede generar inhabilidades: confirma fechas y territorio con el equipo jurídico.` });
  }

  const principal = f.relaciones.entidades[0];
  if (principal && rc.n >= 3 && principal.n / rc.n >= 0.6) {
    out.push({ nivel: "info", titulo: "Concentra sus contratos en una entidad", detalle: `${principal.n} de ${rc.n} contratos son con ${principal.nombre}.` });
  }

  const otroNombre = f.contratos.filter((c) => c.nombreDistinto).length;
  if (otroNombre > 0) {
    out.push({ nivel: "aviso", titulo: "Registros a nombre de otra persona o empresa", detalle: `${plural(otroNombre, "contrato figura", "contratos figuran")} con este documento pero a nombre distinto: puede ser un error de digitación en el SECOP o un homónimo. Revísalos antes de atribuirlos.` });
  }

  const atipicos = rc.atipicos + rr.atipicos + rf.atipicos;
  if (atipicos > 0) {
    out.push({ nivel: "aviso", titulo: "Valores absurdos descartados", detalle: `${plural(atipicos, "contrato reporta", "contratos reportan")} un valor imposible (error de digitación de la entidad). Se listan, pero no se suman.` });
  }

  if (f.truncado) {
    out.push({ nivel: "aviso", titulo: "Hay más contratos de los que se muestran", detalle: "Algunas listas llegaron al tope de consulta. Los totales son un mínimo; para el detalle completo usa el buscador del SECOP." });
  }

  if (f.comoEntidad) {
    out.push({ nivel: "info", titulo: "Este NIT también es de una entidad que contrata", detalle: `Como entidad${f.comoEntidad.nombres.length ? ` (${f.comoEntidad.nombres.slice(0, 2).join("; ")})` : ""} ha celebrado ${f.comoEntidad.n.toLocaleString("es-CO")} contratos en SECOP II por ${pesosCorto(f.comoEntidad.valor)}.` });
  }

  return out;
}

/** Contrasta el nombre que escribió quien consulta con el que figura en el SECOP para ese documento. */
export function marcarNombre(f: Ficha, nombre: string | undefined): Ficha {
  if (!nombre || f.nombres.length === 0) return f;
  const mejor = Math.max(...f.nombres.map((n) => parecido(nombre, n.nombre)));
  if (mejor >= 0.5) return f;
  const senal: Senal = {
    nivel: "aviso",
    titulo: "El nombre no coincide con el del SECOP",
    detalle: `Con este documento el SECOP registra a «${f.nombres[0].nombre}», no a «${nombre}». Puede ser otra persona (la cédula está mal) o un error de digitación de la entidad: no atribuyas estos contratos sin confirmarlo.`,
  };
  return { ...f, senales: [senal, ...f.senales] };
}
