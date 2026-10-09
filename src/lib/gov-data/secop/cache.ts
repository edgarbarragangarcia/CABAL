import "server-only";

import { unstable_cache } from "next/cache";

/**
 * `unstable_cache` guarda por un rato lo que devuelve la función. Un resultado al que le faltan fuentes
 * (una consulta falló o se agotó el tiempo) no puede quedar guardado: sería «sin contratos» durante una hora
 * por una falla de segundos. Aquí ese resultado se entrega tal cual esta vez, sin guardarlo, y la próxima
 * consulta lo intenta de nuevo. Se logra lanzando dentro del caché (lo que lanza no se guarda) y recogiendo
 * el valor por fuera.
 */
export function cacheSiCompleto<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  clave: string[],
  revalidate: number,
  completo: (r: R) => boolean
): (...args: A) => Promise<R> {
  class Incompleto extends Error {
    constructor(readonly valor: R) {
      super("Resultado incompleto: no se guarda en caché.");
    }
  }
  const enCache = unstable_cache(
    async (...args: A) => {
      const r = await fn(...args);
      if (!completo(r)) throw new Incompleto(r);
      return r;
    },
    clave,
    { revalidate }
  );
  return async (...args: A) => {
    try {
      return await enCache(...args);
    } catch (e) {
      if (e instanceof Incompleto) return e.valor;
      throw e;
    }
  };
}
