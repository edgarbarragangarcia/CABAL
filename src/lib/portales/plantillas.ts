/**
 * Plantillas de portales temáticos: salud, belleza, motos y carros, y cuidado en el hogar.
 *
 * Cada portal es una COMUNIDAD, no un servicio: informa (noticias, guías, actualidad), convoca (eventos) y reúne gente (un CRM
 * propio por portal). No agenda citas, no cotiza ni presta servicios: por eso las plantillas no traen proveedores ni
 * testimonios (serían inventados) y sus textos hablan de participar, no de contratar.
 *
 * Es solo datos (sin React) para poder usarse igual en el servidor, en el generador del panel y en la página pública.
 * Los íconos se nombran con un identificador y el visor (`components/portales/portal-view.tsx`) los traduce a Phosphor.
 */

export type PlantillaId = "salud" | "belleza" | "motos-autos" | "hogar-cuidado";

export type Servicio = { icono: string; titulo: string; texto: string };
export type Paso = { titulo: string; texto: string };
export type Proveedor = { nombre: string; especialidad: string; detalle: string };
export type Testimonio = { texto: string; autor: string; rol: string };
export type Pregunta = { pregunta: string; respuesta: string };

export type Plantilla = {
  id: PlantillaId;
  nombre: string;
  descripcion: string;
  icono: string;
  /** Marca de ejemplo con la que arranca el generador. */
  nombreEjemplo: string;
  colorPrimario: string;
  hero: { titulo: string; subtitulo: string; cta: string; ctaSecundaria: string; puntos: string[] };
  servicios: { titulo: string; items: Servicio[] };
  pasos: { titulo: string; items: Paso[] };
  proveedores: { titulo: string; items: Proveedor[] };
  testimonios: { titulo: string; items: Testimonio[] };
  preguntas: { titulo: string; items: Pregunta[] };
  aviso?: string;
};

/** Los pasos de «Cómo participar» son los mismos en todas las comunidades: cambia el tema, no el camino. */
const PASOS_COMUNIDAD = (tema: string): { titulo: string; items: Paso[] } => ({
  titulo: "Cómo participar",
  items: [
    { titulo: "Infórmate", texto: `Lee las noticias, guías y análisis sobre ${tema} que publica este portal.` },
    { titulo: "Súmate", texto: "Déjanos tus datos y recibe lo que te interesa: novedades e invitaciones a eventos." },
    { titulo: "Participa", texto: "Asiste a los encuentros, comparte tus ideas y ayuda a que más personas se unan." },
  ],
});

const SIN_PERSONAS = { proveedores: { titulo: "", items: [] as Proveedor[] }, testimonios: { titulo: "", items: [] as Testimonio[] } };

const PREGUNTAS_COMUNES = (tema: string, nota: string): { titulo: string; items: Pregunta[] } => ({
  titulo: "Preguntas frecuentes",
  items: [
    { pregunta: "¿Qué es este portal?", respuesta: `Una comunidad para informarse y participar en torno a ${tema}: noticias, guías, eventos y una red de personas. ${nota}` },
    { pregunta: "¿Cuesta algo unirse?", respuesta: "No. Sumarte y asistir a los eventos es gratis." },
    { pregunta: "¿Qué hacen con mis datos?", respuesta: "Los usamos solo para enviarte lo que elegiste (novedades e invitaciones). Puedes pedir en cualquier momento que los actualicemos o los borremos." },
    { pregunta: "¿Quién está detrás?", respuesta: "Es una iniciativa de la comunidad de María Fernanda Cabal y la Fundación Escuela Libertad." },
  ],
});

export const PLANTILLAS: Plantilla[] = [
  {
    id: "salud",
    nombre: "Salud",
    descripcion: "Una comunidad para informarse, conversar y organizarse en torno a la salud: noticias, guías, eventos y gente que se acompaña.",
    icono: "stethoscope",
    nombreEjemplo: "Salud en Comunidad",
    colorPrimario: "#0f766e",
    hero: {
      titulo: "Entre todos, una comunidad que cuida la salud",
      subtitulo: "Noticias claras sobre salud y derechos del paciente, eventos para aprender y participar, y una red de personas que se acompañan.",
      cta: "Quiero sumarme",
      ctaSecundaria: "Ver próximos eventos",
      puntos: ["Noticias y guías confiables", "Eventos y jornadas", "Una red que se acompaña"],
    },
    servicios: {
      titulo: "Lo que encontrarás en la comunidad",
      items: [
        { icono: "clipboard", titulo: "Actualidad en salud", texto: "Lo que cambia en el sistema de salud y lo que significa para ti, explicado sin tecnicismos." },
        { icono: "heartbeat", titulo: "Guías prácticas", texto: "Pasos concretos para prevenir, cuidarte y resolver trámites cotidianos." },
        { icono: "hand", titulo: "Encuentros y jornadas", texto: "Charlas, foros y jornadas para aprender y conocer a quienes trabajan por lo mismo." },
        { icono: "brain", titulo: "Salud mental", texto: "Conversación y herramientas para cuidar el bienestar emocional." },
        { icono: "shield", titulo: "Derechos del paciente", texto: "Qué puedes exigir y a dónde acudir cuando algo no funciona." },
        { icono: "handheart", titulo: "Voces de la comunidad", texto: "Experiencias de personas como tú y propuestas para mejorar." },
      ],
    },
    pasos: PASOS_COMUNIDAD("salud"),
    ...SIN_PERSONAS,
    preguntas: PREGUNTAS_COMUNES("la salud", "No agenda citas ni reemplaza la atención de un profesional."),
    aviso: "La información de este portal es orientativa y no reemplaza la consulta con un profesional de la salud.",
  },
  {
    id: "belleza",
    nombre: "Belleza",
    descripcion: "Una comunidad para quienes viven de la belleza y el bienestar: tendencias, noticias del sector, talleres y encuentros.",
    icono: "sparkle",
    nombreEjemplo: "Comunidad Belleza",
    colorPrimario: "#9f1d4f",
    hero: {
      titulo: "La comunidad de quienes viven de la belleza y el bienestar",
      subtitulo: "Tendencias, noticias del sector, talleres y encuentros para profesionales, emprendedores y amantes del cuidado personal.",
      cta: "Quiero sumarme",
      ctaSecundaria: "Ver próximos eventos",
      puntos: ["Tendencias y noticias del sector", "Talleres y encuentros", "Una red de profesionales"],
    },
    servicios: {
      titulo: "Lo que encontrarás en la comunidad",
      items: [
        { icono: "sparkle", titulo: "Tendencias", texto: "Qué se está usando y cómo adaptarlo a distintos estilos y presupuestos." },
        { icono: "flower", titulo: "Cuidados paso a paso", texto: "Rutinas y hábitos explicados para que cualquiera pueda seguirlos." },
        { icono: "gear", titulo: "Para emprendedores del sector", texto: "Ideas, normas y novedades para sacar adelante un negocio de belleza." },
        { icono: "brush", titulo: "Talleres y capacitaciones", texto: "Encuentros para aprender técnicas nuevas y compartir con colegas." },
        { icono: "scissors", titulo: "Noticias del sector", texto: "Lo que pasa en la industria de la belleza en Colombia." },
        { icono: "handheart", titulo: "Historias de la comunidad", texto: "Personas y proyectos que inspiran, contados por quienes los viven." },
      ],
    },
    pasos: PASOS_COMUNIDAD("belleza y bienestar"),
    ...SIN_PERSONAS,
    preguntas: PREGUNTAS_COMUNES("la belleza y el bienestar", "No vende servicios ni agenda citas."),
  },
  {
    id: "motos-autos",
    nombre: "Motos y carros",
    descripcion: "Una comunidad de conductores y moteros: noticias y normas al día, seguridad vial, mantenimiento y encuentros.",
    icono: "car",
    nombreEjemplo: "Comunidad Ruta",
    colorPrimario: "#c2410c",
    hero: {
      titulo: "La comunidad de quienes viven sobre ruedas",
      subtitulo: "Noticias, normas y trámites al día, seguridad vial y encuentros para conductores, moteros y quienes trabajan en el sector.",
      cta: "Quiero sumarme",
      ctaSecundaria: "Ver próximos eventos",
      puntos: ["Noticias y normas al día", "Seguridad vial", "Encuentros y rodadas"],
    },
    servicios: {
      titulo: "Lo que encontrarás en la comunidad",
      items: [
        { icono: "clipboard", titulo: "Actualidad del sector", texto: "Normas, cambios y noticias que afectan a conductores y moteros." },
        { icono: "shield", titulo: "Trámites al día", texto: "SOAT, revisión técnico-mecánica y traspasos explicados paso a paso." },
        { icono: "car", titulo: "Seguridad vial", texto: "Hábitos y campañas para llegar bien, cada vez." },
        { icono: "wrench", titulo: "Mantenimiento", texto: "Qué revisar y cada cuánto, sin tecnicismos." },
        { icono: "moto", titulo: "Encuentros y rodadas", texto: "Reuniones y salidas de la comunidad para conocerse y apoyarse." },
        { icono: "handheart", titulo: "Voces de la ruta", texto: "Experiencias y propuestas de quienes ruedan todos los días." },
      ],
    },
    pasos: PASOS_COMUNIDAD("motos y carros"),
    ...SIN_PERSONAS,
    preguntas: PREGUNTAS_COMUNES("el mundo de las motos y los carros", "No vende repuestos ni cotiza servicios."),
    aviso: "Consulta siempre las normas y los costos vigentes en las entidades oficiales.",
  },
  {
    id: "hogar-cuidado",
    nombre: "Cuidado en el hogar",
    descripcion: "Una comunidad para quienes cuidan en casa a adultos mayores, niños o personas en recuperación: guías, apoyos y encuentros.",
    icono: "house",
    nombreEjemplo: "Comunidad de Cuidadores",
    colorPrimario: "#2f6f4e",
    hero: {
      titulo: "Cuidar es más fácil en comunidad",
      subtitulo: "Guías, noticias, apoyos disponibles y encuentros para quienes cuidan en casa a adultos mayores, niños o personas en recuperación.",
      cta: "Quiero sumarme",
      ctaSecundaria: "Ver próximos eventos",
      puntos: ["Guías para cuidadores", "Apoyos y trámites", "Espacios para compartir"],
    },
    servicios: {
      titulo: "Lo que encontrarás en la comunidad",
      items: [
        { icono: "house", titulo: "Guías de cuidado", texto: "Cómo acompañar el día a día en casa, con calma y paso a paso." },
        { icono: "shield", titulo: "Apoyos y trámites", texto: "Qué ayudas existen y cómo solicitarlas." },
        { icono: "handheart", titulo: "Para el cuidador", texto: "Descanso, organización y cómo pedir ayuda sin culpa." },
        { icono: "hand", titulo: "Encuentros", texto: "Espacios para compartir experiencias con otras familias." },
        { icono: "wheelchair", titulo: "Hogar seguro", texto: "Listas para adaptar la casa y prevenir accidentes." },
        { icono: "clipboard", titulo: "Actualidad", texto: "Noticias y cambios que importan a quienes cuidan." },
      ],
    },
    pasos: PASOS_COMUNIDAD("el cuidado en casa"),
    ...SIN_PERSONAS,
    preguntas: PREGUNTAS_COMUNES("el cuidado en el hogar", "No presta servicios de cuidado ni reemplaza la atención médica."),
    aviso: "Este contenido es informativo y no reemplaza la valoración de un profesional de la salud.",
  },
];

/**
 * Los textos de arranque que tenían las plantillas cuando eran de servicios (reservar, cotizar, agendar). Los portales guardados
 * con esos textos sin tocar se actualizan solos a los de comunidad al leerlos; si la persona los editó, se respetan.
 */
export const TEXTOS_ANTERIORES: Record<PlantillaId, { titulo: string; eslogan: string; cta: string }> = {
  salud: { titulo: "Tu salud, a un clic de distancia", eslogan: "Encuentra médicos, laboratorios y terapias de confianza en tu ciudad y agenda tu cita sin filas ni llamadas.", cta: "Agendar una cita" },
  belleza: { titulo: "Belleza y bienestar, sin complicarte", eslogan: "Reserva peluquería, uñas, estética y spa con profesionales cerca de ti, en el horario que prefieras.", cta: "Reservar ahora" },
  "motos-autos": { titulo: "Tu moto y tu carro, siempre listos", eslogan: "Encuentra talleres, repuestos y servicios de confianza para mantener tu vehículo al día y rodar tranquilo.", cta: "Cotizar un servicio" },
  "hogar-cuidado": { titulo: "Cuidado y apoyo para tu familia, en casa", eslogan: "Conecta con cuidadores, enfermería y terapias a domicilio de confianza para adultos mayores, niños y personas en recuperación.", cta: "Solicitar cuidado" },
};

export const plantillaPorId = (id: string) => PLANTILLAS.find((p) => p.id === id);

/* ------------------------------------------------------------ configuración */

export type SeccionesPortal = { servicios: boolean; pasos: boolean; proveedores: boolean; testimonios: boolean; preguntas: boolean; contacto: boolean };

/** Lo que el generador deja personalizar de una plantilla. El resto del contenido sale de la plantilla. */
export type ConfigPortal = {
  nombre: string;
  ciudad: string;
  titulo: string;
  eslogan: string;
  cta: string;
  colorPrimario: string;
  whatsapp: string;
  correo: string;
  secciones: SeccionesPortal;
};

/** Las secciones que el generador deja prender o apagar. «Proveedores» y «testimonios» ya no existen: las comunidades no los llevan. */
export const SECCIONES: { id: keyof SeccionesPortal; texto: string }[] = [
  { id: "servicios", texto: "Lo que encontrarás" },
  { id: "pasos", texto: "Cómo participar" },
  { id: "preguntas", texto: "Preguntas frecuentes" },
  { id: "contacto", texto: "Contacto" },
];

export function configPorDefecto(id: PlantillaId): ConfigPortal {
  const p = plantillaPorId(id) ?? PLANTILLAS[0];
  return {
    nombre: p.nombreEjemplo,
    ciudad: "Bogotá",
    titulo: p.hero.titulo,
    eslogan: p.hero.subtitulo,
    cta: p.hero.cta,
    colorPrimario: p.colorPrimario,
    whatsapp: "",
    correo: "",
    secciones: { servicios: true, pasos: true, proveedores: false, testimonios: false, preguntas: true, contacto: true },
  };
}

/**
 * Configuración con la que se muestran las plantillas de demostración: la de arranque más un correo de ejemplo (el dominio
 * example.com está reservado para documentación y no llega a nadie), para que la sección de contacto se vea completa.
 */
export const configDemo = (id: PlantillaId): ConfigPortal => ({ ...configPorDefecto(id), correo: "hola@example.com" });

/** Colores sugeridos en el generador (sobrios, de contraste suficiente con texto blanco). */
export const COLORES_SUGERIDOS = ["#0f766e", "#9f1d4f", "#c2410c", "#2f6f4e", "#1d4ed8", "#6d28d9", "#0a4f37", "#334155"];

export const quitarTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const slugPortal = (nombre: string) => quitarTildes(nombre).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
