"use client";

import { Muro } from "../../ui";

export function MuroPerfil({ usuario }: { usuario: string }) {
  return <Muro ambito={`perfil:${usuario}`} refresco={0} />;
}
