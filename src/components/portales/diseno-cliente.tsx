"use client";

import * as React from "react";
import { X } from "lucide-react";

import type { Emergente as ConfigEmergente } from "@/lib/portales/diseno/tipos";

/**
 * Las piezas del diseño que necesitan el navegador: la ventana emergente (con su frecuencia), la selección de regiones en la
 * vista previa del editor y el aviso de «estás viendo el borrador».
 */

const hoy = () => new Date().toISOString().slice(0, 10);
const huella = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h).toString(36);
};

function leer(almacen: "session" | "local", clave: string): string | null {
  try {
    return (almacen === "session" ? window.sessionStorage : window.localStorage).getItem(clave);
  } catch {
    return null;
  }
}
function escribir(almacen: "session" | "local", clave: string, valor: string) {
  try {
    (almacen === "session" ? window.sessionStorage : window.localStorage).setItem(clave, valor);
  } catch {
    /* navegación privada o almacenamiento bloqueado: la ventana simplemente podrá repetirse */
  }
}

/** La ventana emergente del portal: sale tras unos segundos, se puede cerrar y respeta su frecuencia y su fechas. */
export function Emergente({ config, portal, vista }: { config: ConfigEmergente; portal: string; vista: boolean }) {
  const [abierta, setAbierta] = React.useState(false);
  const clave = `portal-emergente:${portal}:${huella(config.titulo + config.texto)}`;

  React.useEffect(() => {
    if (!config.activo) return;
    const dia = hoy();
    if (!vista) {
      if (config.desde && dia < config.desde) return;
      if (config.hasta && dia > config.hasta) return;
      if (config.frecuencia === "sesion" && leer("session", clave)) return;
      if (config.frecuencia === "dia" && leer("local", clave) === dia) return;
    }
    const t = setTimeout(() => setAbierta(true), vista ? 600 : config.retardoSeg * 1000);
    return () => clearTimeout(t);
  }, [config, clave, vista]);

  if (!config.activo || !abierta) return null;
  const cerrar = () => {
    setAbierta(false);
    if (vista) return;
    if (config.frecuencia === "sesion") escribir("session", clave, "1");
    if (config.frecuencia === "dia") escribir("local", clave, hoy());
  };
  const externo = /^https:\/\//i.test(config.enlace);
  return (
    <div role="dialog" aria-label={config.titulo || "Aviso"} className="fixed right-3 bottom-3 z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border border-black/10 bg-white p-5 text-[#10161d] shadow-2xl">
      <button type="button" onClick={cerrar} aria-label="Cerrar" className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full text-black/50 hover:bg-black/5"><X className="size-4" /></button>
      {config.titulo && <p className="pr-8 text-base font-bold">{config.titulo}</p>}
      {config.texto && <p className="mt-1.5 text-sm leading-relaxed text-black/70">{config.texto}</p>}
      {config.enlace && (
        <a href={config.enlace} {...(externo ? { target: "_blank", rel: "noreferrer noopener" } : {})} onClick={cerrar} className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--p,#0f766e)] px-5 py-2.5 text-sm font-bold text-[var(--sobre,#fff)]">
          {config.boton || "Conocer más"}
        </a>
      )}
    </div>
  );
}

/**
 * Solo en la vista previa del editor (dentro de un iframe): un clic en una parte de la página le dice al editor cuál es, y el editor
 * puede apagar la selección para navegar por el sitio con normalidad.
 */
export function SeleccionVista() {
  React.useEffect(() => {
    if (window.parent === window) return;
    let seleccionar = true;
    const estilo = document.createElement("style");
    estilo.textContent = `[data-portal-root] [data-region]:hover{outline:2px dashed var(--p, #0f766e);outline-offset:-2px;cursor:pointer}[data-portal-root] [data-region].sel-activa{outline:3px solid var(--p, #0f766e);outline-offset:-3px}`;
    document.head.appendChild(estilo);
    const marcar = (region: string | null) => {
      document.querySelectorAll(".sel-activa").forEach((e) => e.classList.remove("sel-activa"));
      if (region) document.querySelectorAll(`[data-region="${region}"]`).forEach((e) => e.classList.add("sel-activa"));
    };
    const alClic = (ev: MouseEvent) => {
      if (!seleccionar) return;
      const el = ev.target instanceof Element ? ev.target : null;
      const region = el?.closest("[data-region]")?.getAttribute("data-region");
      const nota = el?.closest("[data-nota]")?.getAttribute("data-nota");
      if (!region) return;
      ev.preventDefault();
      ev.stopPropagation();
      marcar(region);
      window.parent.postMessage({ tipo: "portal-region", region, nota: nota ?? null }, window.location.origin);
    };
    const alMensaje = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin || typeof ev.data !== "object" || !ev.data) return;
      if (ev.data.tipo === "portal-modo") seleccionar = ev.data.seleccionar !== false;
      if (ev.data.tipo === "portal-marcar") marcar(typeof ev.data.region === "string" ? ev.data.region : null);
    };
    document.addEventListener("click", alClic, true);
    window.addEventListener("message", alMensaje);
    window.parent.postMessage({ tipo: "portal-listo" }, window.location.origin);
    return () => {
      document.removeEventListener("click", alClic, true);
      window.removeEventListener("message", alMensaje);
      estilo.remove();
    };
  }, []);
  return null;
}

/** Aviso fijo cuando el administrador ve el borrador fuera del editor: nadie más lo ve. */
export function AvisoBorrador({ portalId }: { portalId: string }) {
  const [dentro, setDentro] = React.useState(true);
  React.useEffect(() => {
    // Dentro del iframe del editor no hace falta el aviso.
    const t = setTimeout(() => setDentro(window.parent !== window), 0);
    return () => clearTimeout(t);
  }, []);
  if (dentro) return null;
  const salir = async () => {
    await fetch(`/api/admin/portales/${portalId}/diseno`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "salir-vista" }) }).catch(() => {});
    window.location.reload();
  };
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-sm font-semibold text-black">
      Estás viendo el borrador del diseño: solo tú lo ves.
      <button type="button" onClick={salir} className="rounded-full bg-black px-3 py-1 text-xs font-bold text-white">Salir de la vista previa</button>
    </div>
  );
}
