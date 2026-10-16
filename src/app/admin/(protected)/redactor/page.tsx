import { Newspaper, PenLine } from "lucide-react";

import { ChipPortada, Lienzo, Portada } from "@/components/admin/estilo-cabal";

import { RedactorWizard } from "./redactor-wizard";

export default function RedactorPage() {
  return (
    <div className="w-full">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Newspaper className="size-5 text-brand" aria-hidden="true" />
        Redactor
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Escribe una nota en nueve pasos, con IA a partir de tu material o a mano. La IA nunca publica.</p>
      <Lienzo className="mt-6">
        <Portada icono={PenLine} etiqueta="Borradores" titulo="Redacta con rigor" descripcion="Das el tema y el material; la IA arma un borrador que revisas y corriges. Sin material no se redacta, las cifras y las citas se comprueban con el programa y todo sale como borrador.">
          <ChipPortada icono={PenLine}>Cero invención: solo lo que consta en tu material</ChipPortada>
        </Portada>
        <RedactorWizard />
      </Lienzo>
    </div>
  );
}
