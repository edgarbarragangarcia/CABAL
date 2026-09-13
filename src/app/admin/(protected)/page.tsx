"use client";

import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  GraduationCap,
  Layers,
  ListChecks,
  Plus,
} from "lucide-react";

import { useLmsCourses } from "@/lib/lms-store";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 py-2 text-sm">
      {ok ? (
        <CheckCircle2 className="size-4 shrink-0 text-brand" aria-hidden="true" />
      ) : (
        <CircleAlert className="size-4 shrink-0 text-accent" aria-hidden="true" />
      )}
      <span className="text-foreground">{label}</span>
    </li>
  );
}

export default function CentroDeControlPage() {
  const { courses, ready } = useLmsCourses();

  const totalModulos = courses.reduce((acc, c) => acc + c.modules.length, 0);
  const totalLecciones = courses.reduce(
    (acc, c) => acc + c.modules.reduce((a, m) => a + m.lessons.length, 0),
    0
  );
  const publicados = courses.filter((c) => c.status === "publicado").length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centro de control</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado del panel y accesos rápidos.
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted"
        >
          Ver el sitio
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Cursos" value={ready ? courses.length : "—"} hint={`${publicados} publicados`} />
        <StatCard label="Módulos" value={ready ? totalModulos : "—"} />
        <StatCard label="Lecciones" value={ready ? totalLecciones : "—"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="size-4 text-brand" aria-hidden="true" />
            Accesos rápidos
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link
              href="/admin/lms"
              className="flex items-center gap-2.5 rounded-xl border border-border p-3 text-sm font-medium transition-colors hover:border-brand hover:bg-brand-soft"
            >
              <GraduationCap className="size-4 text-brand" aria-hidden="true" />
              Gestionar el LMS
            </Link>
            <Link
              href="/admin/lms?nuevo=1"
              className="flex items-center gap-2.5 rounded-xl border border-border p-3 text-sm font-medium transition-colors hover:border-brand hover:bg-brand-soft"
            >
              <Plus className="size-4 text-brand" aria-hidden="true" />
              Crear un curso
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="size-4 text-brand" aria-hidden="true" />
            Estado del sistema
          </h2>
          <ul className="mt-2 divide-y divide-border">
            <StatusRow ok label="Acceso: usuario fijo, sin base de datos" />
            <StatusRow ok={false} label="Base de datos: no configurada" />
            <StatusRow ok label="LMS: guardado local en este navegador" />
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Los cursos que crees aquí solo se guardan en este navegador. Para
            compartirlos entre dispositivos o usuarios, hace falta conectar
            una base de datos real.
          </p>
        </div>
      </div>
    </div>
  );
}
