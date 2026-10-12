-- Índices que aceleran la carga electoral (opcional, pero evita que se detenga con «statement timeout»).
-- Pegar completo en Supabase > SQL Editor > Run. Puede tardar uno o dos minutos la primera vez (recorre la tabla una sola vez);
-- se puede repetir sin problema: si el índice ya existe, no hace nada.
--
-- Con cientos de miles de filas, contar y listar lo guardado obligaba a leer toda la tabla (cada fila lleva su resultado completo);
-- en un plan pequeño de Supabase eso agota el tiempo. Este índice incluye las columnas que la carga consulta, así que esas
-- consultas se resuelven leyendo solo el índice.

begin;
set local statement_timeout = 0;

create index if not exists resultados_electorales_cobertura_idx
  on resultados_electorales (eleccion, corporacion, nivel) include (ambito, vacio, actualizado_en);

-- El índice anterior por elección, cargo y nivel queda cubierto por el nuevo: quitarlo hace más livianas las escrituras.
drop index if exists resultados_electorales_nivel_idx;

commit;

analyze resultados_electorales;
