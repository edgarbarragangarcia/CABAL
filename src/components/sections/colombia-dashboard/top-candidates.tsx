import type { CandidateVotes } from "@/lib/gov-data/queries";

/** "ALVARO URIBE VELEZ" -> "Alvaro Uribe Velez" (los nombres llegan en mayúsculas). */
function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export function TopCandidates({
  candidates,
  year,
  source,
  sourceUrl,
}: {
  candidates: CandidateVotes[];
  year: number;
  source: string;
  sourceUrl: string;
}) {
  const max = candidates[0]?.votos ?? 1;

  return (
    <div className="card-premium p-4 sm:p-6">
      <p className="text-sm font-semibold">Candidatos más votados al Senado, {year}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Suma de votos por candidato a nivel de mesa. No incluye votos en blanco, nulos, ni los
        marcados solo por el partido (sin preferencia individual).
      </p>

      <ol className="mt-5 space-y-4">
        {candidates.map((c, i) => (
          <li key={c.candidato}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium">
                <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                {toTitleCase(c.candidato)}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {c.votos.toLocaleString("es-CO")}
              </span>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{toTitleCase(c.partido)}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${Math.max((c.votos / max) * 100, 2)}%` }}
              />
            </div>
          </li>
        ))}
      </ol>

      <a
        href={sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-5 inline-block text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
      >
        Fuente: {source} — datos.gov.co
      </a>
    </div>
  );
}
