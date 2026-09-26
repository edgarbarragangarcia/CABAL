import * as React from "react";

/** Markdown mínimo del análisis: títulos, viñetas y párrafos. */
export function Markdown({ texto }: { texto: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {texto.split("\n").map((l, i) => {
        const t = l.trim();
        if (!t) return null;
        const limpio = t.replace(/\*\*(.+?)\*\*/g, "$1");
        if (t.startsWith("#")) return <p key={i} className="pt-2 font-semibold text-foreground">{limpio.replace(/^#+\s*/, "")}</p>;
        if (/^[-*•]\s/.test(t)) return <p key={i} className="pl-4 before:-ml-3 before:mr-1.5 before:content-['•']">{limpio.replace(/^[-*•]\s/, "")}</p>;
        return <p key={i} className="text-muted-foreground">{limpio}</p>;
      })}
    </div>
  );
}
