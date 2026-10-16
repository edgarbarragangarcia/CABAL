import { Newspaper } from "lucide-react";

import { Lienzo } from "@/components/admin/estilo-cabal";

import { RedactorWizard } from "./redactor-wizard";

export default function RedactorPage() {
  return (
    <div className="w-full">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Newspaper className="size-5 text-brand" aria-hidden="true" />
        Redactor
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Escribe una nota con IA a partir de tu material o a mano. La IA nunca publica.</p>
      <Lienzo className="mt-4">
        <RedactorWizard />
      </Lienzo>
    </div>
  );
}
