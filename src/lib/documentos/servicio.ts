import "server-only";

import {
  actualizarDocumento,
  buscarFragmentos,
  contarSinVector,
  fragmentosSinVector,
  guardarFragmentos,
  guardarOriginal,
  guardarVectores,
  juntarPartes,
  listarDocumentos,
  obtenerDocumento,
  type Documento,
  type Hallazgo,
} from "./almacen";
import { MAX_BYTES, extensionDe, extraerTexto } from "./extraer";
import { dividirEnFragmentos } from "./fragmentos";
import { LOTE_VECTORES, proveedorDeVectores, proveedorDelModelo, vectorizar, type ProveedorVectores } from "./vectores";

/** Tamaño de cada parte con la que el navegador sube un archivo: Vercel no admite más de 4,5 MB por petición. */
export const TAM_PARTE = 3.5 * 1024 * 1024;
export const MAX_PARTES = Math.ceil(MAX_BYTES / TAM_PARTE) + 1;

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "Error inesperado.");

/**
 * Con el archivo ya subido (por partes): lo junta, saca el texto, lo divide en fragmentos y los guarda sin vector todavía. Si algo
 * falla, el documento queda en estado «error» con el motivo (y se vuelve a subir).
 */
export async function procesarDocumento(id: string, partes: number): Promise<Documento> {
  const doc = await obtenerDocumento(id);
  if (!doc) throw new Error("Ese documento no existe.");
  try {
    const archivo = await juntarPartes(id, partes);
    if (archivo.length > MAX_BYTES) throw new Error(`El archivo pesa más de ${MAX_BYTES / 1024 / 1024} MB.`);
    const nombre = doc.archivo ?? doc.titulo;
    const { paginas, totalPaginas, caracteres } = await extraerTexto(archivo, nombre);
    const fragmentos = dividirEnFragmentos(paginas);
    if (fragmentos.length === 0) throw new Error("El archivo no tiene texto que se pueda dividir en fragmentos.");
    await guardarFragmentos(id, fragmentos);
    const ruta = await guardarOriginal(id, nombre, archivo, partes);
    await actualizarDocumento(id, {
      estado: "procesando",
      tipo: extensionDe(nombre) || doc.tipo,
      paginas: totalPaginas,
      caracteres,
      fragmentos: fragmentos.length,
      vectorizados: 0,
      ruta,
      error: null,
    });
    return (await obtenerDocumento(id))!;
  } catch (e) {
    await actualizarDocumento(id, { estado: "error", error: mensaje(e) }).catch(() => {});
    throw e;
  }
}

export type AvanceVectores = { fragmentos: number; vectorizados: number; pendientes: number; listo: boolean; modelo: string };

/** Qué proveedor usar para este documento: el modelo con el que ya se empezó, o el de la clave que haya en Configuración. */
async function proveedorPara(doc: Documento): Promise<ProveedorVectores> {
  const p = doc.modelo ? await proveedorDelModelo(doc.modelo) : await proveedorDeVectores();
  if (p) return p;
  throw new Error(
    doc.modelo
      ? `Este documento se vectorizó con ${doc.modelo}: agrega esa clave en Configuración para seguir.`
      : "Para vectorizar hace falta una clave de Gemini u OpenAI en Configuración (Claude no ofrece vectores)."
  );
}

/**
 * Vectoriza los fragmentos que faltan, por lotes y de a tres a la vez, mientras alcance el tiempo (cabe en una función de Vercel). El
 * navegador repite la llamada hasta que `listo`; lo ya vectorizado se salta, así que se puede seguir cuando sea.
 */
export async function vectorizarPendientes(id: string, presupuestoMs = 38_000): Promise<AvanceVectores> {
  const doc = await obtenerDocumento(id);
  if (!doc) throw new Error("Ese documento no existe.");
  let proveedor: ProveedorVectores;
  try {
    proveedor = await proveedorPara(doc);
  } catch (e) {
    // Sin clave: el motivo queda anotado en el documento para que la lista lo explique y se pueda seguir cuando se agregue.
    await actualizarDocumento(id, { error: mensaje(e) }).catch(() => {});
    throw e;
  }
  const lote = LOTE_VECTORES[proveedor.proveedor];
  const limite = Date.now() + presupuestoMs;
  // La clave no se vuelve a leer: el proveedor ya la trae, y esta función corre mientras la petición sigue viva.
  try {
    while (Date.now() < limite) {
      const pendientes = await fragmentosSinVector(id, lote * 3);
      if (pendientes.length === 0) break;
      const lotes: typeof pendientes[] = [];
      for (let i = 0; i < pendientes.length; i += lote) lotes.push(pendientes.slice(i, i + lote));
      await Promise.all(
        lotes.map(async (fragmentos) => {
          const vectores = await vectorizar(fragmentos.map((f) => f.contenido), "documento", proveedor);
          await guardarVectores(fragmentos.map((f, i) => ({ id: f.id, embedding: vectores[i], modelo: proveedor.modelo })));
        })
      );
    }
  } catch (e) {
    // Lo guardado hasta aquí queda; el motivo se anota para que se vea y se pueda seguir después.
    const faltan = await contarSinVector(id).catch(() => doc.fragmentos - doc.vectorizados);
    await actualizarDocumento(id, { modelo: proveedor.modelo, vectorizados: Math.max(0, doc.fragmentos - faltan), error: mensaje(e) }).catch(() => {});
    throw e;
  }
  const pendientes = await contarSinVector(id);
  const vectorizados = Math.max(0, doc.fragmentos - pendientes);
  const listo = pendientes === 0;
  await actualizarDocumento(id, { modelo: proveedor.modelo, vectorizados, estado: listo ? "listo" : "procesando", error: null });
  return { fragmentos: doc.fragmentos, vectorizados, pendientes, listo, modelo: proveedor.modelo };
}

export type ResultadoBusqueda = { resultados: Hallazgo[]; avisos: string[] };

/**
 * Busca por significado: vectoriza la consulta con el mismo modelo de cada documento (si hubo más de uno) y junta los fragmentos
 * más parecidos. Si de algún modelo no hay clave, se dice en vez de callarlo.
 */
export async function buscarEnDocumentos(consulta: string, cantidad: number, documento?: string, ambito?: string): Promise<ResultadoBusqueda> {
  // Con un ámbito (alianza, partidos o gremio) solo se busca en lo que le pertenece: los demás documentos ni se consultan.
  const docs = (await listarDocumentos()).filter((d) => d.modelo && d.vectorizados > 0 && (!documento || d.id === documento) && (!ambito || d.ambito === ambito));
  const permitidos = new Set(docs.map((d) => d.id));
  const modelos = [...new Set(docs.map((d) => d.modelo!))];
  if (modelos.length === 0) return { resultados: [], avisos: ["Todavía no hay documentos vectorizados donde buscar."] };
  const avisos: string[] = [];
  const todos: Hallazgo[] = [];
  for (const modelo of modelos) {
    const proveedor = await proveedorDelModelo(modelo);
    if (!proveedor) {
      avisos.push(`No se buscó en los documentos vectorizados con ${modelo}: falta esa clave en Configuración.`);
      continue;
    }
    const [vector] = await vectorizar([consulta], "consulta", proveedor);
    const hallados = await buscarFragmentos(vector, modelo, ambito ? cantidad * 4 : cantidad, documento);
    todos.push(...(ambito ? hallados.filter((h) => permitidos.has(h.documentoId)) : hallados));
  }
  return { resultados: todos.sort((a, b) => b.similitud - a.similitud).slice(0, cantidad), avisos };
}
