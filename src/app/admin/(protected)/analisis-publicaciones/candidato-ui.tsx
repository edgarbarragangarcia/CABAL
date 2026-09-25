"use client";

import * as React from "react";
import Image from "next/image";
import { Briefcase, ExternalLink, GraduationCap, Landmark, Loader2, MapPin, SearchX } from "lucide-react";

import type { HojaDeVida, PersonaSigep } from "@/lib/gov-data/elecciones/hoja-de-vida";
import type { Candidato } from "@/lib/gov-data/elecciones/resultados";
import { titulo } from "./nombres";

const imagenUrl = (e: string, q: Record<string, string | undefined>) =>
  `/api/admin/elecciones/imagen?${new URLSearchParams(
    Object.entries({ e, ...q }).filter((kv): kv is [string, string] => !!kv[1])
  )}`;

/** Iniciales sin conectores ni la palabra "partido": "Partido Liberal Colombiano" → "LC". */
const iniciales = (nombre: string) =>
  nombre
    .split(" ")
    .filter((w) => w.length > 2 && !/^(partido|movimiento|politico|político|coalicion|coalición|del|las|los)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** Imagen de la Registraduría; si no existe, las iniciales sobre el color del partido. */
function Avatar({
  src,
  alt,
  nombre,
  color,
  className,
  rounded,
  fit = "cover",
}: {
  src: string | null;
  alt: string;
  /** Para las iniciales cuando no hay imagen. */
  nombre: string;
  color: string;
  className: string;
  rounded: string;
  fit?: "cover" | "contain";
}) {
  // Un reintento (la Registraduría a veces corta) antes de quedarse con las iniciales.
  const [fallos, setFallos] = React.useState<{ src: string | null; n: number }>({ src: null, n: 0 });
  const n = fallos.src === src ? fallos.n : 0;
  if (!src || n >= 2) {
    return (
      <span
        className={`${className} ${rounded} grid shrink-0 place-items-center text-[0.65em] font-bold text-white shadow-sm`}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {iniciales(nombre)}
      </span>
    );
  }
  return (
    <span className={`${className} ${rounded} relative shrink-0 overflow-hidden bg-white shadow-sm ring-1 ring-border`}>
      <Image
        src={n === 1 ? `${src}&r=1` : src}
        alt={alt}
        fill
        unoptimized
        loading="lazy"
        sizes="64px"
        className={fit === "cover" ? "object-cover object-top" : "object-contain p-0.5"}
        onError={() => setFallos({ src, n: n + 1 })}
      />
    </span>
  );
}

export function LogoPartido({
  eleccionId,
  logo,
  nombre,
  color,
  className = "size-6",
}: {
  eleccionId: string;
  logo?: string;
  nombre: string;
  color: string;
  className?: string;
}) {
  return (
    <Avatar
      src={logo && logo !== "0" ? imagenUrl(eleccionId, { t: "partido", logo }) : null}
      alt={`Logo de ${titulo(nombre)}`}
      nombre={nombre}
      color={color}
      className={className}
      rounded="rounded-lg"
      fit="contain"
    />
  );
}

export function FotoCandidato({
  eleccionId,
  candidato,
  logo,
  color,
  className = "size-12",
}: {
  eleccionId: string;
  candidato: Candidato;
  logo?: string;
  color: string;
  className?: string;
}) {
  const src =
    candidato.cedula || logo
      ? imagenUrl(eleccionId, {
          t: "candidato",
          logo,
          codcan: candidato.codigo,
          sorteo: candidato.sorteo,
          cedula: candidato.cedula,
        })
      : null;
  return (
    <Avatar
      src={src}
      alt={titulo(candidato.nombre)}
      nombre={candidato.nombre}
      color={color}
      className={className}
      rounded="rounded-full"
    />
  );
}

// ------------------------------------------------------------ hoja de vida ---

type Estado = { clave: string; hv?: HojaDeVida; error?: string };

/** "PROFESIONAL - DERECHO - Graduado" → "Profesional · Derecho · Graduado". */
const item = (s: string) =>
  s
    .split(" - ")
    .filter((p) => p && p !== "NO APLICA")
    .map(titulo)
    .join(" · ");

/** "MEDELLÍN - ANTIOQUIA" → "Medellín, Antioquia"; "BOGOTÁ. D.C. - BOGOTÁ. D.C." → "Bogotá D.C.". */
const lugar = (s: string) => {
  const [municipio, departamento] = s.split(" - ").map((p) => p.replace(/\.\s*D\.C\./, " D.C.").trim());
  return titulo(!departamento || departamento === municipio ? municipio : `${municipio}, ${departamento}`);
};

const enlaceExterno = "inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-300";

/** Personas del SIGEP con el nombre del candidato, para revisarlas a mano. */
function Homonimos({ personas }: { personas: PersonaSigep[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {personas.map((p) => (
        <li key={p.enlace}>
          <a
            href={p.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start justify-between gap-3 rounded-lg bg-surface px-2.5 py-1.5 ring-1 ring-border transition hover:ring-emerald-500/50"
          >
            <span className="min-w-0">
              <span className="font-medium">{titulo(p.nombre)}</span>
              <span className="block text-xs text-muted-foreground">
                {titulo(p.entidad)}
                {p.lugar && ` · ${lugar(p.lugar)}`}
                {p.tipo && ` · ${p.tipo}`}
              </span>
            </span>
            <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function HojaDeVidaPanel({ cedula, nombre }: { cedula?: string; nombre: string }) {
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [intento, setIntento] = React.useState(0);
  const [todo, setTodo] = React.useState(false);
  const url = `/api/admin/elecciones/hoja-de-vida?${new URLSearchParams(cedula ? { nombre, cedula } : { nombre })}`;
  const clave = `${url}#${intento}`;

  React.useEffect(() => {
    const k = `${url}#${intento}`;
    let cancelled = false;
    // Al reintentar, saltarse la copia que haya guardado el navegador.
    fetch(url, intento ? { cache: "reload" } : undefined)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        if (!cancelled) setEstado({ clave: k, hv: body as HojaDeVida });
      })
      .catch((err: Error) => {
        if (!cancelled) setEstado({ clave: k, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [url, intento]);

  const marco = "cabal-rise mt-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-surface to-sky-500/5 p-4 text-sm";

  const actual = estado?.clave === clave ? estado : null;
  if (!actual) {
    return (
      <div className={`${marco} flex items-center gap-2 text-muted-foreground`}>
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Buscando la hoja de vida en Función Pública…
      </div>
    );
  }
  if (actual.error) {
    return (
      <div className={`${marco} flex flex-wrap items-center justify-between gap-2 text-red-700 dark:text-red-300`}>
        {actual.error}
        <button
          type="button"
          onClick={() => setIntento((n) => n + 1)}
          className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-foreground ring-1 ring-border transition hover:ring-emerald-500/50"
        >
          Reintentar
        </button>
      </div>
    );
  }
  const hv = actual.hv!;
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
          <SearchX className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">
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
  return (
    <div className={marco}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Hoja de vida pública
            {hv.ubicadaPor === "cedula" && (
              <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 normal-case tracking-normal">
                Verificada con la cédula
              </span>
            )}
            {hv.ubicadaPor === "nombre" && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 normal-case tracking-normal text-amber-800 dark:text-amber-300">
                Ubicada por el nombre completo
              </span>
            )}
          </p>
          <p className="font-semibold">{titulo(hv.nombre ?? nombre)}</p>
          {hv.cargoActual && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Landmark className="size-3.5 shrink-0" aria-hidden="true" /> Hoy:{" "}
              {[hv.cargoActual.cargo, hv.cargoActual.entidad].filter(Boolean).map(titulo).join(" · ")}
            </p>
          )}
          {hv.nacimiento && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden="true" /> Nació en {titulo(hv.nacimiento)}
            </p>
          )}
        </div>
        {hv.enlace && (
          <a
            href={hv.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Ver en el SIGEP <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </div>

      {hv.ubicadaPor === "nombre" && (
        <p className="mt-2 text-xs text-muted-foreground">
          {!cedula
            ? "La Registraduría no publicó cédulas en esta elección"
            : hv.cargos.length
              ? "La lista PEP no enlaza su hoja de vida"
              : "Su cédula no figura en la lista PEP"}
          , así que se ubicó por el nombre completo, que en el SIGEP corresponde a una sola persona. Confirma que el cargo
          y la entidad sean los del candidato.
        </p>
      )}

      <div className={`mt-3 grid gap-4 ${hv.cargos.length ? "md:grid-cols-2" : ""}`}>
        {hv.cargos.length > 0 && (
          <section>
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Landmark className="size-3.5" aria-hidden="true" /> Cargos públicos (lista PEP)
            </h4>
            <ul className="mt-2 space-y-1.5">
              {hv.cargos.map((c, i) => (
                <li key={i} className="rounded-lg bg-surface px-2.5 py-1.5 ring-1 ring-border">
                  <span className="font-medium">{titulo(c.cargo)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {titulo(c.entidad)}
                    {c.desde && ` · desde ${c.desde}`}
                    {c.hasta && ` hasta ${c.hasta}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <GraduationCap className="size-3.5" aria-hidden="true" /> Formación académica
          </h4>
          {hv.formacion.length ? (
            <ul className="mt-2 space-y-1">
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
      </div>

      <section className="mt-4">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Briefcase className="size-3.5" aria-hidden="true" /> Experiencia laboral
        </h4>
        {hv.experiencia.length ? (
          <>
            <ol className="mt-2 space-y-2 border-l-2 border-emerald-500/30 pl-4">
              {experiencia.map((x, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
                  <span className="font-medium">{titulo(x.cargo)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {titulo(x.entidad)} · {x.inicio} – {x.fin === "Actual" ? "actual" : x.fin}
                  </span>
                </li>
              ))}
            </ol>
            {hv.experiencia.length > 5 && (
              <button
                type="button"
                onClick={() => setTodo((v) => !v)}
                className="mt-2 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
              >
                {todo ? "Ver menos" : `Ver los ${hv.experiencia.length} cargos`}
              </button>
            )}
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No registrada en el SIGEP.</p>
        )}
      </section>

      {hv.homonimos.length > 0 && (
        <section className="mt-4">
          <p className="text-xs text-muted-foreground">
            {hv.homonimos.length > 1
              ? `En el SIGEP hay ${hv.homonimos.length} personas con este nombre y nada indica cuál es el candidato:`
              : "En el SIGEP aparece una persona con este nombre, pero nada confirma que sea el candidato: puede ser un homónimo."}
          </p>
          <Homonimos personas={hv.homonimos} />
        </section>
      )}

      {!hv.enlace && <p className="mt-3 text-xs">{buscarEnSigep}</p>}
      <p className="mt-3 text-[11px] text-muted-foreground">Fuente: {hv.fuente}.</p>
    </div>
  );
}
