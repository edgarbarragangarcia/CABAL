// Datos de DEMOSTRACIÓN para la comunidad: afiliados ficticios con publicaciones, comentarios, me gusta, grupos y seguidores,
// para ver cómo se siente la red con gente dentro. Todo lo que crea se puede quitar de una vez.
//
//   node --env-file=.env.local scripts/comunidad-demo.mjs sembrar [--para <usuario>]
//   node --env-file=.env.local scripts/comunidad-demo.mjs quitar
//   node --env-file=.env.local scripts/comunidad-demo.mjs estado
//
// Cómo se reconocen los datos de demostración (y por qué es seguro quitarlos): usuario `demo_…`, correo `demo.…@example.com`
// (dominio reservado: no existe nadie ahí), cédula `9999xxxxxx` (todavía no se emiten cédulas de ese rango), contraseña sin
// acceso (nadie puede iniciar sesión) y la biografía empieza con «Cuenta de demostración». `quitar` solo borra filas que cumplen
// las tres primeras condiciones a la vez; el resto (publicaciones, comentarios, me gusta, seguidores y grupos) cae en cascada.
// NO se crean publicaciones de la cuenta oficial ni seguidores de la cuenta oficial: no se inventa nada a nombre de nadie real.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !llave) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (usa: node --env-file=.env.local …).");
  process.exit(1);
}
const c = createClient(url, llave, { auth: { persistSession: false } });

const sinTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = (s) => sinTildes(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const hace = (minutos) => new Date(Date.now() - minutos * 60_000).toISOString();

/** Generador pseudoaleatorio con semilla: cada ejecución produce exactamente los mismos datos. */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azar = mulberry32(20261010);
const barajar = (lista) => lista.map((x) => [azar(), x]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);

/* ----------------------------------------------------------------- personas */

const BOG = ["Bogotá D.C.", "Bogotá"];
const ANT = ["Antioquia", "Medellín"];
const VAL = ["Valle del Cauca", "Cali"];
const ATL = ["Atlántico", "Barranquilla"];
const SAN = ["Santander", "Bucaramanga"];
const BOL = ["Bolívar", "Cartagena"];

// [clave, nombres, apellidos, nacimiento, [departamento, municipio], barrio, bio]
const PERSONAS = [
  ["lauragomez", "Laura", "Gómez Prieto", "1989-04-12", BOG, "Santa Bárbara", "Abogada y mamá de dos. Me interesa la formación cívica."],
  ["carlosrincon", "Carlos", "Rincón Ardila", "1976-09-03", BOG, "Santa Bárbara", "Administrador. Organizo las reuniones de vecinos."],
  ["marcelaortiz", "Marcela", "Ortiz Salcedo", "1984-01-27", BOG, "Santa Bárbara", "Contadora. Buscando buenos colegios y buenas ideas."],
  ["andresquintero", "Andrés", "Quintero Mejía", "1992-11-15", BOG, "Santa Bárbara", "Profesor de historia. Armando un club de lectura."],
  ["paolacifuentes", "Paola", "Cifuentes Duarte", "1995-06-30", BOG, "Santa Bárbara", "Diseñadora. Amante de los animales."],
  ["jorgebarrera", "Jorge", "Barrera Linares", "1969-02-08", BOG, "Santa Bárbara", "Jubilado. Camino por el parque todas las mañanas."],
  ["camilotorres", "Camilo", "Torres Vega", "1987-07-21", BOG, "Chapinero", "Politólogo. Me gusta moderar conversaciones."],
  ["danielapardo", "Daniela", "Pardo Rojas", "1998-03-09", BOG, "Chapinero", "Estudiante de derecho. Comparto becas y convocatorias."],
  ["juliancardenas", "Julián", "Cárdenas Nieto", "1983-12-02", BOG, "Suba", "Docente de matemáticas."],
  ["sofiamendoza", "Sofía", "Mendoza Cruz", "1991-05-18", BOG, "Usaquén", "Periodista. Lectora fiel del boletín."],
  ["estebanrios", "Esteban", "Ríos Valencia", "1996-10-25", BOG, "Usaquén", "Ingeniero industrial en busca de nuevas oportunidades."],
  ["ximenabeltran", "Ximena", "Beltrán Roa", "1980-08-14", BOG, "Teusaquillo", "Politóloga y analista de datos."],
  ["felipeacosta", "Felipe", "Acosta Lozano", "1990-01-05", BOG, "Cedritos", "Emprendedor. Organizo caminatas los domingos."],
  ["valeriamontoya", "Valeria", "Montoya Pinzón", "1993-09-11", BOG, "Fontibón", "Ingeniera de sistemas. Talleres digitales para microempresarios."],
  ["santiagorestrepo", "Santiago", "Restrepo Arango", "1985-06-06", ANT, "El Poblado", "Emprendedor y vecino de El Poblado."],
  ["manuelavelez", "Manuela", "Vélez Ochoa", "1994-02-19", ANT, "Laureles", "Arquitecta. Me encanta mi barrio."],
  ["mateozapata", "Mateo", "Zapata Henao", "1999-08-28", ANT, "El Poblado", "Estudiante de administración."],
  ["isabelagiraldo", "Isabela", "Giraldo Ruiz", "1988-12-12", ANT, "Belén", "Enfermera. Vecina de Belén."],
  ["nicolascaicedo", "Nicolás", "Caicedo Valencia", "1986-04-04", VAL, "San Fernando", "Comerciante. Curioso por la formación."],
  ["julianaescobar", "Juliana", "Escobar Marín", "1990-10-10", VAL, "Granada", "Gestora cultural."],
  ["sebastianlasso", "Sebastián", "Lasso Ibarra", "1997-07-07", VAL, "Ciudad Jardín", "Estudiante de economía."],
  ["luisperez", "Luis Fernando", "Pérez Daza", "1979-03-23", ATL, "El Prado", "Docente universitario."],
  ["karenbarros", "Karen", "Barros Charris", "1992-05-02", ATL, "Alto Prado", "Trabajadora social."],
  ["nataliaserrano", "Natalia", "Serrano Castillo", "1989-11-30", SAN, "Cabecera", "Maestra rural y promotora de lectura."],
  ["diegoherrera", "Diego", "Herrera Arenas", "1982-09-16", SAN, "Cañaveral", "Ingeniero. Padre de familia."],
  ["marianatamara", "Mariana", "Támara Polo", "1995-01-22", BOL, "Bocagrande", "Guía turística."],
];

// Con quién quedan conectadas las cuentas REALES (solo si se indica `--para` o hay exactamente una): así «Para ti» y «Seguidores» no salen vacíos.
const REAL_SIGUE = ["lauragomez", "carlosrincon", "andresquintero", "camilotorres", "ximenabeltran"];
const REAL_LO_SIGUEN = ["lauragomez", "marcelaortiz", "jorgebarrera", "sofiamendoza"];

/* ------------------------------------------------------------ publicaciones */

// g: "barrio" | "municipio" | null (null = publicación general, sin grupo). hace = minutos. Comentarios: [autor, texto, minutos después].
const PUBLICACIONES = [
  { a: "carlosrincon", g: "barrio", hace: 35, likes: 7, t: "Vecinos de Santa Bárbara: este sábado a las 9 a. m. nos encontramos en el parque para hablar del alumbrado y la seguridad de la cuadra. Si pueden ayudar a convocar, mejor. 🙌 #seguridad",
    c: [["lauragomez", "Yo llevo tinto y ayudo a pasar la voz en los chats del edificio.", 12], ["marcelaortiz", "Cuenten conmigo. ¿Alguien tiene parlante o megáfono?", 20]] },
  { a: "sofiamendoza", g: null, hace: 70, likes: 3, t: "Acabo de leer el boletín de la semana: claro, corto y con la fuente a la vista. Justo lo que necesitaba para ponerme al día.",
    c: [["danielapardo", "Lo leí esta mañana, muy bueno el resumen.", 25]] },
  { a: "santiagorestrepo", g: "municipio", hace: 240, likes: 9, t: "Medellín presente. Este domingo caminata por El Poblado y charla sobre emprendimiento local. Los esperamos, vengan con ganas de conversar. #emprendimiento",
    c: [["manuelavelez", "Yo llego con mi socia. Gracias por organizar.", 40], ["mateozapata", "Allí estaremos.", 55]] },
  { a: "lauragomez", g: "municipio", hace: 300, likes: 8, t: "¿Alguien más piensa hacer el curso de liderazgo público de la Fundación? Me gustaría ir acompañada y estudiar en grupo. #formación",
    c: [["ximenabeltran", "Yo estaba mirando el mismo curso. Armemos el grupo de estudio.", 30], ["danielapardo", "Cuenten conmigo, puedo compartir mis apuntes.", 75]] },
  { a: "marcelaortiz", g: "barrio", hace: 180, likes: 4, t: "¿Alguien recomienda un colegio cerca de la 116 con buen inglés? Mi hija entra a quinto el año que viene. #educación",
    c: [["paolacifuentes", "Pregunta en el de la 118, a varios vecinos les ha ido bien.", 22], ["andresquintero", "Conozco otro por la 119. Te cuento el sábado en la reunión.", 50]] },
  { a: "camilotorres", g: "municipio", hace: 480, likes: 5, t: "Propuesta para la comunidad: que cada mes rote quién modera las conversaciones de la ciudad, para que todos participemos. ¿Les parece? #participación",
    c: [["sofiamendoza", "Me gusta la idea, así nadie se cansa.", 18], ["estebanrios", "Apoyado. Armemos un calendario.", 40]] },
  { a: "nicolascaicedo", g: "municipio", hace: 420, likes: 2, t: "Cali: ¿alguien sabe si habrá curso presencial en la ciudad el próximo mes?",
    c: [["julianaescobar", "Yo también pregunto desde hace días. Si se enteran, avisen.", 35]] },
  { a: "luisperez", g: "municipio", hace: 600, likes: 5, t: "Barranquilla presente 💛 ¿Cuántos somos por acá? Armemos el grupo de la ciudad y una primera reunión.",
    c: [["karenbarros", "Aquí estoy, cuenta conmigo.", 45]] },
  { a: "mateozapata", g: "barrio", hace: 360, likes: 3, t: "Si alguien de El Poblado quiere sumarse a la caminata del domingo, avise aquí abajo en los comentarios.",
    c: [["santiagorestrepo", "Aquí estamos, bienvenido.", 15]] },
  { a: "danielapardo", g: null, hace: 720, likes: 10, t: "Compartir es poder: si saben de una beca, un curso o una convocatoria, publíquenla aquí para que llegue a más gente. #becas",
    c: [["sebastianlasso", "Buena idea. Voy a pasar las que me lleguen.", 90]] },
  { a: "andresquintero", g: "barrio", hace: 1440, likes: 9, t: "Gracias a todos los que vinieron al conversatorio de ayer. Quedó pendiente armar un grupo de lectura para jóvenes del barrio; ¿quién se anima a coordinar? #lectura",
    c: [["jorgebarrera", "Yo me apunto, tengo varios libros para empezar.", 60], ["lauragomez", "Podemos usar el salón comunal los jueves por la tarde.", 120]] },
  { a: "ximenabeltran", g: null, hace: 1560, likes: 12, t: "Idea para el observatorio: una versión resumida de cada proyecto de ley, en lenguaje sencillo, para que todos podamos entenderlo y opinar. #transparencia",
    c: [["camilotorres", "Totalmente de acuerdo, eso acerca a la gente.", 40], ["lauragomez", "Yo ayudo a redactar los resúmenes si hace falta.", 95]] },
  { a: "nataliaserrano", g: "municipio", hace: 1700, likes: 14, t: "Buscamos voluntarios para dictar talleres de lectura a niños de escuelas rurales cerca de Bucaramanga este semestre. ¿Quién se anima? #voluntariado #educación",
    c: [["diegoherrera", "Yo me apunto, tengo experiencia con grupos de primaria.", 50]] },
  { a: "valeriamontoya", g: "municipio", hace: 2880, likes: 11, t: "Primera vez que escribo por aquí. Soy ingeniera y quiero aportar con talleres de herramientas digitales para microempresarios del barrio. #emprendimiento",
    c: [["felipeacosta", "Excelente, esa necesidad es real. Te ayudo a conseguir un salón.", 70]] },
  { a: "manuelavelez", g: "barrio", hace: 2900, likes: 4, t: "¿Alguien de Laureles interesado en armar el grupo del barrio? Ya somos dos.",
    c: [["isabelagiraldo", "Soy de Belén pero con gusto me sumo a los encuentros.", 120]] },
  { a: "paolacifuentes", g: "barrio", hace: 2700, likes: 6, t: "Se perdió una gata gris con collar azul por la carrera 19. Si la ven, escríbanme por aquí. 🙏",
    c: [["jorgebarrera", "La vi ayer cerca de la panadería, voy a mirar de nuevo.", 140]] },
  { a: "felipeacosta", g: null, hace: 3000, likes: 4, t: "Reunión virtual esta semana para organizar las caminatas de los domingos por Bogotá. ¿Quién se suma?", c: [] },
  { a: "karenbarros", g: "barrio", hace: 3000, likes: 5, t: "Alto Prado: ¿quién se anima a coordinar una jornada de limpieza del parque?",
    c: [["luisperez", "Yo puedo conseguir bolsas y guantes.", 100]] },
  { a: "julianaescobar", g: "barrio", hace: 4200, likes: 6, t: "Granada: encuentro de vecinos el viernes para hablar de los espacios públicos del sector. Todos bienvenidos.", c: [] },
  { a: "juliancardenas", g: "municipio", hace: 4320, likes: 6, t: "Soy docente de matemáticas en Suba. Si hay profesores en la red, armemos un espacio para compartir material de clase. #educación",
    c: [["andresquintero", "Soy profesor de historia, me interesa. Hagámoslo.", 80]] },
  { a: "isabelagiraldo", g: "barrio", hace: 4300, likes: 3, t: "Belén: ¿hay vecinos interesados en reunirnos una vez al mes? Podemos empezar con un café.", c: [] },
  { a: "estebanrios", g: null, hace: 600, likes: 5, t: "Estoy armando mi hoja de vida desde cero y quiero consejos de quienes ya pasaron por procesos de selección. ¿Alguien me ayuda? #empleo",
    c: [["ximenabeltran", "Con gusto te reviso el borrador.", 30], ["valeriamontoya", "Yo también te puedo orientar con el perfil profesional.", 65]] },
  { a: "jorgebarrera", g: "barrio", hace: 5760, likes: 5, t: "¿Alguien más sale a caminar por el sendero del parque en las mañanas? Podríamos armar un grupo de trote suave a las 6 a. m.",
    c: [["lauragomez", "Cuenten conmigo los sábados.", 200]] },
  { a: "marianatamara", g: null, hace: 7200, likes: 2, t: "Hola, soy nueva en la comunidad. ¿Hay más personas de Cartagena por aquí?", c: [] },
  { a: "diegoherrera", g: null, hace: 7000, likes: 3, t: "Gracias por la bienvenida, comunidad. Desde Bucaramanga con ganas de aportar.",
    c: [["nataliaserrano", "Bienvenido, Diego. Nos vemos en los talleres.", 40]] },
];

/* ------------------------------------------------------------------ acciones */

const MARCA_CORREO = "demo.%@example.com";

async function idsDemo() {
  const { data, error } = await c.from("miembros").select("id,usuario").like("email", MARCA_CORREO).like("cedula", "9999%").like("usuario", "demo\\_%").eq("es_oficial", false);
  if (error) throw error;
  return data ?? [];
}

async function quitar(silencioso = false) {
  const demo = await idsDemo();
  if (demo.length) {
    const { error } = await c.from("miembros").delete().in("id", demo.map((d) => d.id)); // cascada: publicaciones, comentarios, me gusta, seguidores y grupos
    if (error) throw error;
  }
  // Los grupos que se quedaron sin ningún afiliado (los creó la demostración) ya no sirven.
  const [{ data: grupos }, { data: filas }] = await Promise.all([c.from("grupos").select("id"), c.from("grupo_miembros").select("grupo_id")]);
  const conGente = new Set((filas ?? []).map((f) => f.grupo_id));
  const vacios = (grupos ?? []).filter((g) => !conGente.has(g.id)).map((g) => g.id);
  if (vacios.length) await c.from("grupos").delete().in("id", vacios);
  if (!silencioso) console.log(`Quitados ${demo.length} afiliados de demostración (y todo lo suyo) y ${vacios.length} grupos vacíos.`);
}

async function estado() {
  const cuenta = async (t) => (await c.from(t).select("*", { count: "exact", head: true })).count ?? 0;
  const demo = await idsDemo();
  const { data: reales } = await c.from("miembros").select("usuario").eq("es_oficial", false).not("email", "like", MARCA_CORREO);
  console.log({ proyecto: new URL(url).hostname.split(".")[0], afiliadosDemo: demo.length, afiliadosReales: (reales ?? []).map((r) => r.usuario), miembros: await cuenta("miembros"), seguidores: await cuenta("seguidores"), grupos: await cuenta("grupos"), publicaciones: await cuenta("publicaciones"), comentarios: await cuenta("comentarios"), meGusta: await cuenta("me_gusta") });
}

async function sembrar(para) {
  await quitar(true);

  // Cuenta real a la que se conecta la demostración.
  const { data: reales } = await c.from("miembros").select("id,usuario,departamento").eq("es_oficial", false).not("email", "like", MARCA_CORREO);
  let real = null;
  if (para) real = (reales ?? []).find((r) => r.usuario === para) ?? null;
  else if ((reales ?? []).length === 1) real = reales[0];
  if (!real) console.log("(No se conectó ninguna cuenta real: indica `--para <usuario>` si quieres que siga a algunos y tenga seguidores.)");

  // 1) Afiliados de demostración.
  const filas = PERSONAS.map(([clave, nombres, apellidos, nac, [departamento, municipio], barrio, bio], i) => ({
    usuario: `demo_${clave}`,
    cedula: `9999${String(i + 1).padStart(6, "0")}`,
    nombres,
    apellidos,
    fecha_nacimiento: nac,
    email: `demo.${clave}@example.com`,
    telefono: `3000000${String(i + 1).padStart(3, "0")}`,
    departamento,
    municipio,
    barrio,
    direccion: "Dirección de demostración",
    password_hash: "sin-acceso",
    bio: `Cuenta de demostración. ${bio}`,
    consentimiento_en: new Date().toISOString(),
    creado_en: hace((PERSONAS.length - i) * 1300 + 600),
  }));
  const { data: creados, error: e1 } = await c.from("miembros").insert(filas).select("id,usuario,municipio,barrio");
  if (e1) throw e1;
  const porClave = new Map(creados.map((m) => [m.usuario.replace(/^demo_/, ""), m]));

  // 2) Grupos del municipio y del barrio (mismos slugs que usa el registro real) y su pertenencia.
  const lugares = new Map();
  for (const m of creados) {
    lugares.set(`municipio-${slug(m.municipio)}`, { slug: `municipio-${slug(m.municipio)}`, nombre: m.municipio, tipo: "municipio" });
    lugares.set(`barrio-${slug(m.municipio)}-${slug(m.barrio)}`, { slug: `barrio-${slug(m.municipio)}-${slug(m.barrio)}`, nombre: `${m.barrio} · ${m.municipio}`, tipo: "barrio" });
  }
  const { data: grupos, error: e2 } = await c.from("grupos").upsert([...lugares.values()], { onConflict: "slug" }).select("id,slug");
  if (e2) throw e2;
  const grupoId = new Map(grupos.map((g) => [g.slug, g.id]));
  const gMun = (m) => grupoId.get(`municipio-${slug(m.municipio)}`);
  const gBar = (m) => grupoId.get(`barrio-${slug(m.municipio)}-${slug(m.barrio)}`);
  const { error: e3 } = await c.from("grupo_miembros").upsert(creados.flatMap((m) => [{ grupo_id: gMun(m), miembro_id: m.id }, { grupo_id: gBar(m), miembro_id: m.id }]));
  if (e3) throw e3;

  // 3) Quién sigue a quién: cada cuenta sigue a 4–7 más, casi siempre de su ciudad.
  const sigue = new Set();
  for (const m of creados) {
    const mismos = barajar(creados.filter((o) => o.id !== m.id && o.municipio === m.municipio));
    const otros = barajar(creados.filter((o) => o.id !== m.id && o.municipio !== m.municipio));
    const cuantos = 4 + Math.floor(azar() * 4);
    for (const o of [...mismos.slice(0, Math.min(mismos.length, cuantos - 1)), ...otros].slice(0, cuantos)) sigue.add(`${m.id}|${o.id}`);
  }
  const seguidores = [...sigue].map((p) => ({ seguidor_id: p.split("|")[0], seguido_id: p.split("|")[1] }));
  if (real) {
    for (const k of REAL_SIGUE) seguidores.push({ seguidor_id: real.id, seguido_id: porClave.get(k).id });
    for (const k of REAL_LO_SIGUEN) seguidores.push({ seguidor_id: porClave.get(k).id, seguido_id: real.id });
  }
  const { error: e4 } = await c.from("seguidores").upsert(seguidores);
  if (e4) throw e4;

  // 4) Publicaciones, comentarios y me gusta.
  let nPub = 0, nCom = 0, nLike = 0;
  for (const p of PUBLICACIONES) {
    const autor = porClave.get(p.a);
    const grupo_id = p.g === "barrio" ? gBar(autor) : p.g === "municipio" ? gMun(autor) : null;
    const { data: pub, error } = await c.from("publicaciones").insert({ autor_id: autor.id, grupo_id, texto: p.t, creado_en: hace(p.hace) }).select("id").single();
    if (error) throw error;
    nPub++;
    if (p.c.length) {
      const { error: ec } = await c.from("comentarios").insert(p.c.map(([quien, texto, despues]) => ({ publicacion_id: pub.id, autor_id: porClave.get(quien).id, texto, creado_en: hace(Math.max(1, p.hace - despues)) })));
      if (ec) throw ec;
      nCom += p.c.length;
    }
    const quienes = barajar(creados.filter((m) => m.id !== autor.id)).slice(0, p.likes);
    if (quienes.length) {
      const { error: el } = await c.from("me_gusta").insert(quienes.map((m) => ({ publicacion_id: pub.id, miembro_id: m.id })));
      if (el) throw el;
      nLike += quienes.length;
    }
  }
  console.log(`Sembrados ${creados.length} afiliados, ${lugares.size} grupos, ${seguidores.length} relaciones de seguimiento, ${nPub} publicaciones, ${nCom} comentarios y ${nLike} «me gusta».`);
  if (real) console.log(`Conectada la cuenta @${real.usuario}: sigue a ${REAL_SIGUE.length} cuentas de demostración y la siguen ${REAL_LO_SIGUEN.length}.`);
}

const [, , orden, ...resto] = process.argv;
const para = resto.includes("--para") ? resto[resto.indexOf("--para") + 1] : undefined;
try {
  if (orden === "sembrar") await sembrar(para);
  else if (orden === "quitar") await quitar();
  else if (orden === "estado") await estado();
  else console.log("Uso: node --env-file=.env.local scripts/comunidad-demo.mjs sembrar [--para <usuario>] | quitar | estado");
} catch (e) {
  console.error("Falló:", e?.message ?? e);
  process.exit(1);
}
