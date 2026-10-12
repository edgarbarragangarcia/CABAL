import type { Metadata } from "next";

import { bajaValida } from "@/lib/portales/crm/baja";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Darme de baja", robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string; t?: string; estado?: string }> };

/** Confirmación para dejar de recibir los boletines del portal. Un clic en el correo no te da de baja solo: aquí se confirma. */
export default async function BajaPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const q = await searchParams;
  const valido = !!q.c && !!q.t && /^[0-9a-f-]{36}$/i.test(q.c) && bajaValida(q.c, q.t);
  const caja = "mx-auto w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 text-center shadow-sm";
  return (
    <main className="grid min-h-dvh place-items-center bg-[#f4f5f7] px-5 text-[#1b2430]">
      <div className={caja}>
        {q.estado === "listo" ? (
          <>
            <h1 className="text-2xl font-bold">Listo, ya no recibirás boletines</h1>
            <p className="mt-3 text-sm text-black/60">Te dimos de baja. Si fue un error, puedes volver a sumarte desde el portal cuando quieras.</p>
            <a href={`/p/${slug}`} className="mt-6 inline-flex rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white">Volver al portal</a>
          </>
        ) : q.estado === "error" ? (
          <>
            <h1 className="text-2xl font-bold">No pudimos darte de baja</h1>
            <p className="mt-3 text-sm text-black/60">Intenta de nuevo en unos minutos o escríbenos desde el portal.</p>
          </>
        ) : !valido || q.estado === "invalido" ? (
          <>
            <h1 className="text-2xl font-bold">Este enlace no es válido</h1>
            <p className="mt-3 text-sm text-black/60">Usa el enlace «Darme de baja» que viene al final del correo que recibiste.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">¿Dejar de recibir boletines?</h1>
            <p className="mt-3 text-sm text-black/60">Dejaremos de escribirte desde este portal. Podrás volver a sumarte cuando quieras.</p>
            <form method="post" action={`/api/portales/${slug}/baja`} className="mt-6">
              <input type="hidden" name="c" value={q.c} />
              <input type="hidden" name="t" value={q.t} />
              <button type="submit" className="inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white">Sí, darme de baja</button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
