"use client";

import * as React from "react";
import Image from "next/image";
import { Briefcase, ExternalLink, GraduationCap, Landmark, Loader2, MapPin, SearchX } from "lucide-react";

import type { HojaDeVida } from "@/lib/gov-data/elecciones/hoja-de-vida";
import type { Candidato } from "@/lib/gov-data/elecciones/resultados";
import { titulo } from "./nombres";

const imagenUrl = (e: string, q: Record<string, string | undefined>) =>
  `/api/admin/elecciones/imagen?${new URLSearchParams(
    Object.entries({ e, ...q }).filter((kv): kv is [string, string] => !!kv[1])
  )}`;

const iniciales = (nombre: string) =>
  nombre
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** Imagen de la Registraduría; si no existe, las iniciales sobre el color del partido. */
function Avatar({
  src,
  alt,
  color,
  className,
  rounded,
  fit = "cover",
}: {
  src: string | null;
  alt: string;
  color: string;
  className: string;
  rounded: string;
  fit?: "cover" | "contain";
}) {
  const [fallo, setFallo] = React.useState<string | null>(null);
  if (!src || fallo === src) {
    return (
      <span
        className={`${className} ${rounded} grid shrink-0 place-items-center text-[0.65em] font-bold text-white shadow-sm`}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {iniciales(alt)}
      </span>
    );
  }
  return (
    <span className={`${className} ${rounded} relative shrink-0 overflow-hidden bg-white shadow-sm ring-1 ring-border`}>
      <Image
        src={src}
        alt={alt}
        fill
        unoptimized
        loading="lazy"
        sizes="64px"
        className={fit === "cover" ? "object-cover object-top" : "object-contain p-0.5"}
        onError={() => setFallo(src)}
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
  return <Avatar src={src} alt={titulo(candidato.nombre)} color={color} className={className} rounded="rounded-full" />;
}

// ------------------------------------------------------------ hoja de vida ---

type Estado = { cedula: string; hv?: HojaDeVida; error?: string };

/** "PROFESIONAL - DERECHO - Graduado" → "Profesional · Derecho · Graduado". */
const item = (s: string) =>
  s
    .split(" - ")
    .filter((p) => p && p !== "NO APLICA")
    .map(titulo)
    .join(" · ");

export function HojaDeVidaPanel({ cedula, nombre }: { cedula?: string; nombre: string }) {
  const [estado, setEstado] = React.useState<Estado | null>(null);
  const [todo, setTodo] = React.useState(false);

  React.useEffect(() => {
    if (!cedula) return;
    let cancelled = false;
    fetch(`/api/admin/elecciones/hoja-de-vida?cedula=${cedula}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`);
        if (!cancelled) setEstado({ cedula, hv: body as HojaDeVida });
      })
      .catch((err: Error) => {
        if (!cancelled) setEstado({ cedula, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [cedula]);

  const marco = "cabal-rise mt-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-surface to-sky-500/5 p-4 text-sm";

  if (!cedula) {
    return (
      <div className={marco}>
        <p className="text-muted-foreground">
          La Registraduría no publicó la cédula de los candidatos en esta elección; sin ella no se puede ubicar
          con certeza la hoja de vida de {titulo(nombre)}.
        </p>
      </div>
    );
  }
  const actual = estado?.cedula === cedula ? estado : null;
  if (!actual) {
    return (
      <div className={`${marco} flex items-center gap-2 text-muted-foreground`}>
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Consultando la hoja de vida en el SIGEP…
      </div>
    );
  }
  if (actual.error) {
    return <div className={`${marco} text-red-700 dark:text-red-300`}>{actual.error}</div>;
  }
  const hv = actual.hv!;
  if (!hv.encontrada) {
    return (
      <div className={`${marco} flex items-start gap-3`}>
        <SearchX className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-muted-foreground">
          {titulo(nombre)} no tiene hoja de vida pública en el SIGEP. Solo aparecen quienes han sido servidores
          públicos (congresistas, alcaldes, concejales, diputados, funcionarios…).
        </p>
      </div>
    );
  }

  const experiencia = todo ? hv.experiencia : hv.experiencia.slice(0, 5);
  return (
    <div className={marco}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Hoja de vida pública
          </p>
          <p className="font-semibold">{titulo(hv.nombre ?? nombre)}</p>
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

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <section>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Landmark className="size-3.5" aria-hidden="true" /> Cargos públicos
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

      <p className="mt-3 text-[11px] text-muted-foreground">Fuente: {hv.fuente}.</p>
    </div>
  );
}
