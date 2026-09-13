"use client";

import * as React from "react";
import {
  Check,
  Copy,
  FlaskConical,
  Newspaper,
  Sparkles,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { colombiaDepartments } from "@/lib/colombia-departments";
import { trendingTopics, getDepartmentMentions } from "@/lib/social-trends-mock";
import {
  TONE_LABEL,
  draftArticle,
  type ArticleDraft,
  type Tone,
} from "@/lib/article-drafts";

const TONES: Tone[] = ["institucional", "cercano", "combativo"];

export default function RedactorPage() {
  const [topicTag, setTopicTag] = React.useState(trendingTopics[0].tag);
  const [city, setCity] = React.useState(colombiaDepartments[0].name);
  const [tone, setTone] = React.useState<Tone>("institucional");
  const [draft, setDraft] = React.useState<ArticleDraft | null>(null);
  const [copied, setCopied] = React.useState(false);

  function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    const topic = trendingTopics.find((t) => t.tag === topicTag) ?? trendingTopics[0];
    const mentions = getDepartmentMentions(topic.mentions)[city] ?? topic.mentions;
    setDraft(draftArticle({ topic, city, mentions, tone }));
    setCopied(false);
  }

  function copyDraft() {
    if (!draft) return;
    const text = [
      draft.headline,
      "",
      draft.lede,
      "",
      ...draft.paragraphs,
      "",
      draft.suggestedTags.join(" "),
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Newspaper className="size-5 text-brand" aria-hidden="true" />
            Redactor
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Propone un borrador de artículo a partir de un tema en tendencia y una ciudad.
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
          <FlaskConical className="size-3" aria-hidden="true" />
          Plantilla — sin IA conectada
        </span>
      </div>

      <p className="mt-2 max-w-2xl rounded-xl border border-dashed border-border bg-surface-muted p-3 text-xs leading-relaxed text-muted-foreground">
        Este borrador se arma con una plantilla local, no con un modelo de IA
        real — el proyecto aún no tiene configurada una clave de API (p. ej.
        <code className="mx-1 rounded bg-background px-1 py-0.5">ANTHROPIC_API_KEY</code>
        ). Conéctala y este mismo formulario puede llamar a un modelo real sin
        cambiar el diseño. Siempre revisa y edita el resultado antes de publicar.
      </p>

      <form
        onSubmit={onGenerate}
        className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:grid-cols-3"
      >
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tema en tendencia</label>
          <select
            value={topicTag}
            onChange={(e) => setTopicTag(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand"
          >
            {trendingTopics.map((t) => (
              <option key={t.tag} value={t.tag}>
                {t.tag}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Ciudad / departamento</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand"
          >
            {colombiaDepartments.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Tono</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-brand"
          >
            {TONES.map((t) => (
              <option key={t} value={t}>
                {TONE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" className="sm:col-span-3">
          <Wand2 className="size-4" aria-hidden="true" />
          Proponer artículo
        </Button>
      </form>

      {draft && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Propuesta de artículo
            </span>
            <Button variant="outline" size="sm" onClick={copyDraft}>
              {copied ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>

          <h2 className="mt-3 text-xl font-semibold tracking-tight">{draft.headline}</h2>
          <p className="mt-3 text-sm italic text-muted-foreground">{draft.lede}</p>
          <div className="mt-3 space-y-3 text-sm leading-relaxed">
            {draft.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {draft.suggestedTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
