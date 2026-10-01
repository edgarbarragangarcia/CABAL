"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Briefcase,
  ExternalLink,
  Gavel,
  Globe,
  GraduationCap,
  Landmark,
  Loader2,
  MapPin,
  Newspaper,
  Save,
  ScrollText,
  Search,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Vote,
} from "lucide-react";

import type { AvalesResult } from "@/lib/gov-data/avales";
import type { PresenciaInternet } from "@/lib/gov-data/avales/presencia-internet";
import type { ResumenIa } from "@/lib/gov-data/avales/resumen-ia";
import type { Atestacion, Atestaciones, EstadoRevision, RevisionAval, Veredicto } from "@/lib/avales-store";
import { AvalesTerritorioPanel } from "./avales-territorio-panel";
import { Homonimos, enlaceExterno, iniciales, item, useHojaDeVida } from "./candidato-ui";
import { Markdown } from "./markdown-ia";
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

// ---------------------------------------------------------------- kpis ---

/** Mismo estilo de tarjetas que Red Cabal y Votaciones. */
const KPI_STYLES: { icon: LucideIcon; card: string; glow: string }[] = [
  { icon: Gavel, card: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/30" },
  { icon: Vote, card: "from-sky-500 to-indigo-600", glow: "shadow-sky-500/30" },
  { icon: Newspaper, card: "from-amber-400 to-orange-600", glow: "shadow-orange-500/30" },
];

const VEREDICTO_KPI: Record<Veredicto, { icon: LucideIcon; card: string; glow: string; label: string }> = {
  pendiente: { icon: ShieldQuestion, card: "from-slate-400 to-slate-600", glow: "shadow-slate-500/30", label: "Pendiente" },
  aval_recomendado: {
    icon: ShieldCheck,
    card: "from-emerald-500 to-green-600",
    glow: "shadow-emerald-500/30",
    label: "Recomendado",
  },
  aval_no_recomendado: {
    icon: ShieldAlert,
    card: "from-rose-500 to-red-600",
    glow: "shadow-rose-500/30",
    label: "No recomendado",
  },
};

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  card,
  glow,
  delay,
}: {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  card: string;
  glow: string;
  delay: number;
}) {
  return (
    <div
      className={`cabal-rise group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card} p-4 text-white shadow-lg ${glow} transition-transform duration-300 hover:-translate-y-1`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        aria-hidden="true"
        className="absolute -right-6 -bottom-8 size-24 rounded-full bg-white/15 transition-transform duration-500 group-hover:scale-125"
      />
      <div className="relative flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-white/85">{label}</p>
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/20 backdrop-blur">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="relative mt-2 text-2xl font-bold">{value}</p>
      <p className="relative text-[11px] text-white/80">{sub}</p>
    </div>
  );
}

function KpiRow({
  datos,
  internet,
  veredicto,
}: {
  datos: Peticion<AvalesResult>;
  internet: Peticion<PresenciaInternet>;
  veredicto: Veredicto;
}) {
  const disciplinario =
    datos.estado === "listo" && datos.data.disciplinario.ok ? datos.data.disciplinario.data.sanciones.length : null;
  const electoral =
    datos.estado === "listo" && datos.data.electoral.ok ? datos.data.electoral.data.coincidencias.length : null;
  const noticias = internet.estado === "listo" ? internet.data.noticias.length : null;
  const v = VEREDICTO_KPI[veredicto];
  const valor = (n: number | null) => (n === null ? "…" : n.toLocaleString("es-CO"));

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="Antecedentes disciplinarios"
        value={valor(disciplinario)}
        sub={disciplinario === null ? "consultando SIRI…" : disciplinario === 0 ? "sin sanciones" : "sanciones encontradas"}
        icon={KPI_STYLES[0].icon}
        card={KPI_STYLES[0].card}
        glow={KPI_STYLES[0].glow}
        delay={0}
      />
      <KpiCard
        label="Historial electoral"
        value={valor(electoral)}
        sub={electoral === null ? "revisando Senado y Presidencia…" : "coincidencias, 2018-2026"}
        icon={KPI_STYLES[1].icon}
        card={KPI_STYLES[1].card}
        glow={KPI_STYLES[1].glow}
        delay={80}
      />
      <KpiCard
        label="Menciones en prensa"
        value={valor(noticias)}
        sub={noticias === null ? "buscando en Google Noticias…" : "en Google Noticias"}
        icon={KPI_STYLES[2].icon}
        card={KPI_STYLES[2].card}
        glow={KPI_STYLES[2].glow}
        delay={160}
      />
      <KpiCard label="Estado del aval" value={v.label} sub="según la revisión guardada" icon={v.icon} card={v.card} glow={v.glow} delay={240} />
    </div>
  );
}

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
  const internet = usePeticion<PresenciaInternet>(`/api/admin/avales/internet?${new URLSearchParams({ nombre })}`);
  const revision = usePeticion<{ configured: boolean; revision: RevisionAval | null }>(
    `/api/admin/avales/revision?${new URLSearchParams({ cedula })}`
  );
  const veredictoActual: Veredicto =
    revision.estado === "listo" ? (revision.data.revision?.veredicto ?? "pendiente") : "pendiente";

  return (
    <div className="space-y-4">
      <KpiRow datos={datos} internet={internet} veredicto={veredictoActual} />

      <SeccionDisciplinario datos={datos} />

      <HojaDeVidaLinkedIn cedula={cedula} nombre={nombre} />

      <SeccionElectoral datos={datos} cedula={cedula} nombre={nombre} />

      <SeccionInternet nombre={nombre} datos={internet} />

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

// ---------------------------------------------------------- hoja de vida ---

/**
 * Ficha de perfil al estilo LinkedIn para Avales: mismo dato y misma lógica
 * de homónimos que `HojaDeVidaPanel` (candidato-ui.tsx, usado también en el
 * Explorador Electoral), vía el hook compartido `useHojaDeVida` — solo
 * cambia la presentación de este lado, así que el Explorador no se ve
 * afectado.
 */
function HojaDeVidaLinkedIn({ cedula, nombre }: { cedula?: string; nombre: string }) {
  const [todo, setTodo] = React.useState(false);
  const estado = useHojaDeVida(cedula, nombre);

  if (estado.estado === "cargando") {
    return (
      <div className={`${marco} flex items-center gap-2 text-sm text-muted-foreground`}>
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Buscando la hoja de vida en Función Pública…
      </div>
    );
  }
  if (estado.estado === "error") {
    return (
      <div className={`${marco} flex flex-wrap items-center justify-between gap-2 text-sm text-red-700 dark:text-red-300`}>
        {estado.error}
        <button
          type="button"
          onClick={estado.reintentar}
          className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground ring-1 ring-border transition hover:ring-emerald-500/50"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const hv = estado.hv;
  const buscarEnSigep = (
    <a href={hv.busqueda} target="_blank" rel="noopener noreferrer" className={enlaceExterno}>
      Buscar el nombre en el directorio del SIGEP <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );

  if (!hv.encontrada) {
    const n = hv.homonimos.length;
    return (
      <div className={marco}>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-muted-foreground">
            <SearchX className="size-4" aria-hidden="true" />
          </span>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {n > 1
              ? `Hay ${n} personas llamadas ${titulo(nombre)} en el SIGEP y nada indica cuál es el candidato. Revísalas:`
              : n === 1
                ? `En el SIGEP aparece una persona llamada ${titulo(nombre)}, pero nada confirma que sea el candidato: puede ser un homónimo. Revísala:`
                : `${titulo(nombre)} no aparece en el SIGEP ni en la lista PEP de Función Pública, las únicas hojas de vida oficiales: solo incluyen a quienes hoy trabajan para el Estado (servidores públicos y contratistas). La Registraduría no publica hojas de vida de los candidatos.`}
          </p>
        </div>
        {n > 0 && <Homonimos personas={hv.homonimos} />}
        <p className="mt-3 text-xs">{buscarEnSigep}</p>
      </div>
    );
  }

  const experiencia = todo ? hv.experiencia : hv.experiencia.slice(0, 5);
  const nombreMostrado = titulo(hv.nombre ?? nombre);

  return (
    <div className="cabal-rise overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="h-14 bg-gradient-to-r from-emerald-500 to-teal-600" />
      <div className="px-5 pb-5">
        <div className="-mt-8 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-3">
            <span className="grid size-16 shrink-0 place-items-center rounded-full border-4 border-surface bg-gradient-to-br from-emerald-500 to-teal-600 text-base font-bold text-white shadow-md">
              {iniciales(nombreMostrado)}
            </span>
            <div className="pb-1">
              <p className="text-base font-bold leading-tight">{nombreMostrado}</p>
              {hv.cargoActual && (
                <p className="text-sm text-muted-foreground">
                  {[hv.cargoActual.cargo, hv.cargoActual.entidad].filter(Boolean).map(titulo).join(" · ")}
                </p>
              )}
            </div>
          </div>
          {hv.enlace && (
            <a
              href={hv.enlace}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#0A66C2] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Ver en el SIGEP <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {hv.ubicadaPor === "cedula" && (
            <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
              Verificada con la cédula
            </span>
          )}
          {hv.ubicadaPor === "nombre" && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-800 dark:text-amber-300">
              Ubicada por el nombre completo
            </span>
          )}
          {hv.nacimiento && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" /> Nació en {titulo(hv.nacimiento)}
            </span>
          )}
        </div>

        {hv.ubicadaPor === "nombre" && (
          <p className="mt-2 text-xs text-muted-foreground">
            {!cedula
              ? "La Registraduría no publicó cédulas en esta elección"
              : hv.cargos.length
                ? "La lista PEP no enlaza su hoja de vida"
                : "Su cédula no figura en la lista PEP"}
            , así que se ubicó por el nombre completo, que en el SIGEP corresponde a una sola persona. Confirma que el
            cargo y la entidad sean los del candidato.
          </p>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold">
            <Briefcase className="size-4 text-brand" aria-hidden="true" /> Experiencia
          </h4>
          {hv.experiencia.length ? (
            <ul className="mt-3 space-y-4">
              {experiencia.map((x, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
                    <Briefcase className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{titulo(x.cargo)}</p>
                    <p className="text-xs text-muted-foreground">{titulo(x.entidad)}</p>
                    <p className="text-xs text-muted-foreground">
                      {x.inicio} – {x.fin === "Actual" ? "Actual" : x.fin}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No registrada en el SIGEP.</p>
          )}
          {hv.experiencia.length > 5 && (
            <button
              type="button"
              onClick={() => setTodo((v) => !v)}
              className="mt-3 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
            >
              {todo ? "Ver menos" : `Ver los ${hv.experiencia.length} cargos`}
            </button>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold">
            <GraduationCap className="size-4 text-brand" aria-hidden="true" /> Formación académica
          </h4>
          {hv.formacion.length ? (
            <ul className="mt-3 space-y-3">
              {hv.formacion.map((f, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
                    <GraduationCap className="size-4" aria-hidden="true" />
                  </span>
                  <p className="min-w-0 pt-1.5 font-medium">{item(f)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No registrada en el SIGEP.</p>
          )}
        </div>

        {hv.cargos.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              <Landmark className="size-4 text-brand" aria-hidden="true" /> Cargos públicos (lista PEP)
            </h4>
            <ul className="mt-3 space-y-2">
              {hv.cargos.map((c, i) => (
                <li key={i} className="rounded-lg bg-surface-muted/60 px-3 py-2 text-sm">
                  <p className="font-medium">{titulo(c.cargo)}</p>
                  <p className="text-xs text-muted-foreground">
                    {titulo(c.entidad)}
                    {c.desde && ` · desde ${c.desde}`}
                    {c.hasta && ` hasta ${c.hasta}`}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hv.homonimos.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              {hv.homonimos.length > 1
                ? `En el SIGEP hay ${hv.homonimos.length} personas con este nombre y nada indica cuál es el candidato:`
                : "En el SIGEP aparece una persona con este nombre, pero nada confirma que sea el candidato: puede ser un homónimo."}
            </p>
            <Homonimos personas={hv.homonimos} />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-[11px] text-muted-foreground">Fuente: {hv.fuente}.</p>
          {!hv.enlace && <p className="text-xs">{buscarEnSigep}</p>}
        </div>
      </div>
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

type EstadoIa =
  | { estado: "inicial" }
  | { estado: "buscando" }
  | { estado: "listo"; data: ResumenIa }
  | { estado: "error"; error: string };

function SeccionInternet({ nombre, datos }: { nombre: string; datos: Peticion<PresenciaInternet> }) {
  const [ia, setIa] = React.useState<EstadoIa>({ estado: "inicial" });

  const buscarConIa = () => {
    setIa({ estado: "buscando" });
    fetch("/api/admin/avales/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        return body as ResumenIa;
      })
      .then((data) => setIa({ estado: "listo", data }))
      .catch((err: Error) => setIa({ estado: "error", error: err.message }));
  };

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

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden="true" /> Búsqueda con IA
          </p>
          <button
            type="button"
            onClick={buscarConIa}
            disabled={ia.estado === "buscando"}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-semibold ring-1 ring-border transition hover:ring-emerald-500/50 disabled:opacity-50"
          >
            {ia.estado === "buscando" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-3.5" aria-hidden="true" />
            )}
            Buscar con IA
          </button>
        </div>

        {ia.estado === "inicial" && (
          <p className="mt-2 text-xs text-muted-foreground">
            El proveedor de IA elegido en Configuración busca por su cuenta en internet (redes sociales, noticias,
            controversias) y resume lo que encuentre, con sus fuentes. Cada clic consume una llamada a esa API.
          </p>
        )}
        {ia.estado === "error" && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{ia.error}</p>}
        {ia.estado === "listo" && (
          <div className="mt-2">
            <Markdown texto={ia.data.texto} />
            {ia.data.fuentes.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
                {ia.data.fuentes.map((f, i) => (
                  <li key={i}>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:underline dark:text-emerald-300"
                    >
                      {f.titulo}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
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
