"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, GraduationCap, LayoutDashboard, LogOut, Menu, Newspaper, Settings, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const NAV = [
  { href: "/admin", label: "Centro de control", icon: LayoutDashboard },
  { href: "/admin/analisis-publicaciones", label: "Análisis", icon: BarChart3 },
  { href: "/admin/lms", label: "LMS", icon: GraduationCap },
  { href: "/admin/redactor", label: "Redactor", icon: Newspaper },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const Nav = (
    <nav className="flex flex-1 flex-col gap-2">
      {NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-full border-2 px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active
                ? "border-brand bg-brand-soft text-brand shadow-sm"
                : "border-brand/25 bg-brand-soft/50 text-brand/80 hover:border-brand hover:bg-brand-soft hover:text-brand"
            )}
          >
            <Icon className="size-4.5 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-surface-muted">
      {/* Reserva el ancho colapsado en el flujo; el <aside> real va fixed y
          se expande por encima del contenido (no lo empuja) al pasar el
          cursor. */}
      <div className="hidden w-[76px] shrink-0 lg:block" aria-hidden="true" />

      {/* Sidebar de escritorio: colapsado (solo íconos) por defecto, se
          despliega al pasar el cursor. */}
      <aside className="group/sidebar fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col overflow-hidden border-r border-border bg-surface p-4 transition-[width] duration-200 ease-out hover:w-64 lg:flex">
        <Link href="/admin" className="flex items-center gap-2 px-1 py-2">
          <Image
            src="/logo-mark.png"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 object-contain"
          />
          <div className="min-w-0 whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
            <p className="text-sm font-semibold leading-tight">Escuela Libertad</p>
            <p className="text-[11px] text-muted-foreground">Panel administrativo</p>
          </div>
        </Link>

        {/* Siempre visible (no depende del hover): el admin no tiene otra
            forma de ver/cambiar el tema, a diferencia del sitio público. */}
        <div className="mt-2">
          <ThemeToggle />
        </div>

        <div className="mt-4">
          <nav className="flex flex-1 flex-col gap-2">
            {NAV.map((item) => {
              const active =
                item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 whitespace-nowrap rounded-full border-2 px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "border-brand bg-brand-soft text-brand shadow-sm"
                      : "border-brand/25 bg-brand-soft/50 text-brand/80 hover:border-brand hover:bg-brand-soft hover:text-brand"
                  )}
                >
                  <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                  <span className="opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto space-y-2 whitespace-nowrap border-t border-border pt-4">
          <p className="truncate px-1 text-xs text-muted-foreground opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
            {email}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            disabled={loggingOut}
            className="w-full justify-start"
          >
            <LogOut className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
              Cerrar sesión
            </span>
          </Button>
        </div>
      </aside>

      {/* Barra móvil */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
          <Link href="/admin" className="flex items-center gap-2">
            <Image
              src="/logo-mark.png"
              alt=""
              width={28}
              height={28}
              className="size-7 shrink-0 object-contain"
            />
            <p className="text-sm font-semibold">Panel administrativo</p>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              className="flex size-9 items-center justify-center rounded-full border border-border"
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </header>

        {mobileOpen && (
          <div className="border-b border-border bg-surface p-4 lg:hidden">
            {Nav}
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              disabled={loggingOut}
              className="mt-3 w-full justify-start"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Cerrar sesión
            </Button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
