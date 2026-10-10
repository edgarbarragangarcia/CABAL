import "server-only";

import { COLS_AUTOR, autorDe, db, type Autor, type Publicacion } from "./store";

/**
 * Qué está en tendencia en la comunidad. Todo se calcula con lo que ya hay en la base (publicaciones, comentarios, «me gusta»,
 * grupos), sin modelos ni datos inventados: cada cifra se puede comprobar contando filas.
 *
 *  - Se comparan dos periodos del mismo largo (el actual y el anterior) para saber si un tema sube o baja.
 *  - Interacción de una publicación = «me gusta» + 2 × comentarios (comentar pesa más que dar «me gusta»).
 *  - Un tema es una palabra (o un #hashtag) que aparece en publicaciones de varias personas, descontando palabras vacías.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Fila = Record<string, any>;

const DIA = 86_400_000;
const lotes = <T,>(a: T[], n = 80): T[][] => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

export type Tema = { palabra: string; hashtag: boolean; menciones: number; antes: number; autores: number; interacciones: number };
export type GrupoActivo = { slug: string; nombre: string; tipo: "municipio" | "barrio"; miembros: number; publicaciones: number; interacciones: number };
export type Voz = { autor: Autor; publicaciones: number; interacciones: number };
export type Tendencias = { dias: number; publicaciones: Publicacion[]; temas: Tema[]; grupos: GrupoActivo[]; voces: Voz[] };

export type Actividad = {
  desde: number;
  desdeAnterior: number;
  posts: Fila[];
  likes: Fila[];
  comentarios: Fila[];
};

/** Publicaciones de los dos últimos periodos con sus «me gusta» y comentarios (por lotes: las URL de PostgREST tienen tope). */
export async function cargarActividad(dias: number): Promise<Actividad> {
  const c = db();
  const ahora = Date.now();
  const desde = ahora - dias * DIA;
  const desdeAnterior = ahora - 2 * dias * DIA;
  const { data } = await c
    .from("publicaciones")
    .select(`id,texto,creado_en,autor_id,grupo_id,autor:miembros!autor_id(${COLS_AUTOR}),grupo:grupos!grupo_id(slug,nombre,tipo)`)
    .gte("creado_en", new Date(desdeAnterior).toISOString())
    .order("creado_en", { ascending: false })
    .limit(600);
  const posts = (data ?? []) as Fila[];
  const ids = posts.map((p) => p.id as string);
  const [likes, comentarios] = await Promise.all([
    Promise.all(lotes(ids).map((l) => c.from("me_gusta").select("publicacion_id,miembro_id").in("publicacion_id", l))).then((r) => r.flatMap((x) => (x.data ?? []) as Fila[])),
    Promise.all(lotes(ids).map((l) => c.from("comentarios").select("publicacion_id,autor_id,creado_en").in("publicacion_id", l))).then((r) => r.flatMap((x) => (x.data ?? []) as Fila[])),
  ]);
  return { desde, desdeAnterior, posts, likes, comentarios };
}

type Conteo = { likes: number; comentarios: number };
export function conteos(a: Actividad) {
  const m = new Map<string, Conteo>();
  const de = (id: string) => m.get(id) ?? m.set(id, { likes: 0, comentarios: 0 }).get(id)!;
  for (const l of a.likes) de(l.publicacion_id).likes++;
  for (const k of a.comentarios) de(k.publicacion_id).comentarios++;
  return m;
}
export const interaccion = (x?: Conteo) => (x ? x.likes + 2 * x.comentarios : 0);
export const esActual = (a: Actividad, p: Fila) => Date.parse(p.creado_en) >= a.desde;

/* ------------------------------------------------------------ publicaciones */

export function aPublicacion(p: Fila, cuenta: Map<string, Conteo>, yo?: string, likes?: Fila[]): Publicacion {
  return {
    id: p.id,
    texto: p.texto,
    creadoEn: p.creado_en,
    autor: autorDe(p.autor),
    grupo: p.grupo ? { slug: p.grupo.slug, nombre: p.grupo.nombre } : null,
    meGusta: cuenta.get(p.id)?.likes ?? 0,
    yoLeDi: !!yo && !!likes?.some((l) => l.publicacion_id === p.id && l.miembro_id === yo),
    comentarios: cuenta.get(p.id)?.comentarios ?? 0,
  };
}

/** Las más movidas del periodo: interacción + un pequeño empuje a las recientes para que una publicación de hoy no pierda contra una vieja. */
export function publicacionesEnTendencia(a: Actividad, yo: string | undefined, limite = 6): (Publicacion & { puntaje: number })[] {
  const cuenta = conteos(a);
  const ahora = Date.now();
  return a.posts
    .filter((p) => esActual(a, p))
    .map((p) => ({ p, puntaje: interaccion(cuenta.get(p.id)) + 3 * Math.exp(-(ahora - Date.parse(p.creado_en)) / 3_600_000 / 48) }))
    .sort((u, v) => v.puntaje - u.puntaje)
    .slice(0, limite)
    .map(({ p, puntaje }) => ({ ...aPublicacion(p, cuenta, yo, a.likes), puntaje }));
}

/* ------------------------------------------------------------------- temas */

// Palabras vacías, de relleno y demasiado genéricas para ser un «tema» (sin tildes). Se descartan también las de menos de 4 letras.
const PARADAS = new Set(
  `para pero como esto esta este estos estas eso esa ese esos esas aqui alli alla aca muy tambien tanto tanta tantos tantas aun todavia siempre nunca
  hay sido soy eres somos son era eran fue fueron ser estar estoy estamos estan estaba estuvo tengo tiene tenemos tienen tener tenia hacer hago hace hacemos hacen hecho
  poder puedo puede podemos pueden podria podrian quiero quiere queremos quieren quisiera quien quienes cual cuales cuando donde cuanto cuantos cuantas porque pues entonces
  mejor bien mal algo alguien algun alguna algunos algunas nadie nada todo todos toda todas otro otra otros otras mismo misma cada mucho mucha muchos muchas poco poca pocos pocas
  menos gracias hola buenos buenas dias tardes noches favor saludos ayuda ayudar ayudarme ayudan ayudo gustaria gusta gustan veces vez hoy ayer manana ahora luego despues antes
  sabado domingo lunes martes miercoles jueves viernes semana semanas mes meses ano anos primera primer primero segunda segundo tercera estar sobre entre desde hasta cuando
  dentro fuera hacia contra segun sino cuyo cuya mientras aunque ademas asi tal tales cosa cosas parte partes ver vamos vayan vengan venga vengo vienen viene voy van
  comunidad comunidades vecinos vecino vecina vecinas afiliados afiliado dice dicen decir saber sabe saben sabemos conoce conocen conozco escribe escriban escribir escribanme
  aqui abajo arriba comentarios comentario publicar publicacion mensaje favor ojala quiza quizas capaz podriamos deberiamos debemos deben debe puedan pueda sean sera seran
  tengan tenga tuvo hizo hicieron dijo digo dijeron nuevo nueva nuevos nuevas viejo vieja gran grande grandes pequeno ultimo ultima ultimos ultimas unos unas
  anima animo animar animan animamos armar armemos armo arman sumar sumo suma sumamos sumen apunto apuntar apuntan cuenten cuenta cuentan conmigo contigo aportar aporte aportes
  compartir comparto comparte compartan idea ideas gente personas persona presente bienvenido bienvenida bienvenidos escribo escribimos escribame interesados interesada interesado
  interesa interesan consejos consejo grupo grupos barrio barrios ciudad ciudades reunion reuniones encuentro encuentros esperamos espero esperar llegue llegar llego organizar
  organizo organizamos organizado convocar convoco pregunta preguntar pregunto preguntas respuesta responder responde recomienda recomiendan recomendar conozco conocer conocemos
  piensa piensan pensar creo creen cree parece parecen tiempo momento momentos lugar lugares sitio sitios forma manera maneras tema temas caso casos punto puntos lado hora horas
  minuto minutos siguiente siguientes pasado pasada proximo proxima proximos proximas actual actuales ultimo ultima primero segundo tercero cuarto quinto sexto nuestro nuestra
  nuestros nuestras tuyo tuya suyo suya mismos mismas junto juntos juntas lleguen salir salgo salimos llevo llevar traigo traer tener tengan tendremos tendra serian seria
  quedo quedar queda quedamos quedaron pendiente pendientes falta faltan faltaba hacia haya hayan hubo habia habra hemos has han ahi alla cerca lejos cualquier cualquiera
  coordinar coordino coordinamos coordinen convocar convocan buena bueno buenos excelente genial claro clara claros claras justo justa lista listo listas listos`
    .split(/\s+/)
    .filter(Boolean),
);

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function extraerTerminos(texto: string) {
  const out: { clave: string; mostrar: string; hashtag: boolean }[] = [];
  for (const m of texto.matchAll(/#?[\p{L}\p{N}_]+/gu)) {
    const crudo = m[0];
    if (crudo.startsWith("#")) {
      const cuerpo = crudo.slice(1);
      if (cuerpo.length >= 3 && !/^\d+$/.test(cuerpo)) out.push({ clave: `#${sinTildes(cuerpo).toLowerCase()}`, mostrar: `#${cuerpo.toLowerCase()}`, hashtag: true });
      continue;
    }
    const plano = sinTildes(crudo).toLowerCase();
    if (plano.length < 4 || /\d/.test(plano) || PARADAS.has(plano)) continue;
    out.push({ clave: plano, mostrar: crudo.toLowerCase(), hashtag: false });
  }
  return out;
}

type Acum = { mostrar: string; hashtag: boolean; actual: Set<string>; anterior: Set<string>; autores: Set<string>; interacciones: number };

export function temasEnTendencia(a: Actividad, limite = 10): Tema[] {
  const cuenta = conteos(a);
  const mapa = new Map<string, Acum>();
  for (const p of a.posts) {
    const actual = esActual(a, p);
    const x = interaccion(cuenta.get(p.id));
    const vistos = new Set<string>();
    for (const t of extraerTerminos(p.texto)) {
      if (vistos.has(t.clave)) continue;
      vistos.add(t.clave);
      let m = mapa.get(t.clave);
      if (!m) mapa.set(t.clave, (m = { mostrar: t.mostrar, hashtag: t.hashtag, actual: new Set(), anterior: new Set(), autores: new Set(), interacciones: 0 }));
      if (actual) { m.actual.add(p.id); m.autores.add(p.autor_id); m.interacciones += x; } else m.anterior.add(p.id);
    }
  }
  // Plurales sencillos: «talleres» se suma a «taller», «cursos» a «curso».
  for (const [clave, m] of [...mapa]) {
    for (const base of [clave.endsWith("es") ? clave.slice(0, -2) : "", clave.endsWith("s") ? clave.slice(0, -1) : ""]) {
      const s = base ? mapa.get(base) : undefined;
      if (!s || s.hashtag || m.hashtag) continue;
      for (const id of m.actual) s.actual.add(id);
      for (const id of m.anterior) s.anterior.add(id);
      for (const id of m.autores) s.autores.add(id);
      s.interacciones += m.interacciones;
      mapa.delete(clave);
      break;
    }
  }
  return [...mapa.values()]
    .filter((m) => (m.hashtag ? m.actual.size >= 1 : m.actual.size >= 2 && m.autores.size >= 2))
    .map((m) => ({ tema: { palabra: m.mostrar, hashtag: m.hashtag, menciones: m.actual.size, antes: m.anterior.size, autores: m.autores.size, interacciones: m.interacciones }, peso: m.autores.size * 2 + m.actual.size + m.interacciones * 0.5 + (m.hashtag ? 2 : 0) }))
    .sort((u, v) => v.peso - u.peso)
    .slice(0, limite)
    .map((x) => x.tema);
}

/* ------------------------------------------------------------------ grupos */

/** Todos los grupos con cuántos afiliados tienen y cuánta actividad hubo en el periodo. */
export async function actividadGrupos(a: Actividad): Promise<GrupoActivo[]> {
  const c = db();
  const [{ data: grupos }, { data: filas }] = await Promise.all([c.from("grupos").select("id,slug,nombre,tipo"), c.from("grupo_miembros").select("grupo_id").limit(20000)]);
  const miembros = new Map<string, number>();
  for (const f of filas ?? []) miembros.set(f.grupo_id, (miembros.get(f.grupo_id) ?? 0) + 1);
  const cuenta = conteos(a);
  const porGrupo = new Map<string, { pubs: number; inter: number }>();
  for (const p of a.posts) {
    if (!p.grupo_id || !esActual(a, p)) continue;
    const g = porGrupo.get(p.grupo_id) ?? { pubs: 0, inter: 0 };
    g.pubs++;
    g.inter += interaccion(cuenta.get(p.id));
    porGrupo.set(p.grupo_id, g);
  }
  return (grupos ?? []).map((g: Fila) => ({ slug: g.slug, nombre: g.nombre, tipo: g.tipo, miembros: miembros.get(g.id) ?? 0, publicaciones: porGrupo.get(g.id)?.pubs ?? 0, interacciones: porGrupo.get(g.id)?.inter ?? 0 }));
}

/* ------------------------------------------------------------------- voces */

export function vocesDestacadas(a: Actividad, limite = 5): Voz[] {
  const cuenta = conteos(a);
  const por = new Map<string, Voz>();
  for (const p of a.posts) {
    if (!esActual(a, p) || p.autor?.es_oficial) continue;
    const v = por.get(p.autor_id) ?? { autor: autorDe(p.autor), publicaciones: 0, interacciones: 0 };
    v.publicaciones++;
    v.interacciones += interaccion(cuenta.get(p.id));
    por.set(p.autor_id, v);
  }
  return [...por.values()].sort((u, v) => v.interacciones - u.interacciones || v.publicaciones - u.publicaciones).slice(0, limite);
}

/* ----------------------------------------------------------------- público */

export async function tendencias(yo: string, dias = 7): Promise<Tendencias> {
  const a = await cargarActividad(dias);
  const grupos = (await actividadGrupos(a)).filter((g) => g.publicaciones > 0).sort((u, v) => v.interacciones - u.interacciones || v.publicaciones - u.publicaciones).slice(0, 5);
  return { dias, publicaciones: publicacionesEnTendencia(a, yo), temas: temasEnTendencia(a), grupos, voces: vocesDestacadas(a) };
}
