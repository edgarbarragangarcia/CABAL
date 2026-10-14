"use client";

import * as React from "react";
import { UserPlus, Users } from "lucide-react";

import { usePeticion } from "../analisis-publicaciones/peticion";

type Usuario = { email: string; nombre: string; activo: boolean; creado_en: string; ultimo_ingreso: string | null };
type Respuesta = { disponible: boolean; sql?: string; error?: string; principal: string; usuarios: Usuario[] };

const campo = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm";

/** Alta de usuarios del panel: solo la ve (y la usa) el administrador principal. */
export function UsuariosPanel() {
  const [v, setV] = React.useState(0);
  const lectura = usePeticion<Respuesta>(`/api/admin/usuarios?v=${v}`);
  const [f, setF] = React.useState({ nombre: "", email: "", clave: "" });
  const [msg, setMsg] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = React.useState(false);

  const llamar = async (init: RequestInit, url = "/api/admin/usuarios") => {
    setOcupado(true);
    try {
      const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "No se pudo completar.");
      setV((n) => n + 1);
      return true;
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof Error ? e.message : "No se pudo completar." });
      return false;
    } finally {
      setOcupado(false);
    }
  };

  // Un usuario que no es el principal recibe 403: la sección no aplica y no se muestra.
  if (lectura.estado === "error") return null;
  if (lectura.estado === "cargando") return null;
  const d = lectura.data;

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Users className="size-4 text-brand" aria-hidden="true" />Usuarios del panel</h2>
      <p className="mt-1 text-sm text-muted-foreground">Da de alta a quien deba entrar al panel: cada persona entra con su propio correo y clave. Tú ({d.principal}) eres el administrador principal.</p>

      {!d.disponible ? (
        <div className="mt-4 rounded-xl bg-amber-500/10 p-3 text-sm">
          <p className="font-semibold">{d.error ?? "Falta crear la tabla de usuarios en Supabase."}</p>
          {d.sql && (
            <>
              <p className="mt-1 text-muted-foreground">Copia este SQL y pégalo en Supabase › SQL Editor › Run; luego recarga.</p>
              <textarea readOnly value={d.sql} rows={8} className={`${campo} mt-2 font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
            </>
          )}
        </div>
      ) : (
        <>
          <form
            className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg(null);
              if (await llamar({ method: "POST", body: JSON.stringify(f) })) {
                setMsg({ ok: true, texto: `Usuario ${f.email.trim().toLowerCase()} dado de alta.` });
                setF({ nombre: "", email: "", clave: "" });
              }
            }}
          >
            <input className={campo} placeholder="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} maxLength={120} />
            <input className={campo} type="email" required placeholder="correo@ejemplo.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input className={campo} type="password" required minLength={8} autoComplete="new-password" placeholder="Clave (mín. 8)" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} />
            <button type="submit" disabled={ocupado} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"><UserPlus className="size-4" aria-hidden="true" />Dar de alta</button>
          </form>
          {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.texto}</p>}

          <ul className="mt-4 divide-y divide-border">
            {d.usuarios.length === 0 && <li className="py-3 text-sm text-muted-foreground">Todavía no hay usuarios además del principal.</li>}
            {d.usuarios.map((u) => (
              <li key={u.email} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{u.nombre || u.email}{!u.activo && <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[11px]">desactivado</span>}</p>
                  <p className="text-xs text-muted-foreground">{u.email} · {u.ultimo_ingreso ? `último ingreso ${new Date(u.ultimo_ingreso).toLocaleString("es-CO")}` : "aún no ha ingresado"}</p>
                </div>
                <button type="button" disabled={ocupado} onClick={() => void llamar({ method: "PATCH", body: JSON.stringify({ email: u.email, activo: !u.activo }) })} className="rounded-full border border-border px-3 py-1 text-xs font-semibold">{u.activo ? "Desactivar" : "Activar"}</button>
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => {
                    const clave = window.prompt(`Nueva clave para ${u.email} (mín. 8 caracteres):`);
                    if (clave) void llamar({ method: "PATCH", body: JSON.stringify({ email: u.email, clave }) }).then((ok) => ok && setMsg({ ok: true, texto: "Clave cambiada." }));
                  }}
                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
                >Cambiar clave</button>
                <button type="button" disabled={ocupado} onClick={() => window.confirm(`¿Eliminar a ${u.email}?`) && void llamar({ method: "DELETE" }, `/api/admin/usuarios?email=${encodeURIComponent(u.email)}`)} className="rounded-full border border-red-500/40 px-3 py-1 text-xs font-semibold text-red-700">Eliminar</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
