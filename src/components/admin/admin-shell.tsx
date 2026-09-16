"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/admin", label: "Centro de control", icon: LayoutDashboard },
  { href: "/admin/lms", label: "LMS", icon: GraduationCap },
  { href: "/admin/redactor", label: "Redactor", icon: Newspaper },
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
  const [desktopOpen, setDesktopOpen] = React.useState(true);
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const Nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-soft text-brand"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
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
      {/* Sidebar de escritorio */}
      {desktopOpen && (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-hidden border-r border-border bg-surface p-4 lg:flex">
          <div className="flex items-center justify-between gap-2">
            <Link href="/admin" className="flex min-w-0 items-center gap-2 px-1 py-2">
              <Image
                src="/logo-mark.png"
                alt=""
                width={32}
                height={32}
                className="size-8 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight">Escuela Libertad</p>
                <p className="truncate text-[11px] text-muted-foreground">Panel administrativo</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setDesktopOpen(false)}
              aria-label="Cerrar barra lateral"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <PanelLeftClose className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-6">{Nav}</div>

          <div className="mt-auto space-y-2 border-t border-border pt-4">
            <p className="truncate px-1 text-xs text-muted-foreground">{email}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              disabled={loggingOut}
              className="w-full justify-start"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Cerrar sesión
            </Button>
          </div>
        </aside>
      )}

      {/* Botón para reabrir la barra lateral en escritorio */}
      {!desktopOpen && (
        <button
          type="button"
          onClick={() => setDesktopOpen(true)}
          aria-label="Abrir barra lateral"
          className="fixed left-4 top-4 z-20 hidden size-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-sm hover:text-foreground lg:flex"
        >
          <PanelLeftOpen className="size-4" aria-hidden="true" />
        </button>
      )}

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
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            className="flex size-9 items-center justify-center rounded-full border border-border"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
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
