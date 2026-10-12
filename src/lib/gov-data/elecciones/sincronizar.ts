import "server-only";

import { coberturaGuardada, codigosGuardados, conResultado, guardadosHasta, guardarCatalogo, guardarFilas } from "./almacen";
import { filaDe, type FilaResultado, type Territorio } from "./almacen-puro";
import { ELECCIONES } from "./catalogo";
import { contextoCorporacion, mapLimit, resultadoEnVivo, type Geografia } from "./resultados";

/**
 * Sincronización: recorre los territorios de cada elección y cargo del catálogo, pide el resultado a la fuente y lo guarda en
 * Supabase (ver `almacen.ts`). Se hace por lotes que caben en una función de Vercel; quien llama (el panel Análisis > Datos)
 * repite hasta que `terminado`. Lo ya guardado se salta, así que se puede parar y seguir cuando sea.
 *
 * Corre en producción porque ahí la Registraduría sí responde; desde otras redes suele cortar las conexiones.
 */

export type ParElectoral = { eleccion: string; corporacion: string; eleccionNombre: string; corporacionNombre: string; fecha: string };

/** Todos los cargos del catálogo, en el orden del selector. */
export const PARES: ParElectoral[] = ELECCIONES.flatMap((e) =>
  e.corporaciones.map((c) => ({ eleccion: e.id, corporacion: c.sigla, eleccionNombre: e.nombre, corporacionNombre: c.nombre, fecha: e.fecha }))
);

/**
 * Hasta qué nivel se guarda: 2 = país y departamentos, 3 = más los municipios, 5 = más zonas, localidades y comunas, 6 = más los
 * puestos de votación (unos 13.000 por elección: se carga cargo por cargo). Las mesas no se guardan.
 */
export const NIVELES_SINCRONIZACION = [2, 3, 5, 6] as const;

/** Con pocas peticiones a la vez y una pausa entre ellas: el firewall de la Registraduría corta a quien pide más de unas 13.000 por hora. */
const CONCURRENCIA = 2;
const PAUSA_MS = 350;
/** Vercel corta la función a los 60 s: se deja margen para terminar las peticiones en curso y subir lo último. */
const PRESUPUESTO_MS = 38_000;
const FALLOS_PARA_PARAR = 6;
const SUBIR_CADA = 20;
const INTENTOS_SIN_RESULTADO = 12;
/**
 * Un territorio «no publicado» (la fuente responde 404 o la página de la aplicación en vez del archivo) se pide hasta tres veces
 * antes de darlo por bueno: con la carga a buen ritmo la fuente a veces responde así a archivos que sí existen (Valledupar en el
 * Senado, un departamento entero en la Cámara...), y quedaría guardado como definitivo.
 */
const INTENTOS_CONFIRMAR_NO_PUBLICADO = 3;
/** Lo que puede alargarse una petición ya empezada cuando se acaba el tiempo del lote (con la fuente lenta o colgada). */
const COLA_MS = 12_000;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

type TerritorioNivel = Territorio & { nivel: number };

/** Los territorios de la división hasta cierto nivel, de arriba abajo (el país y los departamentos primero). */
export function territoriosHasta(geo: Geografia, nivelMax: number): TerritorioNivel[] {
  return geo.rows
    .filter((r) => r[2] <= nivelMax)
    .map(([codigo, nombre, nivel, , , dane]): TerritorioNivel => ({ codigo, nombre, nivel, ...(dane ? { dane } : {}) }))
    .sort((a, b) => a.nivel - b.nivel);
}

const esperadosEnMemoria = new Map<string, Promise<Record<number, number>>>();

/** Cuántos territorios tiene el cargo en cada nivel. */
export function esperadosPorNivel(eleccion: string, corporacion: string): Promise<Record<number, number>> {
  const clave = `${eleccion}|${corporacion}`;
  let p = esperadosEnMemoria.get(clave);
  if (!p) {
    p = contextoCorporacion(eleccion, corporacion).then(({ geo }) => {
      const cuenta: Record<number, number> = {};
      for (const r of geo.rows) cuenta[r[2]] = (cuenta[r[2]] ?? 0) + 1;
      return cuenta;
    });
    esperadosEnMemoria.set(clave, p);
    p.catch(() => esperadosEnMemoria.delete(clave));
  }
  return p;
}

const hasta = (porNivel: Record<number, number>, nivelMax: number) =>
  Object.entries(porNivel).reduce((s, [n, v]) => s + (Number(n) <= nivelMax ? v : 0), 0);

export type EstadoPar = ParElectoral & {
  esperados: Record<number, number>;
  guardados: Record<number, number>;
  vacios: Record<number, number>;
  ultima: string | null;
};

/** Qué hay guardado de cada cargo frente a lo que tendría que haber, nivel por nivel. */
export async function estadoSincronizacion(): Promise<EstadoPar[]> {
  const cobertura = await coberturaGuardada();
  return Promise.all(
    PARES.map(async (par): Promise<EstadoPar> => {
      const propias = cobertura.filter((c) => c.eleccion === par.eleccion && c.corporacion === par.corporacion);
      const guardados: Record<number, number> = {};
      const vacios: Record<number, number> = {};
      for (const c of propias) {
        const n = c.nivel ?? 0;
        guardados[n] = (guardados[n] ?? 0) + c.guardados;
        vacios[n] = (vacios[n] ?? 0) + c.vacios;
      }
      const ultima = propias.map((c) => c.ultima).filter((u): u is string => !!u).sort().at(-1) ?? null;
      return { ...par, esperados: await esperadosPorNivel(par.eleccion, par.corporacion), guardados, vacios, ultima };
    })
  );
}

export type LoteSincronizacion = {
  /** Territorios guardados en este lote con resultado. */
  guardados: number;
  /** Territorios guardados como «la fuente no los publica» (p. ej. el cargo de gobernador en un municipio). */
  vacios: number;
  errores: number;
  /** La fuente empezó a cortar las conexiones: conviene esperar unos minutos. */
  limitada: boolean;
  /** No se pudo guardar en Supabase (lo que se había pedido en este lote no cuenta como guardado). */
  errorBase?: string;
  mensaje?: string;
  /** Cargo que se estaba guardando al terminar el lote. */
  actual: string | null;
  /** Territorios que faltan, de todos los cargos pedidos, y los que hay en total. */
  pendientes: number;
  total: number;
  terminado: boolean;
};

/**
 * Un lote de la sincronización: guarda territorios de los cargos pedidos (todos, o uno solo) hasta el `nivelMax`, mientras
 * alcance el tiempo. Los que ya estaban guardados no se piden otra vez.
 */
export async function sincronizarLote(p: { eleccion?: string; corporacion?: string; nivelMax: number; /** Tiempo para pedir territorios (por defecto, el de una función de Vercel con algo de margen). */ presupuestoMs?: number }): Promise<LoteSincronizacion> {
  const limite = Date.now() + (p.presupuestoMs ?? PRESUPUESTO_MS);
  await guardarCatalogo();

  const pares = PARES.filter((x) => (!p.eleccion || x.eleccion === p.eleccion) && (!p.corporacion || x.corporacion === p.corporacion));
  if (pares.length === 0) throw new Error("Elección o cargo no válido.");

  // Un conteo pequeño por cargo (lo resuelve el índice), no el resumen de toda la tabla: con cientos de miles de resultados
  // guardados ese resumen superaba el límite de tiempo de Supabase y cada tramo moría antes de pedir nada.
  const estados = await Promise.all(
    pares.map(async (par) => {
      const esperados = hasta(await esperadosPorNivel(par.eleccion, par.corporacion), p.nivelMax);
      const hechos = await guardadosHasta(par.eleccion, par.corporacion, p.nivelMax);
      return { par, esperados, hechos: Math.min(hechos, esperados) };
    })
  );
  const total = estados.reduce((s, e) => s + e.esperados, 0);
  const faltabanAlEmpezar = estados.reduce((s, e) => s + (e.esperados - e.hechos), 0);

  let guardados = 0;
  let vacios = 0;
  let errores = 0;
  let seguidos = 0;
  let limitada = false;
  let errorBase: string | undefined;
  let mensaje: string | undefined;
  let ultimoError: string | undefined;
  let actual: string | null = null;

  for (const e of estados) {
    if (e.hechos >= e.esperados) continue;
    if (Date.now() >= limite || limitada) break;
    const { eleccion, corporacion, data, geo } = await contextoCorporacion(e.par.eleccion, e.par.corporacion);
    actual = `${e.par.eleccionNombre} · ${e.par.corporacionNombre}`;
    const yaEstan = await codigosGuardados(e.par.eleccion, e.par.corporacion, p.nivelMax);
    const faltan = territoriosHasta(geo, p.nivelMax).filter((t) => !yaEstan.has(t.codigo));

    const porSubir: FilaResultado[] = [];
    /** Territorios que la fuente dice no publicar: se guardan al final, y solo si el cargo tiene resultados reales (ver abajo). */
    const sinPublicar: FilaResultado[] = [];
    /** Sube lo acumulado; solo lo que Supabase confirma cuenta como guardado. */
    const subir = async (filas = porSubir.splice(0)) => {
      // Si ya falló un envío (tras sus reintentos) la base está sobrecargada: no se insiste en este tramo.
      if (filas.length === 0 || errorBase) return;
      try {
        await guardarFilas(filas, true);
        vacios += filas.filter((f) => f.vacio).length;
        guardados += filas.filter((f) => !f.vacio).length;
      } catch (err) {
        errorBase ??= err instanceof Error ? err.message : "No se pudo guardar en Supabase.";
      }
    };
    const conResultadoAntes = await conResultado(e.par.eleccion, e.par.corporacion);
    const guardadosAntes = guardados;
    /** Territorios donde el cargo se elige (o más arriba no: allí es normal que no haya nada) y la fuente no devolvió resultado. */
    let sinResultadoDondeDebia = 0;
    await mapLimit(faltan, CONCURRENCIA, async (t) => {
      if (Date.now() >= limite || limitada || errorBase) return;
      // Una docena de intentos donde tendría que haber resultados y ni uno solo: la fuente no está sirviendo este cargo (o está
      // bloqueada). Se deja para otro rato en vez de gastar todo el tiempo del lote, y los demás cargos siguen.
      if (sinResultadoDondeDebia >= INTENTOS_SIN_RESULTADO && conResultadoAntes + (guardados - guardadosAntes) + porSubir.length === 0) return;
      try {
        // Siempre con el mapa de ganadores y sin la caché de Next: lo que se guarda aquí es la copia completa.
        let r = await resultadoEnVivo(eleccion, corporacion.sigla, t.codigo, data.partidos, geo, true, true, limite + COLA_MS);
        // Los datos de datos.gov.co (Congreso 2018) no tienen este problema: una consulta vacía es vacía.
        for (let intento = 1; !r && eleccion.fuente !== "socrata" && intento < INTENTOS_CONFIRMAR_NO_PUBLICADO && Date.now() < limite + COLA_MS - 4_000; intento++) {
          await esperar(700 * intento);
          r = await resultadoEnVivo(eleccion, corporacion.sigla, t.codigo, data.partidos, geo, true, true, limite + COLA_MS);
        }
        if (!r && t.nivel >= corporacion.nivelEleccion) sinResultadoDondeDebia++;
        (r ? porSubir : sinPublicar).push(filaDe(eleccion, corporacion, t, r, true));
        seguidos = 0;
        if (porSubir.length >= SUBIR_CADA) await subir();
      } catch (err) {
        errores++;
        ultimoError = err instanceof Error ? err.message : "La fuente dejó de responder.";
        if (++seguidos >= FALLOS_PARA_PARAR) {
          limitada = true;
          mensaje = err instanceof Error ? err.message : "La fuente dejó de responder.";
        }
      }
      await esperar(PAUSA_MS);
    });
    await subir();
    // «La fuente no publica este territorio» solo vale si el cargo sí tiene resultados reales: si ninguna petición devolvió un
    // archivo (una página de error, una red bloqueada), eso no es «no publicado» y guardarlo taparía datos verdaderos.
    if (!errorBase && sinPublicar.length > 0) {
      if (conResultadoAntes + (guardados - guardadosAntes) > 0) await subir(sinPublicar);
      else {
        errores += sinPublicar.length;
        mensaje ??= "La fuente no devolvió ningún resultado de este cargo: no se guardó nada. Vuelve a intentarlo en unos minutos.";
      }
    }
    if (errorBase) break;
  }

  const pendientes = Math.max(0, faltabanAlEmpezar - guardados - vacios);
  // Si no se guardó nada y hubo errores, que se vea por qué (lo último que dijo la fuente).
  if (!mensaje && errores > 0 && guardados + vacios === 0) mensaje = ultimoError;
  return {
    guardados,
    vacios,
    errores,
    limitada,
    ...(errorBase ? { errorBase } : {}),
    ...(mensaje ? { mensaje } : {}),
    actual,
    pendientes,
    total,
    terminado: pendientes === 0 && !limitada && !errorBase,
  };
}
