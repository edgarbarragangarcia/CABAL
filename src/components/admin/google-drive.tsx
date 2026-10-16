"use client";

import * as React from "react";
import { ChevronRight, File as ArchivoIcono, Folder, Loader2, LogOut, Search, X } from "lucide-react";

/**
 * Importar desde Google Drive. El navegador pide permiso de solo lectura (scope drive.readonly) con el botón oficial de Google; el permiso
 * dura una hora, vive en la memoria de la pestaña y nunca pasa por el servidor ni se guarda. Los archivos se bajan en el navegador y
 * se entregan, ya como archivos, a quien los use (los mismos que si los hubieras elegido del computador).
 */

type ArchivoDrive = { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string };
type ClienteToken = { requestAccessToken: (o?: { prompt?: string }) => void };
type GoogleGlobal = { accounts: { oauth2: { initTokenClient: (c: { client_id: string; scope: string; callback: (r: { access_token?: string; error?: string; error_description?: string }) => void; error_callback?: (e: { type?: string; message?: string }) => void }) => ClienteToken; revoke: (t: string, cb?: () => void) => void } } };

const MIME_DOC = "application/vnd.google-apps.document";
const MIME_CARPETA = "application/vnd.google-apps.folder";
const MAX_BYTES = 4 * 1024 * 1024;
const EXT_OK = ["pdf", "docx", "txt", "md", "markdown", "csv", "tsv", "html", "htm", "json", "xml"];
const extDe = (n: string) => n.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

/** ¿Se puede leer? Documentos de Google (se exportan a texto) y archivos de los tipos que el panel entiende, hasta 4 MB. */
function importable(f: ArchivoDrive): { ok: boolean; motivo?: string } {
  if (f.mimeType === MIME_CARPETA) return { ok: false };
  if (f.mimeType === MIME_DOC) return { ok: true };
  if (f.mimeType.startsWith("application/vnd.google-apps.")) return { ok: false, motivo: "Tipo de Google no compatible" };
  if (!EXT_OK.includes(extDe(f.name))) return { ok: false, motivo: "Tipo no compatible" };
  if (Number(f.size ?? 0) > MAX_BYTES) return { ok: false, motivo: "Pesa más de 4 MB" };
  return { ok: true };
}

function cargarGoogle(): Promise<GoogleGlobal> {
  const w = window as unknown as { google?: GoogleGlobal };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  return new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => (w.google?.accounts?.oauth2 ? ok(w.google) : no(new Error("Google no respondió.")));
    s.onerror = () => no(new Error("No se pudo cargar el inicio de sesión de Google."));
    document.head.appendChild(s);
  });
}

const API = "https://www.googleapis.com/drive/v3";
const CAMPOS = "nextPageToken,files(id,name,mimeType,size,modifiedTime)";

export function GoogleDrive({ alElegir, alCerrar }: { alElegir: (archivos: File[]) => void | Promise<void>; alCerrar: () => void }) {
  const [clientId, setClientId] = React.useState<string | null | undefined>(undefined);
  const [token, setToken] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const [idNuevo, setIdNuevo] = React.useState("");
  const [ruta, setRuta] = React.useState<{ id: string; nombre: string }[]>([{ id: "root", nombre: "Mi unidad" }]);
  const [lista, setLista] = React.useState<ArchivoDrive[] | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const [marcados, setMarcados] = React.useState<Map<string, ArchivoDrive>>(new Map());
  const [busqueda, setBusqueda] = React.useState("");
  const [modo, setModo] = React.useState<"carpeta" | "compartidos" | "busqueda">("carpeta");
  const [progreso, setProgreso] = React.useState<{ hecho: number; total: number; texto: string } | null>(null);

  React.useEffect(() => {
    let vivo = true;
    fetch("/api/admin/google/config").then((r) => r.json()).then((j: { clientId: string | null }) => vivo && setClientId(j.clientId)).catch(() => vivo && setClientId(null));
    return () => { vivo = false; };
  }, []);

  const pedir = React.useCallback(async (url: string, t = token) => {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
    if (r.status === 401) { setToken(null); throw new Error("La conexión con Drive venció. Vuelve a conectar."); }
    if (!r.ok) throw new Error(`Drive respondió ${r.status}.`);
    return r;
  }, [token]);

  async function listar(q: string, t: string | null = token): Promise<ArchivoDrive[]> {
    const todos: ArchivoDrive[] = [];
    let pagina = "";
    do {
      const url = `${API}/files?${new URLSearchParams({ q, fields: CAMPOS, pageSize: "200", orderBy: "folder,name", supportsAllDrives: "true", includeItemsFromAllDrives: "true", ...(pagina ? { pageToken: pagina } : {}) })}`;
      const j = (await (await pedir(url, t)).json()) as { files?: ArchivoDrive[]; nextPageToken?: string };
      todos.push(...(j.files ?? []));
      pagina = j.nextPageToken ?? "";
    } while (pagina && todos.length < 1000);
    return todos;
  }

  async function abrir(q: string, t: string | null = token) {
    setCargando(true);
    setError("");
    try {
      setLista(await listar(q, t));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer Drive.");
    } finally {
      setCargando(false);
    }
  }

  async function guardarId() {
    setError("");
    const r = await fetch("/api/admin/google/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: idNuevo }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; clientId?: string };
    if (!r.ok || !j.clientId) return setError(j.error ?? "No se pudo guardar.");
    setClientId(j.clientId);
  }

  async function conectar() {
    setError("");
    if (!clientId) return;
    try {
      const g = await cargarGoogle();
      g.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: (r) => { if (r.access_token) { setToken(r.access_token); void abrir("'root' in parents and trashed = false", r.access_token); } else setError(r.error_description || r.error || "Google no dio el permiso."); },
        error_callback: (e) => setError(e.message || "Se cerró la ventana de Google antes de dar el permiso."),
      }).requestAccessToken({ prompt: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar con Google.");
    }
  }


  const irA = (carpeta: { id: string; nombre: string }, nueva = true) => {
    setModo("carpeta");
    setRuta((r) => (nueva ? [...r, carpeta] : r.slice(0, r.findIndex((x) => x.id === carpeta.id) + 1)));
    void abrir(`'${carpeta.id}' in parents and trashed = false`);
  };

  /** Todo lo importable dentro de una carpeta, incluidas sus subcarpetas (hasta 500 archivos). */
  async function dentroDe(id: string, acumulado: ArchivoDrive[] = []): Promise<ArchivoDrive[]> {
    for (const f of await listar(`'${id}' in parents and trashed = false`)) {
      if (acumulado.length >= 500) break;
      if (f.mimeType === MIME_CARPETA) await dentroDe(f.id, acumulado);
      else if (importable(f).ok) acumulado.push(f);
    }
    return acumulado;
  }

  async function marcarCarpeta(f: ArchivoDrive) {
    setCargando(true);
    try {
      const dentro = await dentroDe(f.id);
      setMarcados((m) => { const n = new Map(m); dentro.forEach((x) => n.set(x.id, x)); return n; });
      if (dentro.length === 0) setError("Esa carpeta no tiene archivos que se puedan importar.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la carpeta.");
    } finally {
      setCargando(false);
    }
  }

  async function importar() {
    const todos = [...marcados.values()];
    if (!todos.length || !token) return;
    const archivos: File[] = [];
    const fallos: string[] = [];
    for (let i = 0; i < todos.length; i++) {
      const f = todos[i];
      setProgreso({ hecho: i, total: todos.length, texto: f.name });
      try {
        const esDoc = f.mimeType === MIME_DOC;
        const r = await pedir(esDoc ? `${API}/files/${f.id}/export?mimeType=text%2Fplain` : `${API}/files/${f.id}?alt=media&supportsAllDrives=true`);
        const blob = await r.blob();
        archivos.push(new File([blob], esDoc ? `${f.name.replace(/\.[a-z0-9]+$/i, "")}.txt` : f.name, { type: blob.type }));
      } catch (e) {
        fallos.push(`${f.name}: ${e instanceof Error ? e.message : "no se pudo bajar"}`);
      }
    }
    setProgreso({ hecho: todos.length, total: todos.length, texto: "Entregando los archivos…" });
    if (archivos.length) await alElegir(archivos);
    setProgreso(null);
    if (fallos.length) setError(`${fallos.length} archivo(s) no se pudieron bajar: ${fallos.slice(0, 3).join(" · ")}`);
    else alCerrar();
  }

  function desconectar() {
    const t = token;
    setToken(null);
    setLista(null);
    setMarcados(new Map());
    if (t) void cargarGoogle().then((g) => g.accounts.oauth2.revoke(t)).catch(() => {});
  }

  const nMarcados = marcados.size;
  const alternar = (f: ArchivoDrive) => setMarcados((m) => { const n = new Map(m); if (n.has(f.id)) n.delete(f.id); else n.set(f.id, f); return n; });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Importar desde Google Drive">
      <div className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-lg"><span className="font-light">Importar de </span><span className="font-bold">Google Drive</span></h3>
          <div className="flex items-center gap-1">
            {token && <button type="button" onClick={desconectar} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted"><LogOut className="size-3.5" aria-hidden="true" />Desconectar</button>}
            <button type="button" onClick={alCerrar} aria-label="Cerrar" className="rounded-full p-2 hover:bg-surface-muted"><X className="size-4" aria-hidden="true" /></button>
          </div>
        </div>

        {clientId === undefined && <p className="p-6 text-sm text-muted-foreground">Preparando…</p>}
        {clientId === null && (
          <div className="space-y-4 overflow-y-auto p-6 text-sm">
            <p className="font-semibold">Un paso previo, una sola vez: registrar la app de Google.</p>
            <p className="text-muted-foreground">Google exige que toda aplicación tenga su propio «ID de cliente» antes de poder pedirte permiso. No es una clave secreta. Pégalo aquí y desde entonces el botón solo te lleva a elegir tu cuenta.</p>
            <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void guardarId(); }}>
              <input value={idNuevo} onChange={(e) => setIdNuevo(e.target.value)} placeholder="123456789-abc….apps.googleusercontent.com" className="min-w-64 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 font-mono text-xs" />
              <button type="submit" disabled={!idNuevo.trim()} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-50">Guardar</button>
            </form>
            {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
            <details className="rounded-xl bg-surface-muted p-3 text-xs">
              <summary className="cursor-pointer font-semibold">¿Cómo consigo ese ID? (10 minutos, con tu cuenta de Google)</summary>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
                <li>Entra a <strong>console.cloud.google.com</strong> y crea un proyecto (el nombre da igual).</li>
                <li>Menú › APIs y servicios › Biblioteca › busca <strong>Google Drive API</strong> › Habilitar.</li>
                <li>APIs y servicios › Pantalla de consentimiento de OAuth › «Externo» › pon un nombre y tu correo › en «Usuarios de prueba» agrega tu correo y el de quien vaya a usarlo.</li>
                <li>APIs y servicios › Credenciales › Crear credenciales › <strong>ID de cliente de OAuth</strong> › «Aplicación web» › en «Orígenes autorizados de JavaScript» pon <code>https://cabal-wine.vercel.app</code>.</li>
                <li>Copia el ID de cliente que te muestra y pégalo arriba.</li>
              </ol>
            </details>
          </div>
        )}
        {clientId && !token && (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Elige tu cuenta de Google y da permiso de <strong>solo lectura</strong>. El permiso dura una hora, queda solo en esta pestaña y no se guarda.</p>
            <button type="button" onClick={() => void conectar()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:opacity-90">Conectar Google Drive</button>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          </div>
        )}

        {token && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3 text-xs">
              <button type="button" onClick={() => { setModo("carpeta"); setRuta([{ id: "root", nombre: "Mi unidad" }]); void abrir("'root' in parents and trashed = false"); }} className={`rounded-full px-3 py-1 font-semibold ${modo === "carpeta" ? "bg-brand text-brand-foreground" : "ring-1 ring-border"}`}>Mi unidad</button>
              <button type="button" onClick={() => { setModo("compartidos"); void abrir("sharedWithMe and trashed = false"); }} className={`rounded-full px-3 py-1 font-semibold ${modo === "compartidos" ? "bg-brand text-brand-foreground" : "ring-1 ring-border"}`}>Compartidos conmigo</button>
              <form className="ml-auto flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); if (busqueda.trim()) { setModo("busqueda"); void abrir(`name contains '${busqueda.trim().replace(/'/g, "\\'")}' and trashed = false`); } }}>
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre" className="w-44 rounded-full border border-border bg-surface px-3 py-1" />
                <button type="submit" aria-label="Buscar" className="rounded-full p-1.5 hover:bg-surface-muted"><Search className="size-3.5" aria-hidden="true" /></button>
              </form>
            </div>
            {modo === "carpeta" && ruta.length > 1 && (
              <nav className="flex flex-wrap items-center gap-1 px-5 pt-3 text-xs text-muted-foreground" aria-label="Ruta">
                {ruta.map((r, i) => <React.Fragment key={r.id}>{i > 0 && <ChevronRight className="size-3" aria-hidden="true" />}<button type="button" onClick={() => irA(r, false)} className="font-semibold hover:text-foreground">{r.nombre}</button></React.Fragment>)}
              </nav>
            )}
            <div className="min-h-48 flex-1 overflow-y-auto px-2 py-2">
              {cargando && <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Leyendo Drive…</p>}
              {!cargando && lista && lista.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No hay nada aquí.</p>}
              {!cargando && lista?.map((f) => {
                const carpeta = f.mimeType === MIME_CARPETA;
                const imp = importable(f);
                return (
                  <div key={f.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-muted">
                    {carpeta ? <Folder className="size-4 shrink-0 text-amber-600" aria-hidden="true" /> : <input type="checkbox" disabled={!imp.ok} checked={marcados.has(f.id)} onChange={() => alternar(f)} aria-label={`Elegir ${f.name}`} className="size-4 shrink-0 accent-[var(--brand)] disabled:opacity-30" />}
                    {carpeta ? (
                      <button type="button" onClick={() => irA({ id: f.id, nombre: f.name })} className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{f.name}</button>
                    ) : (
                      <span className={`flex min-w-0 flex-1 items-center gap-2 text-sm ${imp.ok ? "" : "text-muted-foreground"}`}><ArchivoIcono className="size-3.5 shrink-0 opacity-60" aria-hidden="true" /><span className="truncate">{f.name}</span></span>
                    )}
                    {carpeta ? <button type="button" onClick={() => void marcarCarpeta(f)} className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-surface">Elegir todo lo de la carpeta</button> : <span className="shrink-0 text-[11px] text-muted-foreground">{imp.ok ? (f.mimeType === MIME_DOC ? "Documento de Google" : f.size ? `${Math.max(1, Math.round(Number(f.size) / 1024)).toLocaleString("es-CO")} KB` : "") : imp.motivo}</span>}
                  </div>
                );
              })}
            </div>
            {error && <p role="alert" className="border-t border-border px-5 py-2 text-xs text-red-700">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
              <span className="text-sm text-muted-foreground">{progreso ? `Bajando ${progreso.hecho + 1} de ${progreso.total}: ${progreso.texto}` : nMarcados ? `${nMarcados} archivo${nMarcados === 1 ? "" : "s"} elegido${nMarcados === 1 ? "" : "s"}` : "Marca los archivos o elige carpetas completas."}</span>
              <div className="flex gap-2">
                {nMarcados > 0 && !progreso && <button type="button" onClick={() => setMarcados(new Map())} className="rounded-full border border-border px-4 py-2 text-xs font-semibold">Quitar la selección</button>}
                <button type="button" disabled={!nMarcados || !!progreso} onClick={() => void importar()} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50">{progreso && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Importar {nMarcados || ""}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
