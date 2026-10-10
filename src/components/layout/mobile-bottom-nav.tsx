"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HandHeart, Home, LayoutGrid, Users, X } from "lucide-react";

import { mainNav } from "@/config/site";
import { MafeAvatar } from "@/components/mafe/mafe-avatar";
import { cn } from "@/lib/utils";

/**
 * Barra inferior tipo app para el celular: Inicio, Secciones, MaFe al centro (abre el chat), Únete y Donar.
 * En pantallas medianas y grandes se usa la barra superior de siempre.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const [secciones, setSecciones] = React.useState(false);
  React.useEffect(() => setSecciones(false), [pathname]);

  const activo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const item = (href: string, texto: string, Icono: typeof Home) => (
    <li key={href}>
      <Link href={href} aria-current={activo(href) ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", activo(href) ? "text-brand" : "text-muted-foreground")}>
        <Icono className="size-6" aria-hidden="true" />
        {texto}
      </Link>
    </li>
  );

  return (
    <>
      {secciones && (
        <div className="fixed inset-0 z-[55] md:hidden" role="dialog" aria-label="Secciones">
          <button type="button" aria-label="Cerrar" onClick={() => setSecciones(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-3xl bg-surface p-5 pb-28 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-xl font-semibold">Secciones</p>
              <button type="button" onClick={() => setSecciones(false)} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full bg-surface-muted"><X className="size-5" /></button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {mainNav.flatMap((n) => (n.children ? n.children.map((c) => ({ label: c.label, href: c.href })) : [{ label: n.label, href: n.href }])).map((n) => (
                <li key={n.href}><Link href={n.href} className="block rounded-2xl bg-surface-muted px-4 py-3.5 text-sm font-semibold active:scale-[0.98]">{n.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
          {item("/", "Inicio", Home)}
          <li>
            <button type="button" onClick={() => setSecciones((v) => !v)} aria-expanded={secciones} className={cn("flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium", secciones ? "text-brand" : "text-muted-foreground")}>
              <LayoutGrid className="size-6" aria-hidden="true" />
              Secciones
            </button>
          </li>
          <li className="grid place-items-center pb-1.5">
            <button type="button" onClick={() => window.dispatchEvent(new Event("mafe:abrir"))} aria-label="Hablar con MaFe, la asistente" className="-mt-7 grid size-16 place-items-center rounded-full bg-surface shadow-lg ring-4 ring-surface">
              <span className="grid size-14 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#0a4f37] to-[#1f9d6c] ring-2 ring-amber-400"><MafeAvatar className="size-12" /></span>
            </button>
            <span className="text-[11px] font-medium text-muted-foreground">MaFe</span>
          </li>
          {item("/unete", "Únete", Users)}
          {item("/donar", "Donar", HandHeart)}
        </ul>
      </nav>
    </>
  );
}
