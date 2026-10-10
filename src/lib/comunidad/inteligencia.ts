import "server-only";

import { db, type Publicacion } from "./store";
import { actividadGrupos, aPublicacion, cargarActividad, conteos, esActual, interaccion, temasEnTendencia, type Actividad, type Fila, type GrupoActivo, type Tema } from "./tendencias";

/**
 * Panel de decisión del administrador: qué pasa en la comunidad y qué conviene hacer.
 *
 * Todo sale de contar filas (afiliados, publicaciones, comentarios, «me gusta», grupos): no hay estimaciones ni modelos. Las
 * «señales» son reglas simples sobre esas cuentas y cada una muestra las cifras en que se basa, para que quien decide pueda
 * comprobarlas y discrepar.
 *
 * Los «me gusta» no tienen fecha en la base: se cuentan los de las publicaciones del periodo.
 * Los comentarios y las afiliaciones sí se cuentan por su propia fecha. Días en horario de Colombia (UTC−5).
 */

const DIA = 86_400_000;
const HORA_CO = 5 * 3_600_000;
const diaCO = (ms: number) => new Date(ms - HORA_CO).toISOString().slice(0, 10);

export type Senal = { id: string; nivel: "alerta" | "oportunidad" | "info"; titulo: string; detalle: string; accion?: "publicar" | "difundir" };
export type PuntoSerie = { dia: string; afiliados: number; publicaciones: number; interacciones: number };
export type Ciudad = { municipio: string; afiliados: number; nuevos: number; publicaciones: number };
export type Barrio = { barrio: string; municipio: string; afiliados: number };
export type TopPublicacion = Publicacion & { puntaje: number };

export type Inteligencia = {
  dias: number;
  kpis: {
    afiliados: number;
    nuevos: number;
    nuevosAnt: number;
    publicaciones: number;
    publicacionesAnt: number;
    comentarios: number;
    comentariosAnt: number;
    meGusta: number;
    activos: number;
    participacion: number;
    oficialPublicaciones: number;
    sinRespuesta: number;
  };
  serie: PuntoSerie[];
  ciudades: Ciudad[];
  barrios: Barrio[];
  temas: Tema[];
  publicaciones: TopPublicacion[];
  grupos: GrupoActivo[];
  senales: Senal[];
};

const pct = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 100));
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const lista = (xs: string[], max = 3) => (xs.length <= max ? xs.join(", ") : `${xs.slice(0, max).join(", ")} y ${xs.length - max} más`);

export async function inteligencia(dias: number): Promise<Inteligencia> {
  const c = db();
  const a: Actividad = await cargarActividad(dias);
  const { data: miembros } = await c.from("miembros").select("id,municipio,barrio,creado_en,es_oficial").limit(20000);
  const reales = ((miembros ?? []) as Fila[]).filter((m) => !m.es_oficial);
  const cuenta = conteos(a);

  const enActual = (ms: number) => ms >= a.desde;
  const enAnterior = (ms: number) => ms >= a.desdeAnterior && ms < a.desde;
  const ms = (iso: string) => Date.parse(iso);

  const postsActual = a.posts.filter((p) => esActual(a, p));
  const postsAnterior = a.posts.filter((p) => !esActual(a, p));
  const comActual = a.comentarios.filter((k) => enActual(ms(k.creado_en)));
  const comAnterior = a.comentarios.filter((k) => enAnterior(ms(k.creado_en)));
  const meGusta = postsActual.reduce((n, p) => n + (cuenta.get(p.id)?.likes ?? 0), 0);

  const activos = new Set<string>();
  for (const p of postsActual) if (!p.autor?.es_oficial) activos.add(p.autor_id);
  for (const k of comActual) activos.add(k.autor_id);
  const afiliados = reales.length;
  const nuevos = reales.filter((m) => enActual(ms(m.creado_en))).length;
  const nuevosAnt = reales.filter((m) => enAnterior(ms(m.creado_en))).length;
  const oficialPublicaciones = postsActual.filter((p) => p.autor?.es_oficial).length;
  const sinRespuesta = postsActual.filter((p) => ms(p.creado_en) < Date.now() - DIA && !p.autor?.es_oficial && interaccion(cuenta.get(p.id)) === 0).length;

  // Serie diaria (un punto por día del periodo actual).
  const serie: PuntoSerie[] = [];
  for (let i = dias - 1; i >= 0; i--) serie.push({ dia: diaCO(Date.now() - i * DIA), afiliados: 0, publicaciones: 0, interacciones: 0 });
  const porDia = new Map(serie.map((p) => [p.dia, p]));
  for (const m of reales) { const p = porDia.get(diaCO(ms(m.creado_en))); if (p) p.afiliados++; }
  for (const p of postsActual) { const x = porDia.get(diaCO(ms(p.creado_en))); if (x) x.publicaciones++; }
  for (const k of comActual) { const x = porDia.get(diaCO(ms(k.creado_en))); if (x) x.interacciones++; }
  for (const p of postsActual) { const x = porDia.get(diaCO(ms(p.creado_en))); if (x) x.interacciones += cuenta.get(p.id)?.likes ?? 0; }

  // Ciudades y barrios.
  const mun = new Map<string, Ciudad>();
  for (const m of reales) {
    const x = mun.get(m.municipio) ?? { municipio: m.municipio, afiliados: 0, nuevos: 0, publicaciones: 0 };
    x.afiliados++;
    if (enActual(ms(m.creado_en))) x.nuevos++;
    mun.set(m.municipio, x);
  }
  for (const p of postsActual) { const x = mun.get(p.autor?.municipio); if (x && !p.autor?.es_oficial) x.publicaciones++; }
  const ciudades = [...mun.values()].sort((u, v) => v.afiliados - u.afiliados).slice(0, 8);
  const bar = new Map<string, Barrio>();
  for (const m of reales) { const k = `${m.municipio}|${m.barrio}`; const x = bar.get(k) ?? { barrio: m.barrio, municipio: m.municipio, afiliados: 0 }; x.afiliados++; bar.set(k, x); }
  const barrios = [...bar.values()].sort((u, v) => v.afiliados - u.afiliados).slice(0, 8);

  const temas = temasEnTendencia(a, 10);
  const publicaciones: TopPublicacion[] = postsActual
    .map((p) => ({ p, puntaje: interaccion(cuenta.get(p.id)) }))
    .sort((u, v) => v.puntaje - u.puntaje)
    .slice(0, 5)
    .map(({ p, puntaje }) => ({ ...aPublicacion(p, cuenta), puntaje }));
  const todosGrupos = await actividadGrupos(a);
  const grupos = [...todosGrupos].sort((u, v) => v.interacciones - u.interacciones || v.publicaciones - u.publicaciones).slice(0, 8);

  /* ----------------------------------------------------------- señales */
  const senales: Senal[] = [];
  const participacion = afiliados === 0 ? 0 : activos.size / afiliados;

  if (afiliados > 0 && nuevos === 0)
    senales.push({ id: "sin-afiliaciones", nivel: "alerta", titulo: `Ninguna afiliación nueva en ${dias} días`, detalle: `${nuevosAnt > 0 ? `En el periodo anterior hubo ${nuevosAnt}. ` : ""}Revisa dónde se está difundiendo el formulario público (/unete).`, accion: "difundir" });
  else if (nuevos > 0) {
    const v = pct(nuevos, nuevosAnt);
    senales.push({ id: "crecimiento", nivel: nuevos >= nuevosAnt ? "oportunidad" : "info", titulo: `${plural(nuevos, "afiliación nueva", "afiliaciones nuevas")} en ${dias} días`, detalle: v === null ? "El periodo anterior no tuvo afiliaciones: es el primer movimiento." : v === 0 ? `Igual que las ${nuevosAnt} del periodo anterior.` : `${v > 0 ? "+" : ""}${v}% frente a las ${nuevosAnt} del periodo anterior.` });
  }
  const topCiudad = [...mun.values()].sort((u, v) => v.nuevos - u.nuevos)[0];
  if (topCiudad && topCiudad.nuevos > 0 && nuevos > 0)
    senales.push({ id: "ciudad", nivel: "oportunidad", titulo: `${topCiudad.municipio} concentra ${topCiudad.nuevos} de las ${nuevos} afiliaciones nuevas`, detalle: "Es la zona con más movimiento: buen momento para un mensaje oficial dirigido o un encuentro presencial." });
  const alza = temas.filter((t) => t.menciones - t.antes >= 2 && t.autores >= 2)[0];
  if (alza)
    senales.push({ id: "tema-alza", nivel: "oportunidad", titulo: `Tema en alza: ${alza.hashtag ? alza.palabra : `«${alza.palabra}»`}`, detalle: `${alza.menciones} publicaciones de ${alza.autores} personas frente a ${alza.antes} el periodo anterior. Considera una publicación oficial o un evento sobre el tema.`, accion: "publicar" });
  else if (temas[0])
    senales.push({ id: "tema-top", nivel: "info", titulo: `Tema más hablado: ${temas[0].hashtag ? temas[0].palabra : `«${temas[0].palabra}»`}`, detalle: `${temas[0].menciones} publicaciones de ${temas[0].autores} personas en ${dias} días.` });
  if (afiliados > 0 && oficialPublicaciones === 0)
    senales.push({ id: "oficial-silencio", nivel: "alerta", titulo: `La cuenta oficial no publicó en ${dias} días`, detalle: "Los afiliados abren «Para ti» sin contenido oficial. Publica desde la pestaña «Publicar».", accion: "publicar" });
  if (afiliados >= 5) {
    if (participacion < 0.2)
      senales.push({ id: "participacion-baja", nivel: "alerta", titulo: `Participación baja: ${Math.round(participacion * 100)}%`, detalle: `Solo ${activos.size} de ${afiliados} afiliados publicó o comentó en ${dias} días. Una pregunta abierta desde la cuenta oficial suele mover la conversación.`, accion: "publicar" });
    else if (participacion >= 0.5)
      senales.push({ id: "participacion-alta", nivel: "info", titulo: `Buena participación: ${Math.round(participacion * 100)}%`, detalle: `${activos.size} de ${afiliados} afiliados publicó o comentó en ${dias} días.` });
  }
  const dormidos = todosGrupos.filter((g) => g.miembros >= 3 && g.publicaciones === 0);
  if (dormidos.length)
    senales.push({ id: "grupos-dormidos", nivel: "alerta", titulo: `${plural(dormidos.length, "grupo", "grupos")} con afiliados y sin actividad`, detalle: `${lista(dormidos.map((g) => g.nombre))}. Invitar a publicar o proponer un tema puede reactivarlos.` });
  if (grupos[0] && grupos[0].publicaciones > 0)
    senales.push({ id: "grupo-top", nivel: "info", titulo: `Grupo más activo: ${grupos[0].nombre}`, detalle: `${grupos[0].publicaciones} publicaciones y ${grupos[0].interacciones} interacciones en ${dias} días.` });
  if (sinRespuesta > 0)
    senales.push({ id: "sin-respuesta", nivel: "alerta", titulo: `${plural(sinRespuesta, "publicación", "publicaciones")} sin ninguna reacción`, detalle: "Llevan más de 24 horas sin «me gusta» ni comentarios: la cuenta oficial o un moderador puede responder." });
  const orden = { alerta: 0, oportunidad: 1, info: 2 } as const;
  senales.sort((u, v) => orden[u.nivel] - orden[v.nivel]);

  return {
    dias,
    kpis: { afiliados, nuevos, nuevosAnt, publicaciones: postsActual.length, publicacionesAnt: postsAnterior.length, comentarios: comActual.length, comentariosAnt: comAnterior.length, meGusta, activos: activos.size, participacion, oficialPublicaciones, sinRespuesta },
    serie,
    ciudades,
    barrios,
    temas,
    publicaciones,
    grupos,
    senales: senales.slice(0, 8),
  };
}
