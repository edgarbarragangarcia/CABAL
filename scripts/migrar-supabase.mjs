// Copia los datos de un proyecto de Supabase a otro (las tablas ya deben existir en el destino: corre antes supabase/instalar-todo.sql).
// Uso (desde tu equipo; las llaves service_role están en Supabase › Project Settings › API):
//   ORIGEN_URL=https://VIEJO.supabase.co ORIGEN_KEY=... DESTINO_URL=https://NUEVO.supabase.co DESTINO_KEY=... node scripts/migrar-supabase.mjs
// Opciones:  --con-elecciones  (también copia los resultados electorales, que pesan mucho; se pueden volver a cargar desde el panel)
//            --sin-archivos    (no copia los archivos originales del Storage)
//            --solo=tabla1,tabla2
// No borra nada en el origen. Las llaves no se guardan en ningún archivo.
import { createClient } from "@supabase/supabase-js";

const { ORIGEN_URL, ORIGEN_KEY, DESTINO_URL, DESTINO_KEY } = process.env;
if (!ORIGEN_URL || !ORIGEN_KEY || !DESTINO_URL || !DESTINO_KEY) {
  console.error("Faltan ORIGEN_URL, ORIGEN_KEY, DESTINO_URL o DESTINO_KEY.");
  process.exit(1);
}
if (new URL(ORIGEN_URL).hostname === new URL(DESTINO_URL).hostname) {
  console.error("El origen y el destino son el mismo proyecto.");
  process.exit(1);
}
const args = process.argv.slice(2);
const origen = createClient(ORIGEN_URL, ORIGEN_KEY, { auth: { persistSession: false } });
const destino = createClient(DESTINO_URL, DESTINO_KEY, { auth: { persistSession: false } });

// En el orden en que se pueden insertar (primero lo que otras tablas referencian).
const TABLAS = [
  "miembros", "seguidores", "grupos", "grupo_miembros", "publicaciones", "comentarios", "me_gusta",
  "portales", "portal_ajustes", "portal_paginas", "portal_articulos", "portal_articulo_versiones", "portal_medios", "portal_eventos", "portal_inscripciones",
  "portal_contactos", "portal_adeptos", "portal_interacciones", "portal_campanas", "portal_anuncios", "portal_metricas",
  "documento_carpetas", "documentos", "documento_fragmentos", "documento_eventos",
  "admin_usuarios", "voz_corpus", "redactor_notas", "redactor_guia", "piloto_registros", "camaras_comercio", "monitoreo_items", "indicadores_territoriales",
  "crm_conteos", "crm_leads",
  ...(args.includes("--con-elecciones") ? ["catalogo_electoral", "carga_electoral", "resultados_electorales"] : []),
];
// Columnas «generated always»: el destino las numera solo.
const IDENTIDAD = { documento_eventos: "id", piloto_registros: "id" };
const solo = args.find((a) => a.startsWith("--solo="))?.slice(7).split(",");
const PAGINA = 1000;
const LOTE = 300;

async function copiarTabla(t) {
  let total = 0;
  // El SQL de instalación siembra a la cuenta oficial con otro id: se quita para que entre la del origen (mismo usuario) sin chocar.
  if (t === "miembros") await destino.from("miembros").delete().eq("es_oficial", true);
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await origen.from(t).select("*").range(desde, desde + PAGINA - 1);
    if (error) return { t, error: `leer: ${error.message}` };
    if (!data.length) break;
    const filas = IDENTIDAD[t] ? data.map(({ [IDENTIDAD[t]]: _, ...resto }) => resto) : data;
    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE);
      const r = IDENTIDAD[t] ? await destino.from(t).insert(lote) : await destino.from(t).upsert(lote);
      if (r.error) return { t, error: `escribir (filas ${desde + i}–${desde + i + lote.length}): ${r.error.message}`, total };
    }
    total += data.length;
    if (data.length < PAGINA) break;
  }
  return { t, total };
}

async function copiarArchivos() {
  const B = "documentos";
  const { data: b } = await origen.storage.getBucket(B);
  if (!b) return console.log("Storage: el origen no tiene el bucket «documentos»; nada que copiar.");
  await destino.storage.createBucket(B, { public: false, fileSizeLimit: 50 * 1024 * 1024 });
  let n = 0;
  const recorrer = async (ruta) => {
    const { data } = await origen.storage.from(B).list(ruta, { limit: 1000 });
    for (const it of data ?? []) {
      const p = ruta ? `${ruta}/${it.name}` : it.name;
      if (it.id === null) await recorrer(p);
      else {
        const d = await origen.storage.from(B).download(p);
        if (d.error) { console.log(`  ✗ ${p}: ${d.error.message}`); continue; }
        const u = await destino.storage.from(B).upload(p, d.data, { upsert: true, contentType: "application/octet-stream" });
        u.error ? console.log(`  ✗ ${p}: ${u.error.message}`) : n++;
      }
    }
  };
  await recorrer("");
  console.log(`Storage: ${n} archivos copiados.`);
}

console.log(`Copiando de ${new URL(ORIGEN_URL).hostname} a ${new URL(DESTINO_URL).hostname}…\n`);
let fallos = 0;
for (const t of TABLAS.filter((x) => !solo || solo.includes(x))) {
  const r = await copiarTabla(t);
  if (r.error) {
    // Una tabla que no existe en el origen (módulo nunca usado) no es un error.
    const vacia = /does not exist|schema cache|Could not find the table/i.test(r.error);
    console.log(`${vacia ? "–" : "✗"} ${t}: ${vacia ? "no existe en el origen o el destino" : r.error}`);
    if (!vacia) fallos++;
  } else console.log(`✓ ${t}: ${r.total} filas`);
}
if (!args.includes("--sin-archivos") && !solo) await copiarArchivos();
console.log(fallos ? `\nTerminó con ${fallos} tabla(s) con error: revisa arriba.` : "\nListo. Ahora cambia SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel y vuelve a desplegar.");
