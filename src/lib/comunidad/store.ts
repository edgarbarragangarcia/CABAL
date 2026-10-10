import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { Registro } from "./esquemas";
import { claveValida, hashClave } from "./sesion";

/** Acceso a datos de la comunidad (afiliados, seguidores, publicaciones, grupos). Solo servidor, con la service role key. */

export type Miembro = {
  id: string;
  usuario: string;
  nombre: string;
  municipio: string;
  departamento: string;
  barrio: string;
  bio: string;
  esOficial: boolean;
};
export type PerfilPublico = Miembro & { seguidores: number; siguiendo: number; yoSigo: boolean };
export type Autor = Pick<Miembro, "id" | "usuario" | "nombre" | "municipio" | "barrio" | "esOficial">;
export type Publicacion = {
  id: string;
  texto: string;
  creadoEn: string;
  autor: Autor;
  grupo: { slug: string; nombre: string } | null;
  meGusta: number;
  yoLeDi: boolean;
  comentarios: number;
};
export type Comentario = { id: string; texto: string; creadoEn: string; autor: Autor };
export type Grupo = { id: string; slug: string; nombre: string; tipo: "municipio" | "barrio"; miembros: number };

export class ErrorComunidad extends Error {}

export const comunidadConfigurada = () => getSupabaseServerClient() !== null;
function db() {
  const c = getSupabaseServerClient();
  if (!c) throw new ErrorComunidad("La comunidad todavía no está conectada a la base de datos.");
  return c;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = Record<string, any>;
const primero = (s: string) => s.trim().split(/\s+/)[0] ?? "";
const nombreCorto = (f: Fila) => `${primero(f.nombres)} ${primero(f.apellidos)}`.trim();
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = (s: string) => sinTildes(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const autorDe = (f: Fila): Autor => ({ id: f.id, usuario: f.usuario, nombre: f.es_oficial ? `${f.nombres} ${f.apellidos}` : nombreCorto(f), municipio: f.municipio, barrio: f.barrio, esOficial: !!f.es_oficial });
const miembroDe = (f: Fila): Miembro => ({ ...autorDe(f), departamento: f.departamento, bio: f.bio ?? "" });
const COLS_AUTOR = "id,usuario,nombres,apellidos,municipio,barrio,es_oficial";
const COLS_MIEMBRO = `${COLS_AUTOR},departamento,bio`;

/* ------------------------------------------------------------------ cuentas */

export async function registrarMiembro(d: Registro): Promise<Miembro> {
  const c = db();
  if (!/^[a-z0-9._%+@-]+$/.test(d.email) || !/^\d+$/.test(d.cedula)) throw new ErrorComunidad("Datos no válidos.");
  const { data: repetido } = await c.from("miembros").select("id").or(`cedula.eq.${d.cedula},email.eq.${d.email}`).limit(1);
  if (repetido?.length) throw new ErrorComunidad("Ya existe una afiliación con esa cédula o ese correo. Inicia sesión.");

  const base = slug(`${primero(d.nombres)}${primero(d.apellidos)}`).replace(/-/g, "").slice(0, 24) || "afiliado";
  const { data: usados } = await c.from("miembros").select("usuario").like("usuario", `${base}%`);
  const tomados = new Set((usados ?? []).map((u: Fila) => u.usuario));
  let usuario = base;
  for (let n = 2; tomados.has(usuario); n++) usuario = `${base}${n}`;

  const { data, error } = await c
    .from("miembros")
    .insert({
      usuario,
      cedula: d.cedula,
      nombres: d.nombres,
      apellidos: d.apellidos,
      fecha_nacimiento: d.fechaNacimiento,
      email: d.email,
      telefono: d.telefono,
      departamento: d.departamento,
      municipio: d.municipio,
      barrio: d.barrio,
      direccion: d.direccion,
      password_hash: hashClave(d.password),
      consentimiento_en: new Date().toISOString(),
    })
    .select(COLS_MIEMBRO)
    .single();
  if (error) throw new ErrorComunidad(error.code === "23505" ? "Ya existe una afiliación con esos datos." : "No fue posible completar la afiliación.");
  const m = miembroDe(data);

  // Grupos de su municipio y de su barrio, y la cuenta oficial para que su muro nunca empiece vacío.
  const lugares = [
    { slug: `municipio-${slug(d.municipio)}`, nombre: d.municipio, tipo: "municipio" },
    { slug: `barrio-${slug(d.municipio)}-${slug(d.barrio)}`, nombre: `${d.barrio} · ${d.municipio}`, tipo: "barrio" },
  ];
  const { data: grupos } = await c.from("grupos").upsert(lugares, { onConflict: "slug" }).select("id");
  if (grupos?.length) await c.from("grupo_miembros").upsert(grupos.map((g: Fila) => ({ grupo_id: g.id, miembro_id: m.id })));
  const { data: oficial } = await c.from("miembros").select("id").eq("es_oficial", true).limit(1).maybeSingle();
  if (oficial) await c.from("seguidores").upsert({ seguidor_id: m.id, seguido_id: oficial.id });
  return m;
}

export async function autenticar(acceso: string, clave: string): Promise<Miembro | null> {
  const c = db();
  const a = acceso.trim().toLowerCase().replace(/^@/, "");
  // Va dentro de un filtro `.or()`: nada de comas ni paréntesis que alteren la consulta.
  if (!/^[a-z0-9._%+@-]{3,120}$/.test(a)) return null;
  const { data } = await c.from("miembros").select(`${COLS_MIEMBRO},password_hash`).or(`email.eq.${a},usuario.eq.${a}`).eq("es_oficial", false).limit(1).maybeSingle();
  // Se calcula el hash aunque no exista la cuenta, para no delatar qué correos están registrados por el tiempo de respuesta.
  const ok = claveValida(clave, data?.password_hash ?? "scrypt$AAAA$AAAA");
  return data && ok ? miembroDe(data) : null;
}

export async function miembroPorId(id: string): Promise<Miembro | null> {
  const { data } = await db().from("miembros").select(COLS_MIEMBRO).eq("id", id).maybeSingle();
  return data ? miembroDe(data) : null;
}

export async function perfilDe(usuario: string, viewerId: string): Promise<PerfilPublico | null> {
  const c = db();
  const { data } = await c.from("miembros").select(COLS_MIEMBRO).eq("usuario", usuario.toLowerCase()).maybeSingle();
  if (!data) return null;
  const [a, b, yo] = await Promise.all([
    c.from("seguidores").select("*", { count: "exact", head: true }).eq("seguido_id", data.id),
    c.from("seguidores").select("*", { count: "exact", head: true }).eq("seguidor_id", data.id),
    c.from("seguidores").select("seguidor_id").eq("seguidor_id", viewerId).eq("seguido_id", data.id).maybeSingle(),
  ]);
  return { ...miembroDe(data), seguidores: a.count ?? 0, siguiendo: b.count ?? 0, yoSigo: !!yo.data };
}

export async function guardarBio(id: string, bio: string) {
  await db().from("miembros").update({ bio }).eq("id", id);
}

/* ------------------------------------------------------------------- seguir */

export async function seguir(yo: string, otro: string, activar: boolean) {
  const c = db();
  if (yo === otro) throw new ErrorComunidad("No puedes seguirte a ti mismo.");
  if (activar) await c.from("seguidores").upsert({ seguidor_id: yo, seguido_id: otro });
  else await c.from("seguidores").delete().eq("seguidor_id", yo).eq("seguido_id", otro);
}

/** A quién seguir: primero gente de su municipio y barrio, luego el resto. */
export async function sugerencias(yo: Miembro, limite = 6): Promise<Autor[]> {
  const c = db();
  const { data: sigo } = await c.from("seguidores").select("seguido_id").eq("seguidor_id", yo.id);
  const excluir = new Set([yo.id, ...(sigo ?? []).map((s: Fila) => s.seguido_id)]);
  const { data } = await c.from("miembros").select(COLS_AUTOR).eq("es_oficial", false).order("creado_en", { ascending: false }).limit(80);
  const puntaje = (f: Fila) => (f.barrio === yo.barrio && f.municipio === yo.municipio ? 2 : f.municipio === yo.municipio ? 1 : 0);
  return (data ?? []).filter((f: Fila) => !excluir.has(f.id)).sort((a: Fila, b: Fila) => puntaje(b) - puntaje(a)).slice(0, limite).map(autorDe);
}

/* ------------------------------------------------------------------- grupos */

export async function misGrupos(yo: string): Promise<Grupo[]> {
  const c = db();
  const { data } = await c.from("grupo_miembros").select("grupo:grupos!grupo_id(id,slug,nombre,tipo)").eq("miembro_id", yo);
  const grupos = (data ?? []).map((r: Fila) => r.grupo).filter(Boolean) as Fila[];
  if (!grupos.length) return [];
  const { data: filas } = await c.from("grupo_miembros").select("grupo_id").in("grupo_id", grupos.map((g) => g.id));
  const cuenta = new Map<string, number>();
  for (const f of filas ?? []) cuenta.set(f.grupo_id, (cuenta.get(f.grupo_id) ?? 0) + 1);
  return grupos.map((g) => ({ id: g.id, slug: g.slug, nombre: g.nombre, tipo: g.tipo, miembros: cuenta.get(g.id) ?? 0 })).sort((a, b) => (a.tipo === "barrio" ? -1 : 1) - (b.tipo === "barrio" ? -1 : 1));
}

/* ----------------------------------------------------------------- muro */

export type Ambito = "seguidos" | "todos" | `grupo:${string}` | `perfil:${string}`;

export async function feed(yo: string, ambito: Ambito, antes?: string, limite = 15): Promise<Publicacion[]> {
  const c = db();
  let q = c
    .from("publicaciones")
    .select(`id,texto,creado_en,autor:miembros!autor_id(${COLS_AUTOR}),grupo:grupos!grupo_id(slug,nombre)`)
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (antes) q = q.lt("creado_en", antes);

  if (ambito === "seguidos") {
    const [{ data: sigo }, { data: oficial }] = await Promise.all([
      c.from("seguidores").select("seguido_id").eq("seguidor_id", yo),
      c.from("miembros").select("id").eq("es_oficial", true),
    ]);
    q = q.in("autor_id", [yo, ...(sigo ?? []).map((s: Fila) => s.seguido_id), ...(oficial ?? []).map((o: Fila) => o.id)]);
  } else if (ambito.startsWith("grupo:")) {
    const { data: g } = await c.from("grupos").select("id").eq("slug", ambito.slice(6)).maybeSingle();
    if (!g) return [];
    q = q.eq("grupo_id", g.id);
  } else if (ambito.startsWith("perfil:")) {
    const { data: p } = await c.from("miembros").select("id").eq("usuario", ambito.slice(7)).maybeSingle();
    if (!p) return [];
    q = q.eq("autor_id", p.id);
  }

  const { data, error } = await q;
  if (error) throw new ErrorComunidad("No fue posible cargar las publicaciones.");
  const filas = (data ?? []) as Fila[];
  if (!filas.length) return [];
  const ids = filas.map((f) => f.id);
  const [likes, coms] = await Promise.all([
    c.from("me_gusta").select("publicacion_id,miembro_id").in("publicacion_id", ids),
    c.from("comentarios").select("publicacion_id").in("publicacion_id", ids),
  ]);
  return filas.map((f) => ({
    id: f.id,
    texto: f.texto,
    creadoEn: f.creado_en,
    autor: autorDe(f.autor),
    grupo: f.grupo ? { slug: f.grupo.slug, nombre: f.grupo.nombre } : null,
    meGusta: (likes.data ?? []).filter((l: Fila) => l.publicacion_id === f.id).length,
    yoLeDi: (likes.data ?? []).some((l: Fila) => l.publicacion_id === f.id && l.miembro_id === yo),
    comentarios: (coms.data ?? []).filter((x: Fila) => x.publicacion_id === f.id).length,
  }));
}

export async function publicar(autorId: string, texto: string, grupoSlug?: string) {
  const c = db();
  let grupo_id: string | null = null;
  if (grupoSlug) {
    const { data: g } = await c.from("grupos").select("id").eq("slug", grupoSlug).maybeSingle();
    const { data: soy } = g ? await c.from("grupo_miembros").select("miembro_id").eq("grupo_id", g.id).eq("miembro_id", autorId).maybeSingle() : { data: null };
    if (!g || !soy) throw new ErrorComunidad("Solo puedes publicar en los grupos a los que perteneces.");
    grupo_id = g.id;
  }
  const { error } = await c.from("publicaciones").insert({ autor_id: autorId, grupo_id, texto });
  if (error) throw new ErrorComunidad("No fue posible publicar.");
}

export async function alternarMeGusta(yo: string, publicacionId: string) {
  const c = db();
  const { data } = await c.from("me_gusta").select("miembro_id").eq("publicacion_id", publicacionId).eq("miembro_id", yo).maybeSingle();
  if (data) await c.from("me_gusta").delete().eq("publicacion_id", publicacionId).eq("miembro_id", yo);
  else await c.from("me_gusta").insert({ publicacion_id: publicacionId, miembro_id: yo });
  return !data;
}

export async function comentarios(publicacionId: string): Promise<Comentario[]> {
  const { data } = await db().from("comentarios").select(`id,texto,creado_en,autor:miembros!autor_id(${COLS_AUTOR})`).eq("publicacion_id", publicacionId).order("creado_en").limit(100);
  return (data ?? []).map((f: Fila) => ({ id: f.id, texto: f.texto, creadoEn: f.creado_en, autor: autorDe(f.autor) }));
}

export async function comentar(yo: string, publicacionId: string, texto: string) {
  const { error } = await db().from("comentarios").insert({ publicacion_id: publicacionId, autor_id: yo, texto });
  if (error) throw new ErrorComunidad("No fue posible comentar.");
}

/** Para el panel administrativo: la cuenta oficial publica desde allí. */
export async function publicarComoOficial(texto: string) {
  const { data } = await db().from("miembros").select("id").eq("es_oficial", true).limit(1).maybeSingle();
  if (!data) throw new ErrorComunidad("Falta la cuenta oficial: ejecuta supabase/comunidad.sql.");
  await publicar(data.id, texto);
}

export async function totalAfiliados() {
  const { count } = await db().from("miembros").select("*", { count: "exact", head: true }).eq("es_oficial", false);
  return count ?? 0;
}
