import * as React from "react";

/** Si la persona quitó el avatar de MaFe de la pantalla. Se recuerda en este navegador; el chat sigue disponible con la barra del celular. */
const CLAVE = "mafe:oculto";
const EVENTO = "mafe:visibilidad";

export function leerOculto(): boolean {
  try {
    return window.localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

export function fijarOculto(oculto: boolean) {
  try {
    if (oculto) window.localStorage.setItem(CLAVE, "1");
    else window.localStorage.removeItem(CLAVE);
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}

const suscribir = (cb: () => void) => {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
};

export function useMafeOculto(): boolean {
  return React.useSyncExternalStore(suscribir, leerOculto, () => false);
}
