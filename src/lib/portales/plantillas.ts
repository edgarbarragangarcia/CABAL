/**
 * Plantillas de portales temáticos (DEMOSTRACIÓN): salud, belleza, motos y carros, y cuidado en el hogar.
 *
 * Es solo datos (sin React) para poder usarse igual en el servidor, en el generador del panel y en la página pública.
 * Todo el contenido es de EJEMPLO: los proveedores y los testimonios son ficticios y así se rotulan en pantalla.
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

export const PLANTILLAS: Plantilla[] = [
  {
    id: "salud",
    nombre: "Salud",
    descripcion: "Citas médicas, laboratorio, salud mental y telemedicina en un solo lugar.",
    icono: "stethoscope",
    nombreEjemplo: "SaludCerca",
    colorPrimario: "#0f766e",
    hero: {
      titulo: "Tu salud, a un clic de distancia",
      subtitulo: "Encuentra médicos, laboratorios y terapias de confianza en tu ciudad y agenda tu cita sin filas ni llamadas.",
      cta: "Agendar una cita",
      ctaSecundaria: "Ver especialidades",
      puntos: ["Profesionales verificados", "Agenda en línea las 24 horas", "Recordatorios de tus citas"],
    },
    servicios: {
      titulo: "Todo para cuidar tu salud",
      items: [
        { icono: "stethoscope", titulo: "Medicina general", texto: "Consulta de control, chequeos y orientación para toda la familia." },
        { icono: "heartbeat", titulo: "Especialistas", texto: "Cardiología, dermatología, pediatría, ginecología y más." },
        { icono: "flask", titulo: "Laboratorio clínico", texto: "Exámenes con resultados en línea y toma de muestras a domicilio." },
        { icono: "brain", titulo: "Salud mental", texto: "Psicología y acompañamiento emocional, presencial o virtual." },
        { icono: "tooth", titulo: "Odontología", texto: "Prevención, ortodoncia y tratamientos con agenda flexible." },
        { icono: "video", titulo: "Telemedicina", texto: "Consultas por videollamada desde donde estés." },
      ],
    },
    pasos: {
      titulo: "Cómo funciona",
      items: [
        { titulo: "Busca", texto: "Elige la especialidad, la ciudad y el horario que te sirva." },
        { titulo: "Compara", texto: "Revisa el perfil, la experiencia y la disponibilidad de cada profesional." },
        { titulo: "Agenda", texto: "Confirma tu cita y recibe el recordatorio en tu celular." },
      ],
    },
    proveedores: {
      titulo: "Profesionales y centros",
      items: [
        { nombre: "Centro Médico Ejemplo", especialidad: "Medicina general · Pediatría", detalle: "Atención de lunes a sábado" },
        { nombre: "Laboratorio Ejemplo", especialidad: "Laboratorio clínico", detalle: "Toma de muestras a domicilio" },
        { nombre: "Consultorio Ejemplo", especialidad: "Psicología", detalle: "Sesiones presenciales y virtuales" },
      ],
    },
    testimonios: {
      titulo: "Lo que dicen los usuarios",
      items: [
        { texto: "Pude agendar a mi mamá con el cardiólogo en dos minutos, sin hacer fila.", autor: "Usuaria de ejemplo", rol: "Bogotá" },
        { texto: "Los resultados del laboratorio llegaron a mi correo el mismo día.", autor: "Usuario de ejemplo", rol: "Medellín" },
      ],
    },
    preguntas: {
      titulo: "Preguntas frecuentes",
      items: [
        { pregunta: "¿Cómo agendo una cita?", respuesta: "Elige la especialidad, escoge un horario disponible y confirma. Recibirás un recordatorio antes de la cita." },
        { pregunta: "¿Qué EPS o seguros aceptan?", respuesta: "Cada profesional indica en su perfil las aseguradoras con las que trabaja." },
        { pregunta: "¿Sirve para urgencias?", respuesta: "No. Este portal no reemplaza la atención de urgencias: ante una emergencia llama a la línea 123 o acude al servicio de urgencias más cercano." },
      ],
    },
    aviso: "La información de este portal es orientativa y no reemplaza la consulta con un profesional de la salud.",
  },
  {
    id: "belleza",
    nombre: "Belleza",
    descripcion: "Reservas de peluquería, uñas, estética y spa con profesionales cerca de ti.",
    icono: "sparkle",
    nombreEjemplo: "Bella Cita",
    colorPrimario: "#9f1d4f",
    hero: {
      titulo: "Belleza y bienestar, sin complicarte",
      subtitulo: "Reserva peluquería, uñas, estética y spa con profesionales cerca de ti, en el horario que prefieras.",
      cta: "Reservar ahora",
      ctaSecundaria: "Ver servicios",
      puntos: ["Reserva en segundos", "Profesionales verificados", "Promociones por temporada"],
    },
    servicios: {
      titulo: "Servicios para verte y sentirte bien",
      items: [
        { icono: "scissors", titulo: "Peluquería y color", texto: "Cortes, peinados, tintes y tratamientos capilares." },
        { icono: "razor", titulo: "Barbería", texto: "Corte, perfilado de barba y cuidado masculino." },
        { icono: "hand", titulo: "Manicure y pedicure", texto: "Esmaltado tradicional, semipermanente y diseños." },
        { icono: "brush", titulo: "Maquillaje", texto: "Maquillaje social, de novia y para eventos." },
        { icono: "flower", titulo: "Spa y masajes", texto: "Masajes relajantes, descontracturantes y aromaterapia." },
        { icono: "sparkle", titulo: "Estética facial", texto: "Limpiezas, hidratación y cuidado de la piel." },
      ],
    },
    pasos: {
      titulo: "Reserva en tres pasos",
      items: [
        { titulo: "Elige tu servicio", texto: "Peluquería, uñas, spa… escoge lo que necesitas." },
        { titulo: "Escoge profesional y hora", texto: "Mira la agenda disponible y reserva el espacio que prefieras." },
        { titulo: "Disfruta tu cita", texto: "Te recordamos el día anterior para que no se te pase." },
      ],
    },
    proveedores: {
      titulo: "Salones y profesionales",
      items: [
        { nombre: "Salón Ejemplo", especialidad: "Peluquería y color", detalle: "Martes a domingo" },
        { nombre: "Barbería Ejemplo", especialidad: "Cortes y barba", detalle: "Agenda abierta toda la semana" },
        { nombre: "Spa Ejemplo", especialidad: "Masajes y estética", detalle: "Paquetes para dos personas" },
      ],
    },
    testimonios: {
      titulo: "Clientes felices",
      items: [
        { texto: "Reservé mi manicure desde el celular y llegué justo a la hora, sin esperar.", autor: "Clienta de ejemplo", rol: "Cali" },
        { texto: "Encontré una barbería a dos cuadras de mi casa que no conocía.", autor: "Cliente de ejemplo", rol: "Bogotá" },
      ],
    },
    preguntas: {
      titulo: "Preguntas frecuentes",
      items: [
        { pregunta: "¿Puedo cancelar o reprogramar mi reserva?", respuesta: "Sí, desde el enlace de tu confirmación hasta unas horas antes de la cita." },
        { pregunta: "¿Cómo pago?", respuesta: "Cada establecimiento indica en su perfil los medios de pago que recibe." },
        { pregunta: "¿Hay promociones?", respuesta: "Los establecimientos publican descuentos por temporada que verás en su perfil." },
      ],
    },
  },
  {
    id: "motos-autos",
    nombre: "Motos y carros",
    descripcion: "Talleres, repuestos, revisión y seguros para mantener tu vehículo al día.",
    icono: "car",
    nombreEjemplo: "MotoCar Ruta",
    colorPrimario: "#c2410c",
    hero: {
      titulo: "Tu moto y tu carro, siempre listos",
      subtitulo: "Encuentra talleres, repuestos y servicios de confianza para mantener tu vehículo al día y rodar tranquilo.",
      cta: "Cotizar un servicio",
      ctaSecundaria: "Ver servicios",
      puntos: ["Talleres verificados", "Cotización en línea", "Recordatorios de mantenimiento"],
    },
    servicios: {
      titulo: "Todo para tu vehículo",
      items: [
        { icono: "wrench", titulo: "Mecánica general", texto: "Mantenimiento preventivo, frenos, suspensión y diagnóstico." },
        { icono: "paint", titulo: "Latonería y pintura", texto: "Reparación de golpes, pintura y brillado." },
        { icono: "tire", titulo: "Llantas y alineación", texto: "Cambio, balanceo, alineación y rotación." },
        { icono: "clipboard", titulo: "Revisión técnico-mecánica", texto: "Preparación y trámite de la revisión anual." },
        { icono: "shield", titulo: "SOAT y seguros", texto: "Cotiza y compara pólizas para moto y carro." },
        { icono: "gear", titulo: "Repuestos y accesorios", texto: "Piezas originales y alternativas para tu marca y modelo." },
      ],
    },
    pasos: {
      titulo: "Cómo funciona",
      items: [
        { titulo: "Cuéntanos tu vehículo", texto: "Marca, modelo, año y el servicio que necesitas." },
        { titulo: "Recibe cotizaciones", texto: "Compara precios y tiempos de varios talleres." },
        { titulo: "Agenda y haz seguimiento", texto: "Elige el taller, reserva el turno y sigue el avance." },
      ],
    },
    proveedores: {
      titulo: "Talleres y aliados",
      items: [
        { nombre: "Taller Ejemplo", especialidad: "Mecánica general · carros y motos", detalle: "Lunes a sábado" },
        { nombre: "Llantería Ejemplo", especialidad: "Llantas y alineación", detalle: "Servicio sin cita" },
        { nombre: "Latonería Ejemplo", especialidad: "Latonería y pintura", detalle: "Cotización en 24 horas" },
      ],
    },
    testimonios: {
      titulo: "Opiniones de conductores",
      items: [
        { texto: "Comparé tres cotizaciones de frenos en cinco minutos y escogí la mejor.", autor: "Conductor de ejemplo", rol: "Bogotá" },
        { texto: "Me avisaron cuándo tocaba el mantenimiento de la moto, ya no se me olvida.", autor: "Motociclista de ejemplo", rol: "Bucaramanga" },
      ],
    },
    preguntas: {
      titulo: "Preguntas frecuentes",
      items: [
        { pregunta: "¿Atienden motos y carros?", respuesta: "Sí. Cada taller indica en su perfil qué tipos de vehículo y marcas atiende." },
        { pregunta: "¿La cotización tiene costo?", respuesta: "No. Solicitar y comparar cotizaciones no tiene costo." },
        { pregunta: "¿Cómo sé que el taller es de confianza?", respuesta: "Los talleres pasan por una verificación básica y muestran su experiencia y servicios." },
      ],
    },
  },
  {
    id: "hogar-cuidado",
    nombre: "Cuidado en el hogar",
    descripcion: "Cuidadores, enfermería y terapias a domicilio para adultos mayores, niños y personas en recuperación.",
    icono: "house",
    nombreEjemplo: "CuidaEnCasa",
    colorPrimario: "#2f6f4e",
    hero: {
      titulo: "Cuidado y apoyo para tu familia, en casa",
      subtitulo: "Conecta con cuidadores, enfermería y terapias a domicilio de confianza para adultos mayores, niños y personas en recuperación.",
      cta: "Solicitar cuidado",
      ctaSecundaria: "Ver servicios",
      puntos: ["Personal verificado", "Planes por horas o por turnos", "Seguimiento para la familia"],
    },
    servicios: {
      titulo: "Servicios a domicilio",
      items: [
        { icono: "wheelchair", titulo: "Cuidado de adultos mayores", texto: "Acompañamiento, aseo personal y apoyo en la rutina diaria." },
        { icono: "firstaid", titulo: "Enfermería a domicilio", texto: "Curaciones, toma de signos y administración de medicamentos formulados." },
        { icono: "handheart", titulo: "Acompañamiento y compañía", texto: "Conversación, paseos y apoyo emocional para quien lo necesita." },
        { icono: "walk", titulo: "Fisioterapia en casa", texto: "Rehabilitación y ejercicios guiados sin salir del hogar." },
        { icono: "baby", titulo: "Cuidado infantil", texto: "Niñeras y cuidadores con experiencia y referencias." },
        { icono: "broom", titulo: "Aseo y mantenimiento", texto: "Limpieza y pequeños arreglos para mantener la casa en orden." },
      ],
    },
    pasos: {
      titulo: "Cómo funciona",
      items: [
        { titulo: "Cuéntanos qué necesitas", texto: "Tipo de cuidado, horarios y datos de la persona." },
        { titulo: "Conoce a quienes están disponibles", texto: "Revisa perfiles, experiencia y referencias." },
        { titulo: "Inicia el servicio", texto: "Recibe novedades y acompaña el cuidado desde tu celular." },
      ],
    },
    proveedores: {
      titulo: "Prestadores de cuidado",
      items: [
        { nombre: "Cuidadores Ejemplo", especialidad: "Adultos mayores", detalle: "Turnos de 8 y 12 horas" },
        { nombre: "Enfermería Ejemplo", especialidad: "Curaciones y medicamentos", detalle: "Visitas programadas" },
        { nombre: "Terapias Ejemplo", especialidad: "Fisioterapia a domicilio", detalle: "Planes por sesiones" },
      ],
    },
    testimonios: {
      titulo: "Familias que ya cuentan con apoyo",
      items: [
        { texto: "Encontramos una cuidadora para mi papá en dos días y nos mandan novedades todos los días.", autor: "Familiar de ejemplo", rol: "Bogotá" },
        { texto: "La fisioterapia en casa le ahorró a mi mamá los traslados.", autor: "Familiar de ejemplo", rol: "Medellín" },
      ],
    },
    preguntas: {
      titulo: "Preguntas frecuentes",
      items: [
        { pregunta: "¿Cómo se verifica al personal?", respuesta: "Cada prestador muestra su experiencia y referencias; la verificación completa es parte de la puesta en marcha del portal." },
        { pregunta: "¿Puedo contratar por horas?", respuesta: "Sí, hay planes por horas, por turnos y por días, según el prestador." },
        { pregunta: "¿Reemplaza la atención médica?", respuesta: "No. Los servicios de cuidado acompañan, pero no sustituyen la valoración de un profesional de la salud." },
      ],
    },
    aviso: "Este portal conecta con prestadores de servicios de cuidado y no reemplaza la atención médica.",
  },
];

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

export const SECCIONES: { id: keyof SeccionesPortal; texto: string }[] = [
  { id: "servicios", texto: "Servicios" },
  { id: "pasos", texto: "Cómo funciona" },
  { id: "proveedores", texto: "Proveedores" },
  { id: "testimonios", texto: "Testimonios" },
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
    secciones: { servicios: true, pasos: true, proveedores: true, testimonios: true, preguntas: true, contacto: true },
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
