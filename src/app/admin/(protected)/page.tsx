import { redirect } from "next/navigation";

/** El Centro de control vive ahora como una pestaña de Análisis. */
export default function AdminInicio() {
  redirect("/admin/analisis-publicaciones");
}
