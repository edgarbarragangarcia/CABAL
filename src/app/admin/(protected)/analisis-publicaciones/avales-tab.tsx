"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  ExternalLink,
  Gavel,
  GraduationCap,
  IdCard,
  Landmark,
  Loader2,
  MapPin,
  Newspaper,
  Save,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  Vote,
} from "lucide-react";

import type { AvalesResult } from "@/lib/gov-data/avales";
import type { RespuestaBusqueda } from "@/lib/gov-data/secop/tipos";
import type { PresenciaInternet } from "@/lib/gov-data/avales/presencia-internet";
import type { Atestacion, Atestaciones, EstadoRevision, RevisionAval, Veredicto } from "@/lib/avales-store";
import { AvalesTerritorioPanel } from "./avales-territorio-panel";
import { Avatar, Homonimos, enlaceExterno, imagenUrl, item, useHojaDeVida } from "./candidato-ui";
import { InvestigacionAval } from "./avales-investigacion";
import { SeccionContratosAval, fichaDeSecop } from "./contratos-aval";
import { KpiCard } from "./kpi-card";
import { usePeticion, type Peticion } from "./peticion";
import { titulo } from "./nombres";

const marco = "rounded-2xl border border-border bg-surface p-4 shadow-sm";
const tituloSeccion = "flex items-center gap-1.5 text-sm font-bold tracking-wide uppercase";

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

/** Lo que reúne la consulta: se muestra en colores vivos antes de buscar a alguien. */
const QUE_INCLUYE: { label: string; value: string; sub: string; icon: LucideIcon; card: string; glow: string }[] = [
  { label: "Antecedentes disciplinarios", value: "SIRI", sub: "Procuraduría · sanciones", icon: Gavel, card: "from-emerald-500 to-teal-600", glow: "shadow-emerald-500/30" },
  { label: "Hoja de vida pública", value: "SIGEP", sub: "Función Pública · PEP", icon: IdCard, card: "from-sky-500 to-indigo-600", glow: "shadow-sky-500/30" },
  { label: "Historial electoral", value: "2018‑2026", sub: "Registraduría · votos y cargos", icon: Vote, card: "from-amber-400 to-orange-600", glow: "shadow-orange-500/30" },
  { label: "Investigación a fondo", value: "IA", sub: "prensa, redes, orientación y Cabal", icon: Sparkles, card: "from-violet-500 to-fuchsia-600", glow: "shadow-fuchsia-500/30" },
  { label: "Contratación pública", value: "SECOP", sub: "I y II · contratos y relaciones", icon: Landmark, card: "from-rose-500 to-pink-600", glow: "shadow-rose-500/30" },
];

/** Cinco tarjetas: en el celular la última ocupa las dos columnas para no dejar un hueco. */
const REJILLA_5 = "grid grid-cols-2 gap-3 lg:grid-cols-5 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1";

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

function KpiRow({
  datos,
  internet,
  secop,
  veredicto,
}: {
  datos: Peticion<AvalesResult>;
  internet: Peticion<PresenciaInternet>;
  secop: Peticion<RespuestaBusqueda>;
  veredicto: Veredicto;
}) {
  const disciplinario =
    datos.estado === "listo" && datos.data.disciplinario.ok ? datos.data.disciplinario.data.sanciones.length : null;
  const electoral =
    datos.estado === "listo" && datos.data.electoral.ok ? datos.data.electoral.data.coincidencias.length : null;
  const noticias = internet.estado === "listo" ? internet.data.noticias.length : null;
  const ficha = fichaDeSecop(secop);
  const contratos = ficha ? ficha.resumen.contratista.n + ficha.resumen.representante.n : null;
  const vigentes = ficha ? ficha.resumen.contratista.vigentes + ficha.resumen.representante.vigentes : 0;
  const v = VEREDICTO_KPI[veredicto];
  const valor = (n: number | null) => (n === null ? "…" : n.toLocaleString("es-CO"));

  return (
    <div className={REJILLA_5}>
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
      <KpiCard
        label="Contratos públicos"
        value={valor(contratos)}
        sub={secop.estado === "error" ? "no se pudo consultar el SECOP" : contratos === null ? "consultando SECOP I y II…" : ficha?.fuentes.some((s) => !s.ok) ? "consulta incompleta: reintenta" : vigentes > 0 ? `${vigentes} vigente${vigentes === 1 ? "" : "s"} hoy` : "SECOP I y II"}
        icon={Landmark}
        card="from-rose-500 to-pink-600"
        glow="shadow-rose-500/30"
        delay={240}
      />
      <KpiCard label="Estado del aval" value={v.label} sub="según la revisión guardada" icon={v.icon} card={v.card} glow={v.glow} delay={320} />
    </div>
  );
}

// ---------------------------------------------------------------- fetch ---

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
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-xl shadow-emerald-900/5 sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="cabal-blob absolute -top-24 -left-16 size-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="cabal-blob absolute -top-10 right-0 size-64 rounded-full bg-sky-400/20 blur-3xl [animation-delay:-4s]" />
        <div className="cabal-blob absolute bottom-0 left-1/3 size-80 rounded-full bg-fuchsia-400/10 blur-3xl [animation-delay:-8s]" />
      </div>

      <div className="relative space-y-4">
        <div className="relative rounded-2xl bg-gradient-to-br from-emerald-700 via-teal-600 to-sky-600 p-5 text-white shadow-lg shadow-emerald-700/25">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute -right-10 -bottom-16 size-48 rounded-full bg-white/10" />
            <div className="absolute right-24 -top-12 size-28 rounded-full bg-amber-300/25 blur-xl" />
          </div>
          <div className="relative">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide backdrop-blur">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Verificación de avales · fuentes oficiales
            </p>
            <p className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
              {consulta ? `Verificando a ${titulo(consulta.nombre)}` : "Avales"}
            </p>
            <p className="mt-1 max-w-3xl text-xs text-white/85 sm:text-sm">
              {consulta
                ? `C.C. ${consulta.cedula} · antecedentes disciplinarios, hoja de vida pública, historial electoral, contratación pública e investigación a fondo.`
                : "Junta lo que se puede saber oficialmente de un aspirante a partir de su cédula —antecedentes disciplinarios, hoja de vida pública, historial electoral y contratos con el Estado— y deja constancia de la verificación manual y el veredicto final."}
            </p>

            <form onSubmit={enviar} className="mt-4 flex flex-wrap gap-2">
              <input
                value={cedulaInput}
                onChange={(e) => setCedulaInput(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="Número de cédula"
                aria-label="Número de cédula"
                className="w-full rounded-full border border-white/30 bg-white/95 px-4 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-amber-300 sm:w-44"
              />
              <input
                value={nombreInput}
                onChange={(e) => setNombreInput(e.target.value)}
                placeholder="Nombre completo"
                aria-label="Nombre completo"
                className="w-full rounded-full border border-white/30 bg-white/95 px-4 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-amber-300 sm:min-w-0 sm:flex-1"
              />
              <button
                type="submit"
                disabled={!cedulaValida || !nombreValido}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-300 px-5 py-2 text-sm font-bold sm:w-auto text-amber-950 shadow-md shadow-amber-900/20 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-white/80 disabled:shadow-none"
              >
                <Search className="size-4" aria-hidden="true" /> Consultar
              </button>
            </form>

            <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-300/20 p-2.5 text-[11px] text-amber-50 ring-1 ring-amber-200/30">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Esto no reemplaza el certificado oficial de la Procuraduría, la Contraloría ni la Policía Nacional, ni
              sustituye el juicio legal de la Fundación.
            </p>
          </div>
        </div>

        {consulta ? (
          <FichaAval key={`${consulta.cedula}|${consulta.nombre}`} cedula={consulta.cedula} nombre={consulta.nombre} />
        ) : (
          <div className={REJILLA_5}>
            {QUE_INCLUYE.map((c, i) => (
              <KpiCard key={c.label} label={c.label} value={c.value} sub={c.sub} icon={c.icon} card={c.card} glow={c.glow} delay={i * 80} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- ficha ---

function FichaAval({ cedula, nombre }: { cedula: string; nombre: string }) {
  const datos = usePeticion<AvalesResult>(`/api/admin/avales?${new URLSearchParams({ cedula, nombre })}`);
  const internet = usePeticion<PresenciaInternet>(`/api/admin/avales/internet?${new URLSearchParams({ nombre })}`);
  const secop = usePeticion<RespuestaBusqueda>(`/api/admin/secop?${new URLSearchParams({ modo: "cedula", q: cedula, nombre, compacto: "1" })}`);
  const revision = usePeticion<{ configured: boolean; revision: RevisionAval | null }>(
    `/api/admin/avales/revision?${new URLSearchParams({ cedula })}`
  );
  const veredictoActual: Veredicto =
    revision.estado === "listo" ? (revision.data.revision?.veredicto ?? "pendiente") : "pendiente";

  return (
    <div className="space-y-4">
      <KpiRow datos={datos} internet={internet} secop={secop} veredicto={veredictoActual} />

      <Dossier cedula={cedula} nombre={nombre} datos={datos} internet={internet} secop={secop} />

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

// ------------------------------------------------------------ dossier ---

/**
 * Una sola hoja de vida con todo lo que junta Avales — antecedentes
 * disciplinarios (SIRI), hoja de vida pública (SIGEP/PEP), trayectoria
 * electoral y presencia en internet — en vez de tarjetas sueltas: el
 * pedido fue "todo debe estar ahí, como una hoja de vida".
 *
 * La foto es real cuando hay una coincidencia electoral por cédula (misma
 * imagen que usa el Explorador, vía `/api/admin/elecciones/imagen`); si no,
 * iniciales — nunca un retrato inventado. El SIGEP no publica fotos.
 */
const ACENTOS = {
  emerald: "border-l-emerald-500 [&_h4]:text-emerald-700 dark:[&_h4]:text-emerald-300",
  sky: "border-l-sky-500 [&_h4]:text-sky-700 dark:[&_h4]:text-sky-300",
  amber: "border-l-amber-500 [&_h4]:text-amber-700 dark:[&_h4]:text-amber-300",
  rose: "border-l-rose-500 [&_h4]:text-rose-700 dark:[&_h4]:text-rose-300",
  violet: "border-l-violet-500 [&_h4]:text-violet-700 dark:[&_h4]:text-violet-300",
} as const;

/** Cada fuente del expediente en su propia tarjeta, con el color de su tarjeta de resumen de arriba. */
function TarjetaFuente({ acento, children }: { acento: keyof typeof ACENTOS; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-l-4 border-border bg-surface p-4 shadow-sm sm:p-5 [&_h4]:mb-2 [&_h4]:text-base ${ACENTOS[acento]}`}>{children}</div>
  );
}

function Dossier({
  cedula,
  nombre,
  datos,
  internet,
  secop,
}: {
  cedula: string;
  nombre: string;
  datos: Peticion<AvalesResult>;
  internet: Peticion<PresenciaInternet>;
  secop: Peticion<RespuestaBusqueda>;
}) {
  const hvEstado = useHojaDeVida(cedula, nombre);
  const hv = hvEstado.estado === "listo" ? hvEstado.hv : null;

  const coincidenciaConFoto =
    datos.estado === "listo" && datos.data.electoral.ok
      ? datos.data.electoral.data.coincidencias.find((c) => c.coincidePor === "cedula")
      : undefined;
  const fotoUrl = coincidenciaConFoto
    ? imagenUrl(coincidenciaConFoto.eleccionId, {
        t: "candidato",
        codcan: coincidenciaConFoto.candidato.codigo,
        sorteo: coincidenciaConFoto.candidato.sorteo,
        cedula: coincidenciaConFoto.candidato.cedula,
      })
    : null;

  const nombreMostrado = titulo(hv?.nombre ?? nombre);
  const subtitulo = hv?.cargoActual
    ? [hv.cargoActual.cargo, hv.cargoActual.entidad].filter(Boolean).map(titulo).join(" · ")
    : coincidenciaConFoto
      ? `Candidato · ${coincidenciaConFoto.corporacionNombre} · ${coincidenciaConFoto.eleccionNombre}`
      : "Ficha de verificación";

  return (
    <div className="cabal-rise overflow-visible rounded-2xl border border-border shadow-sm">
      {/* [contain:inline-size]: el nombre va en una sola línea (truncate); sin esto, un nombre largo ensanchaba toda la página en el celular. */}
      <div className="relative overflow-hidden rounded-t-2xl bg-slate-800 py-6 pr-5 pl-32 [contain:inline-size] sm:pl-40">
        <p className="truncate text-xl font-extrabold text-white sm:text-2xl">{nombreMostrado}</p>
        <p className="mt-1 truncate text-xs font-semibold tracking-widest text-white/70 uppercase">{subtitulo}</p>
        <span className="absolute -bottom-10 left-5 size-28 overflow-hidden rounded-full text-3xl ring-[6px] ring-surface shadow-lg sm:size-32 sm:text-4xl">
          <Avatar src={fotoUrl} alt={nombreMostrado} nombre={nombreMostrado} color="#059669" className="size-full" rounded="rounded-full" />
        </span>
      </div>

      <div className="grid overflow-hidden rounded-b-2xl sm:grid-cols-[13rem_1fr]">
        <aside className="space-y-5 bg-surface-muted/60 p-5 pt-14 text-sm sm:pt-16">
          <div>
            <p className="rounded-md bg-surface px-3 py-1.5 text-xs font-bold tracking-wide text-foreground uppercase shadow-sm">
              Ficha
            </p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-start gap-2">
                <IdCard className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>C.C. {cedula}</span>
              </li>
              {hv?.nacimiento && (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>Nació en {titulo(hv.nacimiento)}</span>
                </li>
              )}
              {hv?.encontrada && (
                <li className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>{hv.ubicadaPor === "cedula" ? "Verificada con la cédula" : "Ubicada por el nombre completo"}</span>
                </li>
              )}
            </ul>
            {hv?.enlace && (
              <a
                href={hv.enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
              >
                Ver en el SIGEP <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>

          {hv && hv.cargos.length > 0 && (
            <div>
              <p className="rounded-md bg-surface px-3 py-1.5 text-xs font-bold tracking-wide text-foreground uppercase shadow-sm">
                Cargos públicos (PEP)
              </p>
              <ul className="mt-3 space-y-3">
                {hv.cargos.map((c, i) => (
                  <li key={i}>
                    <p className="font-medium">{titulo(c.cargo)}</p>
                    <p className="text-xs text-muted-foreground">{titulo(c.entidad)}</p>
                    {(c.desde || c.hasta) && (
                      <p className="text-[11px] text-muted-foreground">
                        {c.desde}
                        {c.hasta && ` – ${c.hasta}`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="space-y-6 bg-surface p-5 pt-14 sm:pt-16">
          <TarjetaFuente acento="emerald">
            <SeccionDisciplinario datos={datos} />
          </TarjetaFuente>
          <TarjetaFuente acento="sky">
            <SeccionHojaDeVida estado={hvEstado} cedula={cedula} nombreMostrado={nombreMostrado} />
          </TarjetaFuente>
          <TarjetaFuente acento="amber">
            <SeccionElectoral datos={datos} cedula={cedula} nombre={nombre} />
          </TarjetaFuente>
          <TarjetaFuente acento="rose">
            <SeccionContratosAval secop={secop} cedula={cedula} nombre={nombre} />
          </TarjetaFuente>
          <TarjetaFuente acento="violet">
            <InvestigacionAval nombre={nombre} datos={internet} />
          </TarjetaFuente>

          <p className="border-t border-border pt-3 text-[11px] text-muted-foreground">
            Fuentes: Función Pública (SIRI, SIGEP/PEP), Registraduría Nacional del Estado Civil, Colombia Compra Eficiente (SECOP I y II), Google Noticias.
          </p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------- disciplinario ---

function SeccionDisciplinario({ datos }: { datos: Peticion<AvalesResult> }) {
  return (
    <section>
      <h4 className={tituloSeccion}>
        <Gavel className="size-4 text-brand" aria-hidden="true" /> Antecedentes disciplinarios (SIRI)
      </h4>
      {datos.estado === "cargando" ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Consultando el registro de sanciones e inhabilidades…
        </p>
      ) : datos.estado === "error" ? (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">{datos.error}</p>
      ) : !datos.data.disciplinario.ok ? (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">{datos.data.disciplinario.error}</p>
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
    </section>
  );
}

// ---------------------------------------------------------- hoja de vida ---

type EstadoHv = ReturnType<typeof useHojaDeVida>;

/** Experiencia y formación del SIGEP/PEP, o la nota de que esta persona no tiene hoja de vida oficial. */
function SeccionHojaDeVida({ estado, cedula, nombreMostrado }: { estado: EstadoHv; cedula: string; nombreMostrado: string }) {
  const [todo, setTodo] = React.useState(false);

  if (estado.estado === "cargando") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Buscando la hoja de vida en Función Pública…
      </p>
    );
  }
  if (estado.estado === "error") {
    return (
      <p className="flex flex-wrap items-center gap-2 text-xs text-red-700 dark:text-red-300">
        {estado.error}
        <button
          type="button"
          onClick={estado.reintentar}
          className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-foreground ring-1 ring-border hover:ring-emerald-500/50"
        >
          Reintentar
        </button>
      </p>
    );
  }

  const hv = estado.hv;
  if (!hv.encontrada) {
    const n = hv.homonimos.length;
    return (
      <section>
        <h4 className={tituloSeccion}>
          <Briefcase className="size-4 text-brand" aria-hidden="true" /> Hoja de vida pública
        </h4>
        <p className="mt-2 text-xs text-muted-foreground">
          {n > 1
            ? `Hay ${n} personas llamadas ${nombreMostrado} en el SIGEP y nada indica cuál es el candidato. Revísalas:`
            : n === 1
              ? `En el SIGEP aparece una persona llamada ${nombreMostrado}, pero nada confirma que sea el candidato: puede ser un homónimo. Revísala:`
              : `${nombreMostrado} no aparece en el SIGEP ni en la lista PEP de Función Pública, las únicas hojas de vida oficiales: solo incluyen a quienes hoy trabajan para el Estado (servidores públicos y contratistas). La Registraduría no publica hojas de vida de los candidatos.`}
        </p>
        {n > 0 && <Homonimos personas={hv.homonimos} />}
        <a href={hv.busqueda} target="_blank" rel="noopener noreferrer" className={`mt-2 inline-flex ${enlaceExterno}`}>
          Buscar el nombre en el directorio del SIGEP <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </section>
    );
  }

  const experiencia = todo ? hv.experiencia : hv.experiencia.slice(0, 5);

  return (
    <>
      {hv.ubicadaPor === "nombre" && (
        <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          {!cedula
            ? "La Registraduría no publicó cédulas en esta elección"
            : hv.cargos.length
              ? "La lista PEP no enlaza su hoja de vida"
              : "Su cédula no figura en la lista PEP"}
          , así que se ubicó por el nombre completo, que en el SIGEP corresponde a una sola persona. Confirma que el cargo
          y la entidad sean los del candidato.
        </p>
      )}

      <section>
        <h4 className={tituloSeccion}>
          <Briefcase className="size-4 text-brand" aria-hidden="true" /> Experiencia
        </h4>
        {hv.experiencia.length ? (
          <ul className="mt-3 space-y-3 border-l-2 border-emerald-500/30 pl-4">
            {experiencia.map((x, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[1.15rem] top-1.5 size-2.5 rounded-full bg-emerald-500 ring-4 ring-surface" />
                <p className="font-semibold">{titulo(x.cargo)}</p>
                <p className="text-xs text-muted-foreground italic">
                  {titulo(x.entidad)} · {x.inicio} – {x.fin === "Actual" ? "Actual" : x.fin}
                </p>
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
      </section>

      <section>
        <h4 className={tituloSeccion}>
          <GraduationCap className="size-4 text-brand" aria-hidden="true" /> Formación
        </h4>
        {hv.formacion.length ? (
          <ul className="mt-3 space-y-1.5">
            {hv.formacion.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                {item(f)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No registrada en el SIGEP.</p>
        )}
      </section>

      {hv.homonimos.length > 0 && (
        <section>
          <p className="text-xs text-muted-foreground">
            {hv.homonimos.length > 1
              ? `En el SIGEP hay ${hv.homonimos.length} personas con este nombre y nada indica cuál es el candidato:`
              : "En el SIGEP aparece una persona con este nombre, pero nada confirma que sea el candidato: puede ser un homónimo."}
          </p>
          <Homonimos personas={hv.homonimos} />
        </section>
      )}
    </>
  );
}

// ----------------------------------------------------------- electoral ---

function SeccionElectoral({ datos, cedula, nombre }: { datos: Peticion<AvalesResult>; cedula: string; nombre: string }) {
  return (
    <section>
      <h4 className={tituloSeccion}>
        <Vote className="size-4 text-brand" aria-hidden="true" /> Trayectoria electoral
      </h4>
      {datos.estado === "cargando" ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Revisando Senado y Presidencia (2018 a 2026)…
        </p>
      ) : datos.estado === "error" ? (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">{datos.error}</p>
      ) : !datos.data.electoral.ok ? (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">{datos.data.electoral.error}</p>
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
        no se buscan solos —hay miles de territorios—: &quot;sin coincidencias&quot; arriba no significa que nunca haya sido
        candidato a uno de esos cargos.
      </p>
      <AvalesTerritorioPanel cedula={cedula} nombre={nombre} />
    </section>
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
