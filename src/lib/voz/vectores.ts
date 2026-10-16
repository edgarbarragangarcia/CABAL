import "server-only";

import { dividirEnFragmentos } from "@/lib/documentos/fragmentos";
import { LOTE_VECTORES, proveedorDeVectores, proveedorDelModelo, vectorizar } from "@/lib/documentos/vectores";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Los textos de la voz de la Dra. como vectores en Supabase: se dividen en fragmentos, cada uno se vectoriza y, al redactar, se buscan
 * por significado los pasajes suyos más parecidos al tema. Es lo que permite que el Redactor «lea» todo lo cargado, por largo que sea,
 * y no solo una muestra: de cada tema trae sus propias palabras sobre ese tema.
 */

const db = () => getSupabaseServerClient();
const falta = (e: { message?: string }) => /voz_fragmentos|buscar_voz|guardar_voz|schema cache|does not exist/i.test(e.message ?? "");

/** Divide el texto en fragmentos y los guarda sin vector todavía (el vector lo agrega `vectorizarPendientes`). */
export async function guardarFragmentosVoz(corpusId: string, contenido: string): Promise<number> {
  const c = db();
  if (!c) return 0;
  const fr = dividirEnFragmentos([{ numero: null, texto: contenido }]);
  await c.from("voz_fragmentos").delete().eq("corpus_id", corpusId);
  for (let i = 0; i < fr.length; i += 100) {
    const { error } = await c.from("voz_fragmentos").insert(fr.slice(i, i + 100).map((f) => ({ corpus_id: corpusId, posicion: f.posicion, contenido: f.contenido, caracteres: f.contenido.length })));
    if (error) {
      if (falta(error)) return 0;
      throw new Error(error.message);
    }
  }
  return fr.length;
}

export type EstadoVectoresVoz = { disponible: boolean; total: number; vectorizados: number; pendientes: number; modelo: string | null; hayClave: boolean };

export async function estadoVectoresVoz(): Promise<EstadoVectoresVoz> {
  const c = db();
  const vacio: EstadoVectoresVoz = { disponible: false, total: 0, vectorizados: 0, pendientes: 0, modelo: null, hayClave: false };
  if (!c) return vacio;
  const [t, p, m, prov] = await Promise.all([
    c.from("voz_fragmentos").select("id", { count: "exact", head: true }),
    c.from("voz_fragmentos").select("id", { count: "exact", head: true }).is("embedding", null),
    c.from("voz_fragmentos").select("modelo").not("embedding", "is", null).limit(1),
    proveedorDeVectores(),
  ]);
  if (t.error) return vacio;
  const total = t.count ?? 0;
  const pendientes = p.count ?? 0;
  return { disponible: true, total, pendientes, vectorizados: total - pendientes, modelo: (m.data?.[0] as { modelo?: string } | undefined)?.modelo ?? prov?.modelo ?? null, hayClave: !!prov };
}

/** Vectoriza fragmentos pendientes mientras alcance el tiempo (una función de Vercel dura un minuto). */
export async function vectorizarPendientes(presupuestoMs = 36_000): Promise<EstadoVectoresVoz & { error?: string }> {
  const c = db();
  const limite = Date.now() + presupuestoMs;
  const prov = await proveedorDeVectores();
  if (!c) return { ...(await estadoVectoresVoz()), error: "Falta conectar Supabase." };
  if (!prov) return { ...(await estadoVectoresVoz()), error: "Falta una clave de Gemini u OpenAI en Configuración para vectorizar (Claude no genera vectores)." };
  try {
    // Los textos cargados antes de que existieran los vectores todavía no tienen fragmentos: se dividen ahora.
    const { data: corpus } = await c.from("voz_corpus").select("id, contenido").limit(1000);
    const { data: conFr } = await c.from("voz_fragmentos").select("corpus_id").eq("posicion", 0).limit(5000);
    const tienen = new Set(((conFr ?? []) as { corpus_id: string }[]).map((f) => f.corpus_id));
    for (const t of ((corpus ?? []) as { id: string; contenido: string }[]).filter((x) => !tienen.has(x.id)).slice(0, 25)) await guardarFragmentosVoz(t.id, t.contenido);
    while (Date.now() < limite) {
      const { data, error } = await c.from("voz_fragmentos").select("id, contenido").is("embedding", null).order("id").limit(LOTE_VECTORES[prov.proveedor]);
      if (error) throw new Error(error.message);
      const filas = (data ?? []) as { id: number; contenido: string }[];
      if (!filas.length) break;
      const v = await vectorizar(filas.map((f) => f.contenido), "documento", prov);
      const r = await c.rpc("guardar_voz_vectores", { p_filas: filas.map((f, i) => ({ id: f.id, embedding: v[i], modelo: prov.modelo })) });
      if (r.error) throw new Error(r.error.message);
    }
    return await estadoVectoresVoz();
  } catch (e) {
    return { ...(await estadoVectoresVoz()), error: e instanceof Error ? e.message : "No se pudo vectorizar." };
  }
}

export type Pasaje = { fuente: string; texto: string; similitud: number };

/** Los pasajes suyos más parecidos a la consulta: primero los del mismo formato (trinos, discursos…) y después de cualquiera. */
export async function pasajesParecidos(consulta: string, formato: string | null, presupuesto = 12_000): Promise<Pasaje[] | null> {
  const c = db();
  if (!c || consulta.trim().length < 5) return null;
  const { data: m } = await c.from("voz_fragmentos").select("modelo").not("embedding", "is", null).limit(1);
  const modelo = (m?.[0] as { modelo?: string } | undefined)?.modelo;
  if (!modelo) return null;
  const prov = await proveedorDelModelo(modelo);
  if (!prov) return null;
  const [vec] = await vectorizar([consulta.slice(0, 1500)], "consulta", prov);
  const buscar = async (f: string | null, n: number) => {
    const { data, error } = await c.rpc("buscar_voz_fragmentos", { p_consulta: vec, p_modelo: modelo, p_cantidad: n, p_formato: f });
    return error ? [] : ((data ?? []) as { titulo: string; contenido: string; similitud: number }[]);
  };
  const [propios, todos] = await Promise.all([formato && formato !== "general" ? buscar(formato, 12) : Promise.resolve([]), buscar(null, 24)]);
  const vistos = new Set<string>();
  const salida: Pasaje[] = [];
  let usados = 0;
  for (const f of [...propios, ...todos]) {
    if (vistos.has(f.contenido) || usados + f.contenido.length > presupuesto) continue;
    vistos.add(f.contenido);
    salida.push({ fuente: f.titulo, texto: f.contenido, similitud: Number(f.similitud) });
    usados += f.contenido.length;
  }
  return salida.length ? salida : null;
}
