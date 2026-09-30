"use client";

import * as React from "react";
import {
  AlertTriangle,
  ExternalLink,
  Gavel,
  Globe,
  Loader2,
  Newspaper,
  Save,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Vote,
} from "lucide-react";

import type { AvalesResult } from "@/lib/gov-data/avales";
import type { PresenciaInternet } from "@/lib/gov-data/avales/presencia-internet";
import type { Atestacion, Atestaciones, EstadoRevision, RevisionAval, Veredicto } from "@/lib/avales-store";
import { AvalesTerritorioPanel } from "./avales-territorio-panel";
import { HojaDeVidaPanel } from "./candidato-ui";
import { titulo } from "./nombres";

const marco = "rounded-2xl border border-border bg-surface p-4 shadow-sm";

// ------------------------------------------------------------- checklist ---

const FILAS_MANUALES: {
  id: keyof Atestaciones;
  titulo: string;
  motivo: string;
  enlace: string;
  enlaceTexto: string;
}[] = [
  {
    id: "antecedentesJudiciales",
    titulo: "Antecedentes judiciales (Policía Nacional)",
    motivo:
      'Sus términos de uso restringen la consulta al titular de los datos: revisar a un tercero se declara "irregular" y sujeto a acciones legales. Solo el propio candidato puede consultarlo.',
    enlace: "https://antecedentes.policia.gov.co:7005/WebJudicial/",
    enlaceTexto: "Portal de la Policía Nacional",
  },
  {
    id: "certificadoProcuraduria",
    titulo: "Certificado unificado de antecedentes (Procuraduría)",
    motivo:
      "Cubre disciplinario, fiscal, penal y contractual en un solo certificado, pero el formulario exige responder una pregunta de verificación humana antes de mostrar el resultado.",
    enlace: "https://www.procuraduria.gov.co/Pages/Consulta-de-Antecedentes.aspx",
    enlaceTexto: "Portal de la Procuraduría",
  },
  {
    id: "certificadoContraloria",
    titulo: "Certificado de antecedentes fiscales (Contraloría)",
    motivo:
      "El formulario exige un reCAPTCHA antes de mostrar el resultado, y el dataset abierto de responsabilidad fiscal no cubre personas naturales.",
    enlace: "https://www.contraloria.gov.co/web/guest/persona-natural",
    enlaceTexto: "Portal de la Contraloría",
  },
];

const ESTADOS: { id: EstadoRevision; label: string }[] = [
  { id: "no_revisado", label: "No revisado" },
  { id: "verificado_sin_novedad", label: "Verificado — sin novedad" },
  { id: "verificado_con_novedad", label: "Verificado — con novedad" },
];

const ESTADO_CLASE: Record<EstadoRevision, string> = {
  no_revisado: "bg-surface-muted text-muted-foreground",
  verificado_sin_novedad: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
  verificado_con_novedad: "bg-red-600/15 text-red-700 dark:text-red-300",
};

const VEREDICTOS: { id: Veredicto; label: string }[] = [
  { id: "pendiente", label: "Pendiente" },
  { id: "aval_recomendado", label: "Aval recomendado" },
  { id: "aval_no_recomendado", label: "Aval no recomendado" },
];

const ATESTACION_VACIA: Atestacion = { estado: "no_revisado", nota: "", url: "" };
const atestacionesVacias = (): Atestaciones => ({
  antecedentesJudiciales: { ...ATESTACION_VACIA },
  certificadoProcuraduria: { ...ATESTACION_VACIA },
  certificadoContraloria: { ...ATESTACION_VACIA },
});

// ---------------------------------------------------------------- fetch ---

type Cargando = { estado: "cargando" };
type Fallo = { estado: "error"; error: string };
type Listo<T> = { estado: "listo"; data: T };
type Peticion<T> = Cargando | Fallo | Listo<T>;

function usePeticion<T>(url: string | null): Peticion<T> {
  const [estado, setEstado] = React.useState<{ url: string; r: Peticion<T> }>({ url: "", r: { estado: "cargando" } });
  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setEstado({ url, r: { estado: "cargando" } });
    fetch(url)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        return body as T;
      })
      .then((data) => !cancelled && setEstado({ url, r: { estado: "listo", data } }))
      .catch((err: Error) => !cancelled && setEstado({ url, r: { estado: "error", error: err.message } }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return url && estado.url === url ? estado.r : { estado: "cargando" };
}

// ----------------------------------------------------------------- tab ---

export function AvalesTab() {
  const [cedulaInput, setCedulaInput] = React.useState("");
  const [nombreInput, setNombreInput] = React.useState("");
  const [consulta, setConsulta] = React.useState<{ cedula: string; nombre: string } | null>(null);

  const cedulaValida = /^\d{3,12}$/.test(cedulaInput.trim());
  const nombreValido = nombreInput.trim().length >= 3;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cedulaValida || !nombreValido) return;
    setConsulta({ cedula: cedulaInput.trim(), nombre: nombreInput.replace(/\s+/g, " ").trim() });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className={marco}>
        <p className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ShieldCheck className="size-5 text-brand" aria-hidden="true" /> Avales
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Junta lo que se puede saber oficialmente de un aspirante a partir de su cédula —antecedentes disciplinarios, hoja
          de vida pública e historial electoral— y deja constancia de la verificación manual y el veredicto final.
        </p>
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Esto no reemplaza el certificado oficial de la Procuraduría, la Contraloría ni la Policía Nacional, ni sustituye
          el juicio legal de la Fundación.
        </p>

        <form onSubmit={enviar} className="mt-4 flex flex-wrap gap-2">
          <input
            value={cedulaInput}
            onChange={(e) => setCedulaInput(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Número de cédula"
            aria-label="Número de cédula"
            className="w-44 rounded-full border border-border bg-transparent px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/40"
          />
          <input
            value={nombreInput}
            onChange={(e) => setNombreInput(e.target.value)}
            placeholder="Nombre completo"
            aria-label="Nombre completo"
            className="min-w-0 flex-1 rounded-full border border-border bg-transparent px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/40"
          />
          <button
            type="submit"
            disabled={!cedulaValida || !nombreValido}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
          >
            <Search className="size-4" aria-hidden="true" /> Consultar
          </button>
        </form>
      </div>

      {consulta && <FichaAval key={`${consulta.cedula}|${consulta.nombre}`} cedula={consulta.cedula} nombre={consulta.nombre} />}
    </div>
  );
}

// --------------------------------------------------------------- ficha ---

function FichaAval({ cedula, nombre }: { cedula: string; nombre: string }) {
  const datos = usePeticion<AvalesResult>(`/api/admin/avales?${new URLSearchParams({ cedula, nombre })}`);
  const revision = usePeticion<{ configured: boolean; revision: RevisionAval | null }>(
    `/api/admin/avales/revision?${new URLSearchParams({ cedula })}`
  );

  return (
    <div className="space-y-4">
      <SeccionDisciplinario datos={datos} />

      <div className={marco}>
        <HojaDeVidaPanel cedula={cedula} nombre={nombre} />
      </div>

      <SeccionElectoral datos={datos} cedula={cedula} nombre={nombre} />

      <SeccionInternet nombre={nombre} />

      {revision.estado === "cargando" ? (
        <div className={`${marco} flex items-center gap-2 text-sm text-muted-foreground`}>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando la revisión guardada…
        </div>
      ) : revision.estado === "error" ? (
        <div className={`${marco} text-sm text-red-700 dark:text-red-300`}>{revision.error}</div>
      ) : (
        <ChecklistYVeredicto cedula={cedula} nombre={nombre} configured={revision.data.configured} inicial={revision.data.revision} />
      )}
    </div>
  );
}

// ------------------------------------------------------- disciplinario ---

function SeccionDisciplinario({ datos }: { datos: Peticion<AvalesResult> }) {
  return (
    <div className={marco}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Gavel className="size-3.5" aria-hidden="true" /> Antecedentes disciplinarios (SIRI)
      </p>
      {datos.estado === "cargando" ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Consultando el registro de sanciones e inhabilidades…
        </p>
      ) : datos.estado === "error" ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{datos.error}</p>
      ) : !datos.data.disciplinario.ok ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{datos.data.disciplinario.error}</p>
      ) : !datos.data.disciplinario.data.encontrada ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="size-4" aria-hidden="true" /> Sin sanciones disciplinarias en SIRI.
        </p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {datos.data.disciplinario.data.sanciones.map((s, i) => (
            <li key={i} className="rounded-lg bg-red-600/5 px-3 py-2 ring-1 ring-red-600/20">
              <p className="flex items-center gap-1.5 font-medium text-red-700 dark:text-red-300">
                <ShieldAlert className="size-4 shrink-0" aria-hidden="true" /> {titulo(s.sanciones || s.tipoInhabilidad)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[titulo(s.cargo), titulo(s.entidadSancionado), s.lugarHechos && titulo(s.lugarHechos)].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[s.duracion, s.fechaEfectosJuridicos && `efectos: ${s.fechaEfectosJuridicos}`, s.autoridad && titulo(s.autoridad)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Fuente: Función Pública — Sistema de Información de Registro de Sanciones e Inhabilidades (SIRI). Referencia
        informativa, no reemplaza el certificado oficial de la Procuraduría.
      </p>
    </div>
  );
}

// ----------------------------------------------------------- electoral ---

function SeccionElectoral({ datos, cedula, nombre }: { datos: Peticion<AvalesResult>; cedula: string; nombre: string }) {
  return (
    <div className={marco}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Vote className="size-3.5" aria-hidden="true" /> Historial electoral
      </p>
      {datos.estado === "cargando" ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Revisando Senado y Presidencia (2018 a 2026)…
        </p>
      ) : datos.estado === "error" ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{datos.error}</p>
      ) : !datos.data.electoral.ok ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{datos.data.electoral.error}</p>
      ) : datos.data.electoral.data.coincidencias.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sin coincidencias en Senado ni Presidencia (2018 a 2026).</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm">
          {datos.data.electoral.data.coincidencias.map((c, i) => (
            <li key={i} className="rounded-lg bg-surface-muted/60 px-2.5 py-1.5">
              <span className="font-medium">{c.eleccionNombre}</span> · {c.corporacionNombre}
              <span
                className={
                  c.coincidePor === "cedula"
                    ? "ml-1.5 rounded-full bg-emerald-600/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                    : "ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300"
                }
              >
                {c.coincidePor === "cedula" ? "por cédula" : "por nombre"}
              </span>
              <span className="block text-xs text-muted-foreground">
                {c.partido ?? "Sin partido"} · {c.candidato.votos.toLocaleString("es-CO")} votos{c.candidato.electo && " · Electo"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {datos.estado === "listo" && datos.data.electoral.ok && datos.data.electoral.data.noConsultadas.length > 0 && (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
          No se pudo revisar: {datos.data.electoral.data.noConsultadas.map((n) => `${n.eleccionNombre} (${n.corporacion})`).join(", ")}.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Se revisó automáticamente Senado y Presidencia, 2018 a 2026. Cámara, Gobernación, Alcaldía, Asamblea, Concejo y JAL
        no se buscan solos —hay miles de territorios—: "sin coincidencias" arriba no significa que nunca haya sido
        candidato a uno de esos cargos.
      </p>
      <AvalesTerritorioPanel cedula={cedula} nombre={nombre} />
    </div>
  );
}

// ------------------------------------------------------------- internet ---

/** Ninguna plataforma ofrece búsqueda por nombre vía API pública; son solo enlaces para que el revisor entre a mirar. */
function enlacesRedes(nombre: string) {
  const q = encodeURIComponent(nombre);
  return [
    { plataforma: "Google", url: `https://www.google.com/search?q=${q}` },
    { plataforma: "X / Twitter", url: `https://twitter.com/search?q=${q}&f=live` },
    { plataforma: "Facebook", url: `https://www.facebook.com/search/top?q=${q}` },
    { plataforma: "Instagram", url: `https://www.instagram.com/explore/search/keyword/?q=${q}` },
    { plataforma: "LinkedIn", url: `https://www.linkedin.com/search/results/all/?keywords=${q}` },
    { plataforma: "TikTok", url: `https://www.tiktok.com/search?q=${q}` },
  ];
}

function SeccionInternet({ nombre }: { nombre: string }) {
  const datos = usePeticion<PresenciaInternet>(`/api/admin/avales/internet?${new URLSearchParams({ nombre })}`);
  return (
    <div className={marco}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Globe className="size-3.5" aria-hidden="true" /> Presencia en internet y redes sociales
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {enlacesRedes(nombre).map((e) => (
          <a
            key={e.plataforma}
            href={e.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold ring-1 ring-border transition hover:ring-emerald-500/50"
          >
            {e.plataforma} <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          </a>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Ninguna red social ofrece búsqueda por nombre vía API pública: son enlaces para revisar a mano.
      </p>

      <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Newspaper className="size-3.5" aria-hidden="true" /> Menciones en Google Noticias
      </p>
      {datos.estado === "cargando" ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Buscando menciones recientes…
        </p>
      ) : datos.estado === "error" ? (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{datos.error}</p>
      ) : datos.data.noticias.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sin menciones recientes en Google Noticias.</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm">
          {datos.data.noticias.map((n, i) => (
            <li key={i}>
              <a
                href={n.enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-700 hover:underline dark:text-emerald-300"
              >
                {n.titulo}
              </a>
              <span className="block text-xs text-muted-foreground">
                {n.medio} · {new Date(n.fecha).toLocaleDateString("es-CO")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------ checklist final ---

function ChecklistYVeredicto({
  cedula,
  nombre,
  configured,
  inicial,
}: {
  cedula: string;
  nombre: string;
  configured: boolean;
  inicial: RevisionAval | null;
}) {
  const [atestaciones, setAtestaciones] = React.useState<Atestaciones>(inicial?.atestaciones ?? atestacionesVacias());
  const [veredicto, setVeredicto] = React.useState<Veredicto>(inicial?.veredicto ?? "pendiente");
  const [notaVeredicto, setNotaVeredicto] = React.useState(inicial?.notaVeredicto ?? "");
  const [guardado, setGuardado] = React.useState<RevisionAval | null>(inicial);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const actualizarFila = (id: keyof Atestaciones, cambios: Partial<Atestacion>) =>
    setAtestaciones((a) => ({ ...a, [id]: { ...a[id], ...cambios } }));

  const guardar = () => {
    setGuardando(true);
    setError(null);
    fetch("/api/admin/avales/revision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cedula, nombre, atestaciones, veredicto, notaVeredicto }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        return body as { configured: boolean; revision?: RevisionAval };
      })
      .then((body) => body.revision && setGuardado(body.revision))
      .catch((err: Error) => setError(err.message))
      .finally(() => setGuardando(false));
  };

  return (
    <div className={marco}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ScrollText className="size-3.5" aria-hidden="true" /> Verificación manual
      </p>

      {!configured && (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <ShieldQuestion className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Todavía no hay una base de datos conectada para guardar la revisión: puedes completar el checklist, pero al
          recargar la página se pierde. Conecta el proyecto de Supabase de CABAL para que quede guardado.
        </p>
      )}

      <div className="mt-3 space-y-3">
        {FILAS_MANUALES.map((fila) => {
          const a = atestaciones[fila.id];
          return (
            <div key={fila.id} className="rounded-xl bg-surface-muted/60 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{fila.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{fila.motivo}</p>
                </div>
                <a href={fila.enlace} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300">
                  {fila.enlaceTexto} <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={a.estado}
                  onChange={(e) => actualizarFila(fila.id, { estado: e.target.value as EstadoRevision })}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold outline-none ${ESTADO_CLASE[a.estado]}`}
                >
                  {ESTADOS.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
                <input
                  value={a.url}
                  onChange={(e) => actualizarFila(fila.id, { url: e.target.value })}
                  placeholder="Enlace al PDF guardado (opcional)"
                  className="min-w-[12rem] flex-1 rounded-full border border-border bg-surface px-3 py-1 text-xs outline-none"
                />
              </div>
              <textarea
                value={a.nota}
                onChange={(e) => actualizarFila(fila.id, { nota: e.target.value })}
                placeholder="Nota (opcional)"
                rows={2}
                className="mt-2 w-full resize-y rounded-lg border border-border bg-surface px-3 py-1.5 text-xs outline-none"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-sm font-medium">Veredicto</p>
        <div className="mt-2 inline-flex flex-wrap gap-1 rounded-full bg-surface-muted p-1 text-sm ring-1 ring-border">
          {VEREDICTOS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVeredicto(v.id)}
              className={
                veredicto === v.id
                  ? "rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1.5 font-semibold text-white shadow"
                  : "rounded-full px-4 py-1.5 text-muted-foreground transition hover:text-foreground"
              }
            >
              {v.label}
            </button>
          ))}
        </div>
        <textarea
          value={notaVeredicto}
          onChange={(e) => setNotaVeredicto(e.target.value)}
          placeholder="Justificación del veredicto (opcional)"
          rows={3}
          className="mt-2 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none"
        />
        <p className="mt-2 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Esto no reemplaza el certificado oficial ni sustituye el juicio legal de la Fundación.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !configured}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
          >
            {guardando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            Guardar revisión
          </button>
          {error && <p className="text-xs text-red-700 dark:text-red-300">{error}</p>}
          {guardado?.revisadoPor && (
            <p className="text-xs text-muted-foreground">
              Revisado por {guardado.revisadoPor} · {new Date(guardado.actualizadoEn).toLocaleString("es-CO")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
