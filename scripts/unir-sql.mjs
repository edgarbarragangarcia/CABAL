// Junta todos los SQL de supabase/ en UN solo archivo, en el orden correcto, para instalar el proyecto en una base nueva de Supabase.
// Uso: node scripts/unir-sql.mjs   →   supabase/instalar-todo.sql  (pegarlo completo en Supabase › SQL Editor › Run)
import { readFileSync, writeFileSync } from "node:fs";

const ORDEN = ["comunidad", "documentos", "gestor-documental", "elecciones", "territorio", "portales", "portales-crm", "portales-cms-pro", "monitoreo", "usuarios", "piloto", "camaras", "redactor", "voz", "proyeccion", "crm"];
const leer = (n) => readFileSync(new URL(`../supabase/${n}.sql`, import.meta.url), "utf8");
const partes = ORDEN.map((n) => `-- ============================================================\n-- ${n}.sql\n-- ============================================================\n${leer(n).trim()}\n`);
const salida = `-- CABAL: instalación completa en una base nueva de Supabase (generado por scripts/unir-sql.mjs; no editar a mano).\n-- Pegar COMPLETO en Supabase › SQL Editor › Run. Se puede repetir sin problema.\n-- Aparte, opcional y solo si la carga electoral se detiene por tiempo: supabase/carga-indices.sql.\n\n${partes.join("\n")}`;
writeFileSync(new URL("../supabase/instalar-todo.sql", import.meta.url), salida);
console.log(`Listo: supabase/instalar-todo.sql (${ORDEN.length} archivos, ${salida.length.toLocaleString("es-CO")} caracteres).`);
