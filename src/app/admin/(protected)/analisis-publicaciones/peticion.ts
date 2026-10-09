import * as React from "react";

/** Una petición GET que se repite sola cuando cambia la URL (null = no pedir todavía). */
export type Cargando = { estado: "cargando" };
export type Fallo = { estado: "error"; error: string };
export type Listo<T> = { estado: "listo"; data: T };
export type Peticion<T> = Cargando | Fallo | Listo<T>;

/** Un error de red o una respuesta que no es JSON (p. ej. la página de «tiempo agotado» del hosting) no debe verse como «Unexpected token…». */
function mensajeDeError(err: unknown): string {
  if (err instanceof TypeError) return "No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.";
  return err instanceof Error ? err.message : "No fue posible completar la consulta.";
}

export function usePeticion<T>(url: string | null): Peticion<T> {
  // Se guarda el último resultado junto con la URL que lo pidió; si la URL cambió, aún se está cargando.
  const [resultado, setResultado] = React.useState<{ url: string; r: Listo<T> | Fallo } | null>(null);
  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
        if (!res.ok) throw new Error(body?.error ?? (res.status === 504 ? "La consulta tardó demasiado. Intenta de nuevo." : `Error ${res.status}`));
        if (body === null) throw new Error("El servidor respondió algo que no se pudo leer. Intenta de nuevo.");
        return body as T;
      })
      .then((data) => !cancelled && setResultado({ url, r: { estado: "listo", data } }))
      .catch((err: unknown) => !cancelled && setResultado({ url, r: { estado: "error", error: mensajeDeError(err) } }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return url && resultado?.url === url ? resultado.r : { estado: "cargando" };
}
