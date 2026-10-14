// Regenera las copias en TypeScript de los archivos SQL de supabase/ (el panel las muestra para pegarlas en el editor SQL de
// Supabase). Uso: node scripts/generar-sql.mjs
//
// El SQL va dentro de una plantilla de texto: no puede llevar acentos graves ni «${» (los comentarios usan «» para citar).
// En supabase/elecciones.sql, lo que está entre «-- [carga:inicio]» y «-- [carga:fin]» se exporta también por separado
// (SQL_CARGA_ELECTORAL): es lo único que falta a quien ya había ejecutado la primera versión.
import { readFileSync, writeFileSync } from "node:fs";

const raiz = new URL("../", import.meta.url);
const leer = (ruta) => readFileSync(new URL(ruta, raiz), "utf8");

function plantilla(nombre, ruta, texto) {
  if (texto.includes("`") || texto.includes("${") || texto.includes("\\")) {
    throw new Error(`${ruta}: el SQL no puede llevar acentos graves, «\${» ni barras invertidas (van dentro de una plantilla de texto).`);
  }
  return `export const ${nombre} = \`${texto}\`;\n`;
}

// -- Resultados electorales
{
  const sql = leer("supabase/elecciones.sql");
  const m = sql.match(/-- \[carga:inicio\]\n([\s\S]*?)-- \[carga:fin\]\n/);
  if (!m) throw new Error("supabase/elecciones.sql: faltan las marcas [carga:inicio] y [carga:fin].");
  const indices = leer("supabase/carga-indices.sql");
  const salida =
    "/** Copia exacta de supabase/elecciones.sql: el panel Análisis > Datos la muestra para pegarla en el editor SQL de Supabase. */\n" +
    plantilla("SQL_ELECCIONES", "supabase/elecciones.sql", sql) +
    "\n/** Copia exacta de supabase/carga-indices.sql: índices que evitan que la carga se detenga por «statement timeout». */\n" +
    plantilla("SQL_INDICES_CARGA", "supabase/carga-indices.sql", indices) +
    "\n/** Solo la tabla de la carga en segundo plano (la parte de supabase/elecciones.sql entre las marcas [carga]): para quien ya tenía lo demás. */\n" +
    plantilla("SQL_CARGA_ELECTORAL", "supabase/elecciones.sql", `-- Carga electoral en segundo plano (se puede ejecutar más de una vez).\n${m[1].trimEnd()}\n`);
  writeFileSync(new URL("src/lib/gov-data/elecciones/sql.ts", raiz), salida);
}

// -- Portales
{
  const sql = leer("supabase/portales.sql");
  const salida =
    "/** Copia exacta de supabase/portales.sql: el panel la muestra para pegarla en el editor SQL de Supabase. */\n" + plantilla("SQL_PORTALES", "supabase/portales.sql", sql);
  writeFileSync(new URL("src/lib/portales/sql.ts", raiz), salida);
}

// -- Documentos (vectores)
{
  const sql = leer("supabase/documentos.sql");
  const salida =
    "/** Copia exacta de supabase/documentos.sql: la pestaña Documentos la muestra para pegarla en el editor SQL de Supabase. */\n" + plantilla("SQL_DOCUMENTOS", "supabase/documentos.sql", sql);
  writeFileSync(new URL("src/lib/documentos/sql.ts", raiz), salida);
}

// -- Territorio (conflicto y problemas por municipio)
{
  const sql = leer("supabase/territorio.sql");
  const salida =
    "/** Copia exacta de supabase/territorio.sql: la sección Territorio la muestra para pegarla en el editor SQL de Supabase. */\n" + plantilla("SQL_TERRITORIO", "supabase/territorio.sql", sql);
  writeFileSync(new URL("src/lib/territorio/sql.ts", raiz), salida);
}

// -- Todo el SQL del panel, en el orden en que debe ejecutarse (el mapa de datos del Gestor documental ofrece copiar lo que falte).
{
  const ORDEN = ["comunidad", "documentos", "gestor-documental", "elecciones", "territorio", "portales", "portales-crm", "portales-cms-pro", "monitoreo", "usuarios", "piloto"];
  const porArchivo = Object.fromEntries(ORDEN.map((n) => [n, leer(`supabase/${n}.sql`)]));
  const salida =
    "/** Copia de los archivos de supabase/ (generado por scripts/generar-sql.mjs): el mapa de datos ofrece copiar el SQL de lo que falta. */\n" +
    `export const ORDEN_SQL = ${JSON.stringify(ORDEN)} as const;\n` +
    `export const SQL_POR_ARCHIVO: Record<string, string> = ${JSON.stringify(porArchivo, null, 1)};\n`;
  writeFileSync(new URL("src/lib/gestor/sql.ts", raiz), salida);
}

console.log("Listo: sql.ts de elecciones, portales, documentos, territorio y el mapa de datos regenerados.");
