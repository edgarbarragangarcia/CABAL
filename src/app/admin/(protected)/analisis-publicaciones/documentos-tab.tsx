"use client";

import { GoogleDrive } from "@/components/admin/google-drive";
import * as React from "react";
import {
  Archive, ArchiveRestore, Check, Copy, Database, Download, FileText, Folder, FolderOpen, FolderPlus, History, Inbox, Library, Loader2, MessageSquareText,
  Pencil, Play, Search, Sparkles, Trash2, TriangleAlert, UploadCloud, X,
} from "lucide-react";

/**
 * Gestor documental: carpetas, metadatos, versiones, papelera e historial, sobre la biblioteca de Documentos (el servidor saca el texto,
 * lo divide en fragmentos, los vectoriza y los guarda en Supabase para buscarlos por significado y preguntarles con citas). Los
 * archivos suben por partes (Vercel no admite más de 4,5 MB por petición); la cola sigue aunque se cambie de pestaña.
 */

type Estado = "subiendo" | "procesando" | "listo" | "error";
type Documento = {
  id: string; titulo: string; archivo: string | null; tipo: string | null; bytes: number | null; paginas: number | null; caracteres: number | null;
  fragmentos: number; vectorizados: number; estado: Estado; error: string | null; modelo: string | null; etiquetas: string[]; creadoEn: string;
  carpetaId: string | null; descripcion: string | null; categoria: string | null; autor: string | null; fuente: string | null; fechaDocumento: string | null;
  confidencial: boolean; ambito?: string; hash: string | null; version: number; grupoVersion: string | null; vigente: boolean; eliminadoEn: string | null;
};
type Carpeta = { id: string; nombre: string; padreId: string | null };
type Datos = {
  configurada: boolean; tabla: boolean; gestor?: boolean; documentos: Documento[]; papelera?: Documento[]; carpetas?: Carpeta[];
  sql?: string; sqlGestor?: string; editorSql?: string; error?: string;
  vectores?: { listo: boolean; proveedor?: string; modelo?: string; dimensiones?: number };
  limites?: { maxBytes: number; tamParte: number; extensiones: string[] };
};
type Detalle = { versiones: Documento[]; eventos: { id: number; accion: string; detalle: Record<string, unknown> | null; usuario: string | null; en: string }[]; fragmentos: { posicion: number; pagina: number | null; contenido: string }[] };
type Avance = { fragmentos: number; vectorizados: number; pendientes: number; listo: boolean };
type Hallazgo = { documentoId: string; titulo: string; posicion: number; pagina: number | null; contenido: string; similitud: number };
type Respuesta = { respuesta: string; fuentes: { n: number; documentoId: string; titulo: string; pagina: number | null; contenido: string }[]; avisos: string[] };
type Fase = "espera" | "subiendo" | "procesando" | "vectorizando" | "listo" | "error";
type Item = { clave: string; archivo: File; titulo: string; etiquetas: string[]; carpetaId: string | null; versionDe?: string; duplicar?: boolean; fase: Fase; progreso: number; detalle: string; error?: string; duplicadoDe?: string };
type Vista = { tipo: "todos" } | { tipo: "sin" } | { tipo: "carpeta"; id: string } | { tipo: "papelera" } | { tipo: "fuente"; id: string };

const tarjeta = "rounded-2xl border border-border bg-surface shadow-sm";
const campo = "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const numero = (n: number) => n.toLocaleString("es-CO");
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FORMATOS = ".pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.json,.xml,.html,.htm,.log";
const ACCION: Record<string, string> = { subido: "Subido", version: "Nueva versión", editado: "Editado", movido: "Movido de carpeta", papelera: "A la papelera", restaurado: "Restaurado", eliminado: "Eliminado", descargado: "Descargado" };

function tamano(bytes: number | null) {
  if (bytes === null) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }) : "—");

async function pedir<T>(url: string, metodo: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", cuerpo?: unknown, bruto?: Blob): Promise<T> {
  const r = await fetch(url, {
    method: metodo,
    headers: bruto ? { "Content-Type": "application/octet-stream" } : cuerpo ? { "Content-Type": "application/json" } : undefined,
    body: bruto ?? (cuerpo ? JSON.stringify(cuerpo) : undefined),
    cache: "no-store",
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(b.error ?? (r.status === 504 ? "La operación tardó demasiado." : r.status === 413 ? "El archivo es demasiado grande." : `No fue posible completar la acción (${r.status}).`)), { duplicado: b.duplicado as { id: string; titulo: string } | undefined });
  return b as T;
}

async function sha256(archivo: File): Promise<string | undefined> {
  try {
    const h = await crypto.subtle.digest("SHA-256", await archivo.arrayBuffer());
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}

const FASE_TEXTO: Record<Fase, string> = { espera: "En cola", subiendo: "Subiendo", procesando: "Extrayendo el texto", vectorizando: "Vectorizando", listo: "Listo", error: "Con error" };
const ESTADO_CLASE: Record<Estado, string> = {
  listo: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  procesando: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  subiendo: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  error: "bg-red-500/15 text-red-700 dark:text-red-300",
};

/**
 * Una fuente de datos que vive en el gestor como un documento más: aparece en la lista (tipo «Datos») y en el menú lateral, y al
 * abrirla muestra su propio panel (`contenido`), que se monta la primera vez que se abre y sigue montado.
 */
export type FuenteDatos = {
  id: string;
  nombre: string;
  /** Una línea bajo el nombre. */
  detalle: string;
  /** En la columna «Tamaño»: «172.889 filas». */
  resumen: string;
  estado: string;
  tono: "ok" | "curso" | "pendiente";
  fecha?: string | null;
  contenido: React.ReactNode;
};

/** A quién pertenece la información de un documento: la búsqueda y las preguntas pueden limitarse a un ámbito. */
const AMBITOS: Record<string, string> = { alianza: "Alianza", partidos: "Partidos", gremio: "Gremio ganadero" };

const TONO_FUENTE: Record<FuenteDatos["tono"], string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  curso: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  pendiente: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export function DocumentosTab({ fuentes = [] }: { fuentes?: FuenteDatos[] }) {
  const [fuentesAbiertas, setFuentesAbiertas] = React.useState<ReadonlySet<string>>(new Set());
  const abrirFuente = (id: string) => {
    setFuentesAbiertas((a) => new Set(a).add(id));
    setVista({ tipo: "fuente", id });
  };
  const [datos, setDatos] = React.useState<Datos | null>(null);
  const [cola, setCola] = React.useState<Item[]>([]);
  const [vista, setVista] = React.useState<Vista>({ tipo: "todos" });
  const [texto, setTexto] = React.useState("");
  const [tipo, setTipo] = React.useState("");
  const [estadoF, setEstadoF] = React.useState("");
  const [categoriaF, setCategoriaF] = React.useState("");
  const [drive, setDrive] = React.useState(false);
  const [sobreCarpeta, setSobreCarpeta] = React.useState<string | null>(null);
  /** Las fuentes de datos también se pueden marcar (una por una); las acciones de mover o borrar solo valen para documentos. */
  const [selFuentes, setSelFuentes] = React.useState<ReadonlySet<string>>(new Set());
  const ultimoMarcado = React.useRef<number | null>(null);
  const [ambitoF, setAmbitoF] = React.useState("");
  const [orden, setOrden] = React.useState<"reciente" | "titulo" | "tamano">("reciente");
  const [conVersiones, setConVersiones] = React.useState(false);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const [arrastrando, setArrastrando] = React.useState(false);
  const [aviso, setAviso] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [etiquetasSubida, setEtiquetasSubida] = React.useState("");
  const [nuevaCarpeta, setNuevaCarpeta] = React.useState<string | null>(null);
  const [nombreCarpeta, setNombreCarpeta] = React.useState("");
  const [copiado, setCopiado] = React.useState(false);
  const [vectorizando, setVectorizando] = React.useState<string | null>(null);
  const trabajando = React.useRef(false);
  const entrada = React.useRef<HTMLInputElement>(null);
  const entradaVersion = React.useRef<HTMLInputElement>(null);
  const versionDe = React.useRef<string | null>(null);

  const recargar = React.useCallback(async () => {
    try {
      setDatos(await pedir<Datos>("/api/admin/documentos", "GET"));
    } catch (e) {
      setDatos({ configurada: true, tabla: false, documentos: [], error: e instanceof Error ? e.message : "No se pudo leer." });
    }
  }, []);
  React.useEffect(() => {
    let cancelado = false;
    pedir<Datos>("/api/admin/documentos", "GET")
      .catch((e): Datos => ({ configurada: true, tabla: false, documentos: [], error: e instanceof Error ? e.message : "No se pudo leer." }))
      .then((d) => {
        if (!cancelado) setDatos(d);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const gestor = !!datos?.gestor;
  const carpetas = React.useMemo(() => datos?.carpetas ?? [], [datos]);
  const hijosDe = React.useCallback((id: string | null) => carpetas.filter((c) => c.padreId === id), [carpetas]);

  /* ----------------------------------------------------------- subida ---- */

  const cambiar = (clave: string, c: Partial<Item>) => setCola((l) => l.map((i) => (i.clave === clave ? { ...i, ...c } : i)));

  async function vectorizarHasta(id: string, alAvanzar: (a: Avance) => void) {
    let sinAvance = 0;
    let previo = -1;
    for (;;) {
      const a = await pedir<Avance>("/api/admin/documentos/vectorizar", "POST", { id });
      alAvanzar(a);
      if (a.listo) return;
      sinAvance = a.vectorizados > previo ? 0 : sinAvance + 1;
      previo = a.vectorizados;
      if (sinAvance >= 3) throw new Error("No se pudo seguir vectorizando: no hubo avance en tres intentos seguidos.");
    }
  }

  async function procesar(item: Item, tamParte: number) {
    const { clave, archivo } = item;
    try {
      cambiar(clave, { fase: "subiendo", progreso: 0, detalle: "Registrando…" });
      const hash = await sha256(archivo);
      const { id } = await pedir<{ id: string }>("/api/admin/documentos", "POST", {
        titulo: item.titulo, archivo: archivo.name, bytes: archivo.size, etiquetas: item.etiquetas,
        ...(item.carpetaId ? { carpetaId: item.carpetaId } : {}), ...(hash ? { hash } : {}), ...(item.versionDe ? { versionDe: item.versionDe } : {}), ...(item.duplicar ? { duplicar: true } : {}),
      });
      const partes = Math.max(1, Math.ceil(archivo.size / tamParte));
      for (let n = 0; n < partes; n++) {
        const trozo = archivo.slice(n * tamParte, (n + 1) * tamParte);
        for (let intento = 1; ; intento++) {
          try {
            await pedir(`/api/admin/documentos/parte?id=${id}&n=${n}`, "PUT", undefined, trozo);
            break;
          } catch (e) {
            if (intento >= 3) throw e;
            await esperar(1500 * intento);
          }
        }
        cambiar(clave, { progreso: Math.round(((n + 1) / partes) * 100), detalle: `Parte ${n + 1} de ${partes}` });
      }
      cambiar(clave, { fase: "procesando", progreso: 100, detalle: "Sacando el texto y dividiéndolo en fragmentos…" });
      const { documento } = await pedir<{ documento: Documento }>("/api/admin/documentos/procesar", "POST", { id, partes });
      cambiar(clave, { fase: "vectorizando", progreso: 0, detalle: `${numero(documento.fragmentos)} fragmentos` });
      await recargar();
      await vectorizarHasta(id, (a) => cambiar(clave, { progreso: Math.round((a.vectorizados / Math.max(1, a.fragmentos)) * 100), detalle: `${numero(a.vectorizados)} de ${numero(a.fragmentos)} fragmentos` }));
      cambiar(clave, { fase: "listo", progreso: 100, detalle: `${numero(documento.fragmentos)} fragmentos guardados` });
    } catch (e) {
      const dup = (e as { duplicado?: { id: string; titulo: string } }).duplicado;
      cambiar(clave, { fase: "error", error: e instanceof Error ? e.message : "No fue posible cargar el documento.", duplicadoDe: dup?.titulo });
    } finally {
      await recargar();
    }
  }

  async function atender(nuevos: Item[]) {
    setCola((c) => [...c, ...nuevos]);
    if (trabajando.current) return;
    trabajando.current = true;
    try {
      const tamParte = datos?.limites?.tamParte ?? 3.5 * 1024 * 1024;
      const hechos = new Set<string>();
      let pendientes = nuevos;
      while (pendientes.length > 0) {
        for (const item of pendientes) {
          hechos.add(item.clave);
          await procesar(item, tamParte);
        }
        pendientes = await new Promise<Item[]>((resolver) => setCola((c) => { resolver(c.filter((i) => i.fase === "espera" && !hechos.has(i.clave))); return c; }));
      }
    } finally {
      trabajando.current = false;
    }
  }

  function agregar(archivos: FileList | File[], conVersion?: string, carpetaIds?: (string | null)[]) {
    setAviso(null);
    const permitidas = (datos?.limites?.extensiones ?? []).map((e) => e.toLowerCase());
    const maximo = datos?.limites?.maxBytes ?? 40 * 1024 * 1024;
    const tags = etiquetasSubida.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);
    const carpetaId = vista.tipo === "carpeta" ? vista.id : null;
    const validos: Item[] = [];
    const rechazados: string[] = [];
    for (const [indice, archivo] of Array.from(archivos).entries()) {
      const ext = archivo.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
      if (permitidas.length && !permitidas.includes(ext)) rechazados.push(`${archivo.name}: formato .${ext || "desconocido"} no admitido`);
      else if (archivo.size > maximo) rechazados.push(`${archivo.name}: pesa más de ${tamano(maximo)}`);
      else if (archivo.size === 0) rechazados.push(`${archivo.name}: está vacío`);
      else validos.push({ clave: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${archivo.name}`, archivo, titulo: archivo.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim() || archivo.name, etiquetas: tags, carpetaId: carpetaIds ? (carpetaIds[indice] ?? null) : carpetaId, versionDe: conVersion, fase: "espera", progreso: 0, detalle: "En cola" });
    }
    if (rechazados.length) setAviso({ ok: false, texto: rechazados.join(" · ") });
    if (validos.length) void atender(validos);
  }

  /**
   * Lo que llega de Google Drive: cada archivo trae su ruta de carpetas de Drive y aquí se recrean (o se reutilizan si ya existen) para
   * que lo importado quede ordenado igual. Después sigue el mismo camino que cualquier subida: texto, fragmentos y vectores.
   */
  const carpetasLocales = React.useRef<Carpeta[]>([]);
  const rutasResueltas = React.useRef<Map<string, string | null>>(new Map());
  React.useEffect(() => { carpetasLocales.current = carpetas; }, [carpetas]);

  async function carpetaDeRuta(ruta: string[]): Promise<string | null> {
    if (!ruta.length) return null;
    const clave = ruta.join("\u0001");
    if (rutasResueltas.current.has(clave)) return rutasResueltas.current.get(clave)!;
    let padre: string | null = null;
    for (const nombre of ruta) {
      const limpio = nombre.trim().slice(0, 80) || "Sin nombre";
      const buscado: string | null = padre;
      let encontrada: Carpeta | undefined = carpetasLocales.current.find((x) => x.padreId === buscado && x.nombre.toLowerCase() === limpio.toLowerCase());
      if (!encontrada) {
        const creada: { carpeta: Carpeta } = await pedir<{ carpeta: Carpeta }>("/api/admin/documentos/carpetas", "POST", { nombre: limpio, padreId: buscado });
        encontrada = creada.carpeta;
        carpetasLocales.current = [...carpetasLocales.current, encontrada];
      }
      padre = encontrada.id;
    }
    rutasResueltas.current.set(clave, padre);
    return padre;
  }

  async function agregarDeDrive(archivos: File[], rutas: string[][]) {
    try {
      const ids: (string | null)[] = [];
      for (const r of rutas) ids.push(await carpetaDeRuta(r));
      agregar(archivos, undefined, ids);
      await recargar();
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible crear las carpetas de Drive." });
    }
  }

  /* ---------------------------------------------------------- acciones ---- */

  async function aplicar(ids: string[], cambios: Record<string, unknown>, ok: string) {
    setAviso(null);
    try {
      await pedir("/api/admin/documentos", "PATCH", { ids, ...cambios });
      setAviso({ ok: true, texto: ok });
      setSel(new Set());
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible guardar." });
    }
    await recargar();
  }

  async function eliminarDefinitivo(ids: string[]) {
    if (!window.confirm(`¿Eliminar definitivamente ${ids.length === 1 ? "este documento" : `estos ${ids.length} documentos`}? Se borran su texto, sus vectores y el archivo. No se puede deshacer.`)) return;
    try {
      for (const id of ids) await pedir(`/api/admin/documentos?id=${id}&definitivo=1`, "DELETE");
      setAviso({ ok: true, texto: "Se eliminó definitivamente." });
      setSel(new Set());
      if (abierto && ids.includes(abierto)) setAbierto(null);
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible eliminar." });
    }
    await recargar();
  }

  async function descargar(d: Documento) {
    try {
      const { url } = await pedir<{ url: string }>(`/api/admin/documentos?descargar=${d.id}`, "GET");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible bajar el archivo." });
    }
  }

  async function continuar(d: Documento) {
    setAviso(null);
    setVectorizando(d.id);
    try {
      await vectorizarHasta(d.id, () => void 0);
      setAviso({ ok: true, texto: `«${d.titulo}» quedó vectorizado.` });
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible vectorizar." });
    } finally {
      setVectorizando(null);
      await recargar();
    }
  }

  async function crearCarpeta(padreId: string | null) {
    const nombre = nombreCarpeta.trim();
    if (!nombre) return setNuevaCarpeta(null);
    try {
      await pedir("/api/admin/documentos/carpetas", "POST", { nombre, padreId });
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible crear la carpeta." });
    }
    setNombreCarpeta("");
    setNuevaCarpeta(null);
    await recargar();
  }

  /** Crea una carpeta desde el panel del documento y devuelve su id para dejarla elegida. */
  async function crearYDevolver(nombre: string): Promise<string | null> {
    try {
      const r = await pedir<{ carpeta: Carpeta }>("/api/admin/documentos/carpetas", "POST", { nombre, padreId: null });
      await recargar();
      return r.carpeta.id;
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible crear la carpeta." });
      return null;
    }
  }

  async function renombrar(c: Carpeta) {
    const nombre = window.prompt("Nuevo nombre de la carpeta", c.nombre)?.trim();
    if (!nombre || nombre === c.nombre) return;
    try {
      await pedir("/api/admin/documentos/carpetas", "PATCH", { id: c.id, nombre });
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible renombrar." });
    }
    await recargar();
  }

  async function borrarCarpeta(c: Carpeta) {
    if (!window.confirm(`¿Borrar la carpeta «${c.nombre}» y sus subcarpetas? Los documentos no se pierden: quedan sin carpeta.`)) return;
    try {
      await pedir(`/api/admin/documentos/carpetas?id=${c.id}`, "DELETE");
      if (vista.tipo === "carpeta" && vista.id === c.id) setVista({ tipo: "todos" });
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No fue posible borrar la carpeta." });
    }
    await recargar();
  }

  /* ------------------------------------------------------------ vista ---- */

  const todos = React.useMemo(() => datos?.documentos ?? [], [datos]);
  const papelera = React.useMemo(() => datos?.papelera ?? [], [datos]);
  const nombreCarpetaDe = React.useCallback((id: string | null) => carpetas.find((c) => c.id === id)?.nombre ?? null, [carpetas]);

  const descendientes = React.useCallback(
    (id: string): string[] => [id, ...hijosDe(id).flatMap((h) => descendientes(h.id))],
    [hijosDe]
  );

  const lista = React.useMemo(() => {
    let base = vista.tipo === "papelera" ? papelera : todos;
    if (vista.tipo === "sin") base = base.filter((d) => !d.carpetaId);
    if (vista.tipo === "carpeta") {
      const ids = new Set(descendientes(vista.id));
      base = base.filter((d) => d.carpetaId && ids.has(d.carpetaId));
    }
    if (!conVersiones && vista.tipo !== "papelera") base = base.filter((d) => d.vigente);
    const q = texto.trim().toLowerCase();
    if (q) base = base.filter((d) => [d.titulo, d.archivo, d.descripcion, d.categoria, d.autor, d.fuente, ...d.etiquetas].some((x) => x?.toLowerCase().includes(q)));
    if (tipo) base = base.filter((d) => d.tipo === tipo);
    if (estadoF) base = base.filter((d) => d.estado === estadoF);
    if (categoriaF) base = base.filter((d) => d.categoria?.trim() === categoriaF);
    if (ambitoF) base = base.filter((d) => (d.ambito ?? "alianza") === ambitoF);
    return [...base].sort((a, b) => (orden === "titulo" ? a.titulo.localeCompare(b.titulo, "es") : orden === "tamano" ? (b.bytes ?? 0) - (a.bytes ?? 0) : b.creadoEn.localeCompare(a.creadoEn)));
  }, [vista, todos, papelera, conVersiones, texto, tipo, estadoF, categoriaF, ambitoF, orden, descendientes]);
  /** Las fuentes de datos se ven en la lista general, como un documento más (sin filtros de texto activos). */
  const filasFuente = vista.tipo === "todos" && !texto && !tipo && !estadoF && !categoriaF && !ambitoF ? fuentes : [];

  const categorias = React.useMemo(() => [...new Set([...todos, ...papelera].map((d) => d.categoria?.trim()).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "es")), [todos, papelera]);
  const tipos = React.useMemo(() => [...new Set(todos.map((d) => d.tipo).filter((t): t is string => !!t))].sort(), [todos]);
  const documentoAbierto = [...todos, ...papelera].find((d) => d.id === abierto) ?? null;
  const enCola = cola.filter((i) => i.fase !== "listo" && i.fase !== "error").length;
  const conteo = (f: (d: Documento) => boolean) => todos.filter((d) => d.vigente && f(d)).length;
  const alternar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  /** Marca o desmarca un documento; con Mayús, todo el tramo entre el último marcado y este. */
  const marcar = (id: string, indice: number, mayus: boolean) => {
    if (mayus && ultimoMarcado.current !== null) {
      const [a, b] = [Math.min(ultimoMarcado.current, indice), Math.max(ultimoMarcado.current, indice)];
      setSel((s) => { const n = new Set(s); lista.slice(a, b + 1).forEach((d) => n.add(d.id)); return n; });
    } else alternar(id);
    ultimoMarcado.current = indice;
  };
  const alternarFuente = (id: string) => setSelFuentes((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function Carpetas({ padre, nivel }: { padre: string | null; nivel: number }) {
    return (
      <ul>
        {hijosDe(padre).map((c) => {
          const activa = vista.tipo === "carpeta" && vista.id === c.id;
          return (
            <li key={c.id}>
              <div
                className={`group flex items-center gap-1 rounded-lg pr-1 ${activa ? "bg-brand-soft" : "hover:bg-surface-muted"} ${sobreCarpeta === c.id ? "ring-2 ring-brand" : ""}`}
                style={{ paddingLeft: 8 + nivel * 14 }}
                onDragOver={(e) => { if (e.dataTransfer.types.includes("application/x-documentos")) { e.preventDefault(); setSobreCarpeta(c.id); } }}
                onDragLeave={() => setSobreCarpeta((x) => (x === c.id ? null : x))}
                onDrop={(e) => { const crudo = e.dataTransfer.getData("application/x-documentos"); setSobreCarpeta(null); if (!crudo) return; e.preventDefault(); const ids = JSON.parse(crudo) as string[]; void aplicar(ids, { carpetaId: c.id }, `Se movieron a «${c.nombre}».`); }}
              >
                <button type="button" onClick={() => setVista({ tipo: "carpeta", id: c.id })} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm">
                  {activa ? <FolderOpen className="size-4 shrink-0 text-brand" /> : <Folder className="size-4 shrink-0 text-muted-foreground" />}
                  <span className={`truncate ${activa ? "font-semibold" : ""}`}>{c.nombre}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{conteo((d) => d.carpetaId === c.id)}</span>
                </button>
                <span className="hidden items-center group-hover:flex">
                  <button type="button" aria-label={`Subcarpeta en ${c.nombre}`} onClick={() => setNuevaCarpeta(c.id)} className="rounded p-1 hover:bg-surface"><FolderPlus className="size-3.5" /></button>
                  <button type="button" aria-label={`Renombrar ${c.nombre}`} onClick={() => void renombrar(c)} className="rounded p-1 hover:bg-surface"><Pencil className="size-3.5" /></button>
                  <button type="button" aria-label={`Borrar ${c.nombre}`} onClick={() => void borrarCarpeta(c)} className="rounded p-1 hover:bg-surface"><Trash2 className="size-3.5" /></button>
                </span>
              </div>
              {nuevaCarpeta === c.id && <NuevaCarpeta padre={c.id} nivel={nivel + 1} />}
              <Carpetas padre={c.id} nivel={nivel + 1} />
            </li>
          );
        })}
      </ul>
    );
  }
  function NuevaCarpeta({ padre, nivel }: { padre: string | null; nivel: number }) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); void crearCarpeta(padre); }} className="flex items-center gap-1 py-1" style={{ paddingLeft: 8 + nivel * 14 }}>
        <input autoFocus value={nombreCarpeta} onChange={(e) => setNombreCarpeta(e.target.value)} placeholder="Nombre de la carpeta" maxLength={80} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-brand" />
        <button type="submit" aria-label="Crear carpeta" className="rounded p-1 hover:bg-surface-muted"><Check className="size-4" /></button>
        <button type="button" aria-label="Cancelar" onClick={() => { setNuevaCarpeta(null); setNombreCarpeta(""); }} className="rounded p-1 hover:bg-surface-muted"><X className="size-4" /></button>
      </form>
    );
  }

  const SelectorCarpeta = ({ valor, alElegir, etiqueta }: { valor: string; alElegir: (v: string) => void; etiqueta: string }) => {
    const opciones: { id: string; nombre: string }[] = [];
    const recorrer = (padre: string | null, prefijo: string) => hijosDe(padre).forEach((c) => { opciones.push({ id: c.id, nombre: `${prefijo}${c.nombre}` }); recorrer(c.id, `${prefijo}— `); });
    recorrer(null, "");
    return (
      <select aria-label={etiqueta} value={valor} onChange={(e) => alElegir(e.target.value)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold outline-none focus:border-brand">
        <option value="">{etiqueta}</option>
        <option value="__nueva">＋ Nueva carpeta…</option>
        <option value="__sin">Sin carpeta</option>
        {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
    );
  };

  return (
    <div className="space-y-4 [contain:inline-size]">
      <div className={`${tarjeta} p-5`}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand"><Library className="size-6" /></span>
          <div className="min-w-[min(100%,16rem)] flex-1">
            <h2 className="font-display text-lg font-semibold">Gestor documental</h2>
            <p className="text-sm text-muted-foreground">
              {datos?.tabla
                ? <>{numero(conteo(() => true))} documentos · {numero(conteo((d) => d.estado === "listo"))} listos · {numero(todos.reduce((s, d) => s + d.vectorizados, 0))} fragmentos vectorizados{datos.vectores?.listo ? <> · se vectoriza con <b>{datos.vectores.proveedor === "gemini" ? "Gemini" : "OpenAI"}</b> ({datos.vectores.modelo})</> : null}</>
                : "Carpetas, versiones, papelera y búsqueda por significado sobre los documentos de la Fundación."}
            </p>
          </div>
          <button type="button" onClick={() => entrada.current?.click()} disabled={!datos?.tabla} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"><UploadCloud className="size-4" /> Subir documentos</button>
          <button type="button" onClick={() => setDrive(true)} disabled={!datos?.tabla} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50">Google Drive</button>
          {drive && <GoogleDrive alCerrar={() => setDrive(false)} alElegir={(f, r) => agregarDeDrive(f, r)} />}
          <button type="button" onClick={() => void recargar()} className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-muted">Actualizar</button>
          <input ref={entrada} type="file" multiple accept={FORMATOS} className="hidden" onChange={(e) => { if (e.target.files) agregar(e.target.files); e.target.value = ""; }} />
          <input ref={entradaVersion} type="file" accept={FORMATOS} className="hidden" onChange={(e) => { if (e.target.files?.length && versionDe.current) agregar(e.target.files, versionDe.current); e.target.value = ""; }} />
        </div>
      </div>

      {datos?.error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{datos.error}</p>}
      {datos && !datos.configurada && <p className="rounded-xl bg-amber-500/10 p-3 text-sm">Falta conectar Supabase (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).</p>}
      {datos?.configurada && !datos.tabla && datos.sql && (
        <div className={`${tarjeta} space-y-3 p-5`}>
          <p className="flex items-start gap-2 text-sm"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" /> Falta crear las tablas de documentos en Supabase: un paso, con este SQL.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { void navigator.clipboard.writeText(datos.sql!); setCopiado(true); }} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"><Copy className="size-3.5" /> {copiado ? "Copiado" : "Copiar SQL"}</button>
            {datos.editorSql && <a href={datos.editorSql} target="_blank" rel="noreferrer" className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground">Abrir el editor de Supabase</a>}
          </div>
          <pre className="max-h-64 overflow-auto rounded-xl bg-surface-muted p-3 text-[11px]">{datos.sql}</pre>
        </div>
      )}
      {datos?.tabla && !datos.gestor && datos.sqlGestor && (
        <div className={`${tarjeta} space-y-3 p-5`}>
          <p className="flex items-start gap-2 text-sm"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" /> Para activar las carpetas, versiones, papelera e historial falta un paso en Supabase: ejecutar este SQL (se puede repetir sin problema).</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { void navigator.clipboard.writeText(datos.sqlGestor!); setCopiado(true); }} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"><Copy className="size-3.5" /> {copiado ? "Copiado" : "Copiar SQL"}</button>
            {datos.editorSql && <a href={datos.editorSql} target="_blank" rel="noreferrer" className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground">Abrir el editor de Supabase</a>}
          </div>
          <pre className="max-h-48 overflow-auto rounded-xl bg-surface-muted p-3 text-[11px]">{datos.sqlGestor}</pre>
        </div>
      )}

      {aviso && <p className={`flex items-start justify-between gap-3 rounded-xl p-3 text-sm ${aviso.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>{aviso.texto}<button type="button" aria-label="Cerrar" onClick={() => setAviso(null)}><X className="size-4" /></button></p>}

      {cola.length > 0 && (
        <div className={`${tarjeta} space-y-2 p-4`}>
          <div className="flex items-center justify-between text-sm font-semibold"><span>Subidas {enCola > 0 ? `· ${enCola} en curso` : ""}</span><button type="button" onClick={() => setCola((c) => c.filter((i) => i.fase !== "listo" && i.fase !== "error"))} className="text-xs font-semibold text-brand hover:underline">Limpiar terminadas</button></div>
          <ul className="space-y-2">
            {cola.map((i) => (
              <li key={i.clave} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate font-medium">{i.titulo}{i.versionDe ? " · nueva versión" : ""}</span><span className="text-xs text-muted-foreground">{FASE_TEXTO[i.fase]}</span></div>
                {i.fase !== "error" && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${i.progreso}%` }} /></div>}
                <p className="mt-1 text-xs text-muted-foreground">{i.fase === "error" ? i.error : i.detalle}</p>
                {i.fase === "error" && i.duplicadoDe && <button type="button" onClick={() => { setCola((l) => l.filter((x) => x.clave !== i.clave)); void atender([{ ...i, clave: `${i.clave}-d`, duplicar: true, fase: "espera", progreso: 0, detalle: "En cola", error: undefined, duplicadoDe: undefined }]); }} className="mt-2 rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted">Subirlo igual</button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {datos?.tabla && (
        <>
          <BuscarYPreguntar />
          <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <aside className={`${tarjeta} h-fit space-y-1 p-3`}>
              <button type="button" onClick={() => setVista({ tipo: "todos" })} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${vista.tipo === "todos" ? "bg-brand-soft font-semibold" : "hover:bg-surface-muted"}`}><Library className="size-4" /> Todos <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{conteo(() => true)}</span></button>
              {gestor && (
                <>
                  <button type="button" onClick={() => setVista({ tipo: "sin" })} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${vista.tipo === "sin" ? "bg-brand-soft font-semibold" : "hover:bg-surface-muted"}`}><Inbox className="size-4" /> Sin carpeta <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{conteo((d) => !d.carpetaId)}</span></button>
                  <div className="my-2 border-t border-border" />
                  <div className="flex items-center justify-between px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Carpetas</div>
                  <button type="button" onClick={() => { setNuevaCarpeta("raiz"); setNombreCarpeta(""); }} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-2 py-1.5 text-sm font-semibold text-brand hover:border-brand hover:bg-brand-soft"><FolderPlus className="size-4" /> Nueva carpeta</button>
                  {nuevaCarpeta === "raiz" && <NuevaCarpeta padre={null} nivel={0} />}
                  <Carpetas padre={null} nivel={0} />
                  {carpetas.length === 0 && nuevaCarpeta !== "raiz" && <p className="px-2 py-1 text-xs text-muted-foreground">Crea carpetas para ordenar tus documentos.</p>}
                  <div className="my-2 border-t border-border" />
                  <button type="button" onClick={() => setVista({ tipo: "papelera" })} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${vista.tipo === "papelera" ? "bg-brand-soft font-semibold" : "hover:bg-surface-muted"}`}><Archive className="size-4" /> Papelera <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">{papelera.length}</span></button>
                </>
              )}
              {fuentes.length > 0 && (
                <>
                  <div className="my-2 border-t border-border" />
                  <div className="px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Fuentes de datos</div>
                  {fuentes.map((f) => {
                    const activa = vista.tipo === "fuente" && vista.id === f.id;
                    return (
                      <button key={f.id} type="button" onClick={() => abrirFuente(f.id)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${activa ? "bg-brand-soft font-semibold" : "hover:bg-surface-muted"}`}>
                        <Database className="size-4" /> <span className="min-w-0 truncate">{f.nombre}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </aside>

            <section
              className={`${tarjeta} min-w-0 space-y-3 p-4 ${arrastrando ? "ring-2 ring-brand" : ""} ${vista.tipo === "fuente" ? "hidden" : ""}`}
              onDragOver={(e) => { if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => { if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); setArrastrando(false); if (e.dataTransfer.files.length) agregar(e.dataTransfer.files); }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 focus-within:border-brand"><Search className="size-4 text-muted-foreground" /><input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Filtrar por título, autor, etiqueta…" aria-label="Filtrar documentos" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
                <select aria-label="Tipo de archivo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold"><option value="">Todos los tipos</option>{tipos.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select>
                <select aria-label="Ámbito" value={ambitoF} onChange={(e) => setAmbitoF(e.target.value)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold"><option value="">Todos los ámbitos</option>{Object.entries(AMBITOS).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
                {categorias.length > 0 && <select aria-label="Categoría" value={categoriaF} onChange={(e) => setCategoriaF(e.target.value)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold"><option value="">Todas las categorías</option>{categorias.map((c) => <option key={c} value={c}>{c}</option>)}</select>}
                <select aria-label="Estado" value={estadoF} onChange={(e) => setEstadoF(e.target.value)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold"><option value="">Cualquier estado</option><option value="listo">Listos</option><option value="procesando">Procesando</option><option value="error">Con error</option></select>
                <select aria-label="Ordenar" value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold"><option value="reciente">Más recientes</option><option value="titulo">Por título</option><option value="tamano">Por tamaño</option></select>
                {gestor && <label className="flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" checked={conVersiones} onChange={(e) => setConVersiones(e.target.checked)} /> Ver versiones anteriores</label>}
              </div>

              {(sel.size > 0 || selFuentes.size > 0) && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-soft p-2 text-xs font-semibold">
                  <span>{sel.size + selFuentes.size} seleccionado{sel.size + selFuentes.size === 1 ? "" : "s"}{selFuentes.size > 0 ? ` (${sel.size} documento${sel.size === 1 ? "" : "s"} y ${selFuentes.size} fuente${selFuentes.size === 1 ? "" : "s"} de datos)` : ""}</span>
                  {sel.size === 0 && <span className="font-normal text-muted-foreground">Las fuentes de datos no se mueven ni se borran: se abren con un clic.</span>}
                  {sel.size === 0 ? null : vista.tipo === "papelera" ? (
                    <>
                      <button type="button" onClick={() => void aplicar([...sel], { accion: "restaurar" }, "Se restauraron.")} className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1"><ArchiveRestore className="size-3.5" /> Restaurar</button>
                      <button type="button" onClick={() => void eliminarDefinitivo([...sel])} className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-red-700"><Trash2 className="size-3.5" /> Eliminar definitivamente</button>
                    </>
                  ) : (
                    <>
                      <SelectorCarpeta valor="" etiqueta="Mover a una carpeta…" alElegir={(v) => {
                        if (!v) return;
                        if (v !== "__nueva") return void aplicar([...sel], { carpetaId: v === "__sin" ? null : v }, "Se movieron.");
                        const nombre = window.prompt("Nombre de la carpeta nueva")?.trim();
                        if (nombre) void crearYDevolver(nombre).then((id) => { if (id) void aplicar([...sel], { carpetaId: id }, `Se movieron a «${nombre}».`); });
                      }} />
                      <button type="button" onClick={() => { const t = window.prompt("Etiquetas a agregar, separadas por coma")?.split(",").map((x) => x.trim()).filter(Boolean); if (t?.length) void aplicar([...sel], { agregarEtiquetas: t }, "Etiquetas agregadas."); }} className="rounded-full bg-surface px-3 py-1">Etiquetar</button>
                      <button type="button" onClick={() => void aplicar([...sel], { accion: "papelera" }, "Pasaron a la papelera.")} className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1"><Archive className="size-3.5" /> A la papelera</button>
                    </>
                  )}
                  <button type="button" onClick={() => { setSel(new Set()); setSelFuentes(new Set()); }} className="ml-auto">Quitar selección</button>
                </div>
              )}

              {lista.length === 0 && filasFuente.length === 0 ? (
                <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                  <UploadCloud className="size-8" />
                  {vista.tipo === "papelera" ? "La papelera está vacía." : todos.length === 0 ? "Todavía no hay documentos. Arrastra archivos aquí o usa «Subir documentos»." : "Ningún documento coincide con los filtros."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[46rem] text-left text-sm">
                    <thead className="border-b border-border bg-surface-muted/60 text-[11px] tracking-wide text-muted-foreground uppercase">
                      <tr>
                        <th className="w-8 px-3 py-2.5"><input type="checkbox" aria-label="Seleccionar todos" checked={(lista.length > 0 || filasFuente.length > 0) && lista.every((d) => sel.has(d.id)) && filasFuente.every((f) => selFuentes.has(f.id))} onChange={(e) => { setSel(e.target.checked ? new Set(lista.map((d) => d.id)) : new Set()); setSelFuentes(e.target.checked ? new Set(filasFuente.map((f) => f.id)) : new Set()); }} /></th>
                        <th className="px-3 py-2.5 font-semibold">Documento</th>
                        {gestor && <th className="px-3 py-2.5 font-semibold">Carpeta</th>}
                        <th className="px-3 py-2.5 font-semibold">Tipo</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Tamaño</th>
                        <th className="px-3 py-2.5 font-semibold">Estado</th>
                        <th className="px-3 py-2.5 font-semibold">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasFuente.map((f) => (
                        <tr key={f.id} onClick={() => abrirFuente(f.id)} className="cursor-pointer border-b border-border/60 hover:bg-surface-muted/60">
                          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Seleccionar ${f.nombre}`} checked={selFuentes.has(f.id)} onChange={() => alternarFuente(f.id)} /></td>
                          <td className="max-w-[22rem] px-3 py-2.5">
                            <p className="flex items-center gap-1.5 truncate font-semibold"><Database className="size-4 shrink-0 text-brand" aria-hidden="true" />{f.nombre}</p>
                            <p className="truncate text-xs text-muted-foreground">{f.detalle}</p>
                          </td>
                          {gestor && <td className="px-3 py-2.5 text-xs text-muted-foreground">Fuentes de datos</td>}
                          <td className="px-3 py-2.5 text-xs font-semibold uppercase text-muted-foreground">Datos</td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">{f.resumen}</td>
                          <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONO_FUENTE[f.tono]}`}>{f.estado}</span></td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">{fecha(f.fecha ?? null)}</td>
                        </tr>
                      ))}
                      {lista.map((d, indiceFila) => (
                        <tr key={d.id} draggable onDragStart={(e) => { const ids = sel.has(d.id) ? [...sel] : [d.id]; e.dataTransfer.setData("application/x-documentos", JSON.stringify(ids)); e.dataTransfer.effectAllowed = "move"; }} onClick={() => setAbierto(d.id)} className={`cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted/60 ${abierto === d.id ? "bg-brand-soft/60" : ""}`}>
                          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Seleccionar ${d.titulo}`} checked={sel.has(d.id)} onChange={() => undefined} onClick={(e) => marcar(d.id, indiceFila, e.shiftKey)} /></td>
                          <td className="max-w-[22rem] px-3 py-2.5">
                            <p className="truncate font-semibold">{d.titulo}{d.version > 1 && <span className="ml-1.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">v{d.version}</span>}{(d.ambito ?? "alianza") !== "alianza" && <span className="ml-1.5 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">{AMBITOS[d.ambito ?? ""] ?? d.ambito}</span>}{d.confidencial && <span className="ml-1.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">CONFIDENCIAL</span>}{!d.vigente && <span className="ml-1.5 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">anterior</span>}</p>
                            <p className="truncate text-xs text-muted-foreground">{[d.categoria, d.autor, ...d.etiquetas.slice(0, 3).map((t) => `#${t}`)].filter(Boolean).join(" · ") || d.archivo}</p>
                          </td>
                          {gestor && <td className="px-3 py-2.5 text-xs text-muted-foreground">{nombreCarpetaDe(d.carpetaId) ?? "—"}</td>}
                          <td className="px-3 py-2.5 text-xs font-semibold uppercase text-muted-foreground">{d.tipo ?? "—"}</td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">{tamano(d.bytes)}</td>
                          <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO_CLASE[d.estado]}`}>{d.estado === "listo" ? "Listo" : d.estado === "error" ? "Con error" : d.estado === "procesando" ? `${d.vectorizados}/${d.fragmentos}` : "Subiendo"}</span></td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">{fecha(d.fechaDocumento ?? d.creadoEn)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">{lista.length} documento{lista.length === 1 ? "" : "s"}. Arrastra archivos sobre esta zona para subirlos{vista.tipo === "carpeta" ? " a la carpeta abierta" : ""}. Etiquetas de subida:{" "}
                <input value={etiquetasSubida} onChange={(e) => setEtiquetasSubida(e.target.value)} placeholder="plan de gobierno, Bolívar" aria-label="Etiquetas para lo que subas" className="ml-1 w-56 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px]" /></p>
            </section>
            {fuentes.map((f) => (
              <div key={f.id} hidden={!(vista.tipo === "fuente" && vista.id === f.id)} className="min-w-0">
                {fuentesAbiertas.has(f.id) && f.contenido}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sin las tablas de documentos la rejilla de arriba no se ve: la fuente de datos no debe quedar inalcanzable. */}
      {datos && !datos.tabla && fuentes.map((f) => <div key={f.id}>{f.contenido}</div>)}

      {documentoAbierto && <PanelDocumento key={documentoAbierto.id} doc={documentoAbierto} gestor={gestor} carpetas={carpetas} categorias={categorias} onNuevaCarpeta={crearYDevolver} vectorizando={vectorizando === documentoAbierto.id} onCerrar={() => setAbierto(null)} onDescargar={() => void descargar(documentoAbierto)} onContinuar={() => void continuar(documentoAbierto)} onGuardar={(c) => aplicar([documentoAbierto.id], c, "Cambios guardados.")} onVersion={() => { versionDe.current = documentoAbierto.id; entradaVersion.current?.click(); }} onEliminar={() => void eliminarDefinitivo([documentoAbierto.id])} />}
    </div>
  );
}

/* -------------------------------------------------------- buscar y preguntar ---- */

function BuscarYPreguntar() {
  const [q, setQ] = React.useState("");
  const [modo, setModo] = React.useState<"preguntar" | "buscar">("preguntar");
  const [ambitoQ, setAmbitoQ] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [respuesta, setRespuesta] = React.useState<Respuesta | null>(null);
  const [hallazgos, setHallazgos] = React.useState<{ resultados: Hallazgo[]; avisos: string[] } | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setCargando(true);
    setError(null);
    setRespuesta(null);
    setHallazgos(null);
    try {
      if (modo === "preguntar") setRespuesta(await pedir<Respuesta>("/api/admin/documentos/preguntar", "POST", { pregunta: q.trim(), ...(ambitoQ ? { ambito: ambitoQ } : {}) }));
      else setHallazgos(await pedir<{ resultados: Hallazgo[]; avisos: string[] }>("/api/admin/documentos/buscar", "POST", { consulta: q.trim(), cantidad: 8, ...(ambitoQ ? { ambito: ambitoQ } : {}) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible completar la consulta.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className={`${tarjeta} space-y-3 p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-brand" /> Preguntarle a los documentos</h3>
        <div className="ml-auto flex gap-1">
          <select aria-label="Buscar en" value={ambitoQ} onChange={(e) => setAmbitoQ(e.target.value)} className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold"><option value="">En todos los ámbitos</option>{Object.entries(AMBITOS).map(([id, n]) => <option key={id} value={id}>Solo {n}</option>)}</select>
          {(["preguntar", "buscar"] as const).map((m) => <button key={m} type="button" onClick={() => setModo(m)} className={`rounded-full px-3 py-1 text-xs font-semibold ${modo === m ? "bg-brand text-brand-foreground" : "ring-1 ring-border text-muted-foreground"}`}>{m === "preguntar" ? "Responder con citas" : "Solo buscar fragmentos"}</button>)}
        </div>
      </div>
      <form onSubmit={enviar} className="flex gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 focus-within:border-brand"><MessageSquareText className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="p. ej. ¿qué propone la alianza sobre seguridad rural?" aria-label="Pregunta" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <button type="submit" disabled={cargando || q.trim().length < 3} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">{cargando ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {modo === "preguntar" ? "Preguntar" : "Buscar"}</button>
      </form>
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {respuesta && (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap rounded-xl bg-brand-soft/60 p-4 text-sm leading-relaxed">{respuesta.respuesta}</p>
          {respuesta.avisos.map((a) => <p key={a} className="text-xs text-amber-800 dark:text-amber-300">{a}</p>)}
          {respuesta.fuentes.length > 0 && (
            <details className="rounded-xl border border-border p-3" open>
              <summary className="cursor-pointer text-xs font-semibold">Fuentes ({respuesta.fuentes.length})</summary>
              <ol className="mt-2 space-y-2">{respuesta.fuentes.map((f) => <li key={f.n} className="text-xs"><b>[{f.n}] {f.titulo}</b>{f.pagina ? ` · p. ${f.pagina}` : ""}<p className="mt-0.5 line-clamp-3 text-muted-foreground">{f.contenido}</p></li>)}</ol>
            </details>
          )}
          <p className="text-[11px] text-muted-foreground">La respuesta sale solo de los fragmentos citados; verifica en el documento antes de usarla.</p>
        </div>
      )}
      {hallazgos && (
        <div className="space-y-2">
          {hallazgos.avisos.map((a) => <p key={a} className="text-xs text-amber-800 dark:text-amber-300">{a}</p>)}
          {hallazgos.resultados.length === 0 ? <p className="text-sm text-muted-foreground">Sin resultados.</p> : hallazgos.resultados.map((h) => (
            <div key={`${h.documentoId}-${h.posicion}`} className="rounded-xl border border-border p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2 text-xs"><b>{h.titulo}</b>{h.pagina ? <span className="text-muted-foreground">p. {h.pagina}</span> : null}<span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">{Math.round(h.similitud * 100)} % de parecido</span></p>
              <p className="mt-1 line-clamp-4 text-muted-foreground">{h.contenido}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ panel del documento ---- */

function PanelDocumento({ doc, gestor, carpetas, categorias, onNuevaCarpeta, vectorizando, onCerrar, onDescargar, onContinuar, onGuardar, onVersion, onEliminar }: {
  doc: Documento; gestor: boolean; carpetas: Carpeta[]; categorias: string[]; onNuevaCarpeta: (nombre: string) => Promise<string | null>; vectorizando: boolean;
  onCerrar: () => void; onDescargar: () => void; onContinuar: () => void; onGuardar: (c: Record<string, unknown>) => Promise<void>; onVersion: () => void; onEliminar: () => void;
}) {
  const [f, setF] = React.useState({
    titulo: doc.titulo, descripcion: doc.descripcion ?? "", categoria: doc.categoria ?? "", autor: doc.autor ?? "", fuente: doc.fuente ?? "",
    fechaDocumento: doc.fechaDocumento ?? "", etiquetas: doc.etiquetas.join(", "), carpetaId: doc.carpetaId ?? "", confidencial: doc.confidencial, ambito: doc.ambito ?? "alianza",
  });
  const [detalle, setDetalle] = React.useState<Detalle | null>(null);
  const [guardando, setGuardando] = React.useState(false);
  React.useEffect(() => {
    let vivo = true;
    pedir<Detalle>(`/api/admin/documentos/detalle?id=${doc.id}`, "GET").then((d) => vivo && setDetalle(d)).catch(() => vivo && setDetalle({ versiones: [doc], eventos: [], fragmentos: [] }));
    return () => {
      vivo = false;
    };
  }, [doc]);
  const eliminada = !!doc.eliminadoEn;
  const opciones: { id: string; nombre: string }[] = [];
  const recorrer = (padre: string | null, p: string) => carpetas.filter((c) => c.padreId === padre).forEach((c) => { opciones.push({ id: c.id, nombre: `${p}${c.nombre}` }); recorrer(c.id, `${p}— `); });
  recorrer(null, "");

  async function guardar() {
    setGuardando(true);
    await onGuardar({
      titulo: f.titulo.trim() || doc.titulo,
      descripcion: f.descripcion.trim() || null,
      categoria: f.categoria.trim() || null,
      autor: f.autor.trim() || null,
      fuente: f.fuente.trim() || null,
      fechaDocumento: f.fechaDocumento || null,
      etiquetas: f.etiquetas.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20),
      carpetaId: f.carpetaId || null,
      confidencial: f.confidencial,
      ambito: f.ambito,
    });
    setGuardando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onCerrar}>
      <aside className="h-full w-full max-w-lg space-y-5 overflow-y-auto bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Documento ${doc.titulo}`}>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><FileText className="size-5" /></span>
          <div className="min-w-0 flex-1"><h3 className="font-display text-lg font-semibold [overflow-wrap:anywhere]">{doc.titulo}</h3><p className="text-xs text-muted-foreground">{doc.archivo} · {tamano(doc.bytes)}{doc.paginas ? ` · ${doc.paginas} págs.` : ""} · {numero(doc.fragmentos)} fragmentos · versión {doc.version}</p></div>
          <button type="button" aria-label="Cerrar" onClick={onCerrar} className="rounded p-1 hover:bg-surface-muted"><X className="size-5" /></button>
        </div>

        {doc.estado === "error" && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">{doc.error}</p>}
        {doc.estado !== "listo" && doc.estado !== "error" && <p className="rounded-xl bg-sky-500/10 p-3 text-xs">{doc.error ?? `Vectorizado ${doc.vectorizados} de ${doc.fragmentos} fragmentos.`}</p>}

        <div className="flex flex-wrap gap-2">
          {doc.archivo && <button type="button" onClick={onDescargar} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"><Download className="size-3.5" /> Descargar original</button>}
          {doc.estado !== "listo" && doc.fragmentos > 0 && <button type="button" onClick={onContinuar} disabled={vectorizando} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted disabled:opacity-60">{vectorizando ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Seguir vectorizando</button>}
          {gestor && !eliminada && <button type="button" onClick={onVersion} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"><UploadCloud className="size-3.5" /> Subir nueva versión</button>}
          {gestor && !eliminada && <button type="button" onClick={() => void onGuardar({ accion: "papelera" }).then(onCerrar)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"><Archive className="size-3.5" /> A la papelera</button>}
          {eliminada && <button type="button" onClick={() => void onGuardar({ accion: "restaurar" }).then(onCerrar)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"><ArchiveRestore className="size-3.5" /> Restaurar</button>}
          {(eliminada || !gestor) && <button type="button" onClick={onEliminar} className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-500/10 dark:text-red-300"><Trash2 className="size-3.5" /> Eliminar definitivamente</button>}
        </div>

        {gestor && !eliminada && (
          <form onSubmit={(e) => { e.preventDefault(); void guardar(); }} className="space-y-3">
            <h4 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Datos del documento</h4>
            <label className="block text-xs font-semibold">Título<input className={`${campo} mt-1 font-normal`} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={200} /></label>
            <label className="block text-xs font-semibold">Descripción<textarea className={`${campo} mt-1 font-normal`} rows={3} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} maxLength={1000} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold">Categoría<input list="categorias-documentos" className={`${campo} mt-1 font-normal`} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} placeholder="Elige una o escribe una nueva" maxLength={60} /><datalist id="categorias-documentos">{categorias.map((c) => <option key={c} value={c} />)}</datalist></label>
              <label className="block text-xs font-semibold">Fecha del documento<input type="date" className={`${campo} mt-1 font-normal`} value={f.fechaDocumento} onChange={(e) => setF({ ...f, fechaDocumento: e.target.value })} /></label>
              <label className="block text-xs font-semibold">Autor<input className={`${campo} mt-1 font-normal`} value={f.autor} onChange={(e) => setF({ ...f, autor: e.target.value })} maxLength={120} /></label>
              <label className="block text-xs font-semibold">Fuente<input className={`${campo} mt-1 font-normal`} value={f.fuente} onChange={(e) => setF({ ...f, fuente: e.target.value })} placeholder="entidad, medio o enlace" maxLength={200} /></label>
            </div>
            <label className="block text-xs font-semibold">Carpeta<select className={`${campo} mt-1 font-normal`} value={f.carpetaId} onChange={(e) => {
              if (e.target.value !== "__nueva") return setF({ ...f, carpetaId: e.target.value });
              const nombre = window.prompt("Nombre de la carpeta nueva")?.trim();
              if (nombre) void onNuevaCarpeta(nombre).then((id) => id && setF((x) => ({ ...x, carpetaId: id })));
            }}><option value="">Sin carpeta</option>{opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}<option value="__nueva">+ Crear carpeta nueva…</option></select></label>
            <label className="block text-xs font-semibold">Etiquetas (separadas por coma)<input className={`${campo} mt-1 font-normal`} value={f.etiquetas} onChange={(e) => setF({ ...f, etiquetas: e.target.value })} /></label>
            <label className="block text-xs font-semibold">Ámbito (a quién pertenece)<select className={`${campo} mt-1 font-normal`} value={f.ambito} onChange={(e) => setF({ ...f, ambito: e.target.value })}>{Object.entries(AMBITOS).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={f.confidencial} onChange={(e) => setF({ ...f, confidencial: e.target.checked })} /> Confidencial (se marca en la lista; no sale en el sitio público)</label>
            <button type="submit" disabled={guardando} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60">{guardando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar cambios</button>
          </form>
        )}

        {detalle && detalle.versiones.length > 1 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Versiones</h4>
            <ul className="space-y-1.5">{detalle.versiones.map((v) => <li key={v.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><b>v{v.version}</b><span className="min-w-0 flex-1 truncate">{v.archivo}</span><span className="text-muted-foreground">{fecha(v.creadoEn)}</span>{v.vigente && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">vigente</span>}</li>)}</ul>
          </div>
        )}

        {detalle && detalle.fragmentos.length > 0 && (
          <details className="rounded-xl border border-border p-3">
            <summary className="cursor-pointer text-xs font-bold tracking-wide text-muted-foreground uppercase">Vista previa del texto</summary>
            <ol className="mt-2 space-y-2">{detalle.fragmentos.map((x) => <li key={x.posicion} className="text-xs"><span className="text-muted-foreground">Fragmento {x.posicion + 1}{x.pagina ? ` · p. ${x.pagina}` : ""}</span><p className="line-clamp-4">{x.contenido}</p></li>)}</ol>
          </details>
        )}

        {detalle && detalle.eventos.length > 0 && (
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase"><History className="size-3.5" /> Historial</h4>
            <ul className="space-y-1.5">{detalle.eventos.map((e) => <li key={e.id} className="flex items-baseline gap-2 text-xs"><span className="font-semibold">{ACCION[e.accion] ?? e.accion}</span><span className="text-muted-foreground">{e.usuario ?? "—"} · {new Date(e.en).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</span></li>)}</ul>
          </div>
        )}
      </aside>
    </div>
  );
}
