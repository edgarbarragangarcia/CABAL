import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_EMAIL, rutaPermitida, SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import { usuarioActivo } from "@/lib/admin-usuarios";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  // El middleware ya protege /admin/*; esta comprobación es una segunda
  // capa por si el layout se renderiza sin pasar por él.
  if (!session) redirect("/admin/login");
  // Un usuario dado de alta que se desactivó o se eliminó pierde el acceso aunque su cookie siga vigente.
  if (session.email !== ADMIN_EMAIL && !(await usuarioActivo(session.email))) redirect("/admin/login");

  const todas = ["analisis-publicaciones", "fuente-de-la-verdad", "lms", "redactor", "comunidad", "portales", "configuracion"];
  const secciones = session.rol ? todas.filter((s) => rutaPermitida(session.rol, `/admin/${s}`)).map((s) => `/admin/${s}`) : undefined;
  return <AdminShell email={session.email} secciones={secciones}>{children}</AdminShell>;
}
