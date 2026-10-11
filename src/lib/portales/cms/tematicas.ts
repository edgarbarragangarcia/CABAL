import type { PlantillaId } from "../plantillas";

/**
 * Cada portal es un CMS propio y distinto según su temática: qué secciones de contenido tiene, qué tipos de artículo se
 * escriben, qué espacios publicitarios ofrece y cómo debe escribir la IA para ese público. Todo es dato (sin React ni servidor)
 * para que lo usen igual el panel, las páginas públicas y la generación con IA.
 */

export type EspacioId = "cabecera" | "lateral" | "articulo" | "pie";

export type EspacioPublicitario = {
  id: EspacioId;
  nombre: string;
  /** Dónde se ve en el portal. */
  donde: string;
  /** Medida sugerida para una imagen. */
  medida: string;
  /** Qué anunciantes encajan en este portal. */
  sugerencia: string;
};

export type TipoArticulo = { id: string; nombre: string; guia: string };

export type Tematica = {
  seccion: { nombre: string; descripcion: string };
  categorias: string[];
  tipos: TipoArticulo[];
  espacios: EspacioPublicitario[];
  ia: {
    /** Cómo escribe el portal. */
    voz: string;
    audiencia: string;
    /** Reglas que la IA siempre debe cumplir en esta temática. */
    pautas: string[];
    /** Aviso que cierra los artículos que lo necesitan. */
    aviso?: string;
    /** Ideas de partida para el generador. */
    temas: string[];
  };
};

const posiciones: Record<EspacioId, Pick<EspacioPublicitario, "donde" | "medida">> = {
  cabecera: { donde: "Banda ancha bajo el encabezado, en el inicio y en cada artículo", medida: "1200 × 160 px (o solo texto)" },
  lateral: { donde: "Columna lateral de los artículos y del listado", medida: "600 × 500 px (o solo texto)" },
  articulo: { donde: "Dentro del artículo, después de los primeros párrafos", medida: "1200 × 630 px (o solo texto)" },
  pie: { donde: "Banda ancha antes del pie de página", medida: "1200 × 200 px (o solo texto)" },
};

const espacio = (id: EspacioId, nombre: string, sugerencia: string): EspacioPublicitario => ({ id, nombre, sugerencia, ...posiciones[id] });

export const TEMATICAS: Record<PlantillaId, Tematica> = {
  salud: {
    seccion: { nombre: "Salud al día", descripcion: "Guías claras para cuidarte y entender cómo funciona la salud en Colombia." },
    categorias: ["Prevención", "Nutrición y hábitos", "Salud mental", "Salud infantil", "Adulto mayor", "Trámites y derechos del paciente", "Mitos y realidades"],
    tipos: [
      { id: "guia", nombre: "Guía práctica", guia: "Pasos concretos para resolver una situación cotidiana de salud." },
      { id: "mito", nombre: "Mito o realidad", guia: "Desmiente una creencia común con explicación sencilla y prudente." },
      { id: "chequeo", nombre: "Lista de chequeo", guia: "Qué revisar, qué llevar o qué preguntar antes de una cita, un examen o un trámite." },
      { id: "preguntas", nombre: "Preguntas y respuestas", guia: "Las dudas más frecuentes sobre un tema, respondidas una por una." },
    ],
    espacios: [
      espacio("cabecera", "Banner superior", "Clínicas, laboratorios, droguerías y planes de salud."),
      espacio("lateral", "Lateral", "Especialistas, odontología, ópticas y centros de bienestar."),
      espacio("articulo", "Dentro del artículo", "Servicios relacionados con el tema que se está leyendo."),
      espacio("pie", "Antes del pie", "Campañas de prevención, seguros y telemedicina."),
    ],
    ia: {
      voz: "divulgador de salud prudente, claro y sin alarmismo, que habla de tú y explica sin tecnicismos",
      audiencia: "personas y familias en Colombia que buscan orientación confiable sobre salud y sobre cómo moverse en el sistema",
      pautas: [
        "No diagnostiques ni indiques medicamentos, dosis ni tratamientos; explica en términos generales y recomienda consultar a un profesional de la salud.",
        "No prometas curas ni resultados, ni uses lenguaje alarmista.",
        "Si hay señales de alarma, dilo con claridad: cuándo buscar atención médica de urgencia.",
        "Sobre derechos y trámites en Colombia, habla en términos generales y sugiere confirmar en la EPS, la Superintendencia de Salud o el Ministerio de Salud.",
      ],
      aviso: "Este contenido es informativo y no reemplaza la consulta con un profesional de la salud.",
      temas: ["Cómo prepararte para un examen de laboratorio", "Qué llevar a una cita médica y qué preguntar", "Señales de alarma en los niños que no debes ignorar", "Cómo cuidar tu salud mental en épocas de estrés"],
    },
  },
  belleza: {
    seccion: { nombre: "Belleza y bienestar", descripcion: "Ideas, cuidados y tendencias para verte y sentirte bien." },
    categorias: ["Cabello", "Piel", "Uñas", "Maquillaje", "Barbería", "Spa y bienestar"],
    tipos: [
      { id: "tendencia", nombre: "Tendencia", guia: "Qué se está usando y cómo adaptarlo a distintos estilos y presupuestos." },
      { id: "paso-a-paso", nombre: "Paso a paso", guia: "Una rutina o técnica explicada en pasos que cualquiera pueda seguir." },
      { id: "cuidados", nombre: "Cuidados en casa", guia: "Hábitos y cuidados cotidianos para mantener los resultados." },
      { id: "elegir", nombre: "Cómo elegir", guia: "Criterios para escoger un servicio o un profesional, sin recomendar marcas." },
    ],
    espacios: [
      espacio("cabecera", "Banner superior", "Salones, barberías, spas y escuelas de belleza."),
      espacio("lateral", "Lateral", "Productos de cuidado personal, uñas y maquillaje."),
      espacio("articulo", "Dentro del artículo", "Servicios o productos afines al tema del artículo."),
      espacio("pie", "Antes del pie", "Promociones de temporada y gimnasios o centros de bienestar."),
    ],
    ia: {
      voz: "asesora de belleza cercana, inspiradora y práctica, que habla de tú y evita exageraciones",
      audiencia: "mujeres y hombres en Colombia que quieren cuidarse y encontrar buenos servicios de belleza",
      pautas: [
        "No hagas afirmaciones médicas ni prometas resultados garantizados; para pieles o cueros cabelludos con problemas, recomienda consultar a un dermatólogo.",
        "No recomiendes marcas ni productos comerciales concretos.",
        "No inventes estudios, porcentajes ni testimonios.",
        "Habla de cuidados seguros y advierte cuando algo requiere un profesional.",
      ],
      temas: ["Cómo cuidar el cabello teñido en casa", "Rutina básica de piel para el clima de Bogotá", "Cómo elegir un buen salón de belleza", "Cuidados de las uñas semipermanentes"],
    },
  },
  "motos-autos": {
    seccion: { nombre: "Garaje", descripcion: "Mantenimiento, trámites y seguridad para tu moto y tu carro." },
    categorias: ["Mantenimiento", "Trámites y documentos", "Seguridad vial", "Repuestos y accesorios", "Motos", "Carros"],
    tipos: [
      { id: "mantenimiento", nombre: "Guía de mantenimiento", guia: "Qué revisar, cada cuánto y qué señales indican que algo falla." },
      { id: "tramite", nombre: "Trámite paso a paso", guia: "Cómo hacer un trámite (SOAT, revisión técnico-mecánica, traspaso, impuesto) y qué documentos llevar." },
      { id: "seguridad", nombre: "Consejos de seguridad", guia: "Hábitos de manejo y de conservación que previenen accidentes." },
      { id: "comprar", nombre: "Cómo elegir o comprar", guia: "Qué mirar al comprar un vehículo, un repuesto o un servicio, sin recomendar marcas." },
    ],
    espacios: [
      espacio("cabecera", "Banner superior", "Talleres, concesionarios, aseguradoras y almacenes de repuestos."),
      espacio("lateral", "Lateral", "Llantas, lubricantes, accesorios y lavaderos."),
      espacio("articulo", "Dentro del artículo", "Servicios relacionados con el tema que se está leyendo."),
      espacio("pie", "Antes del pie", "SOAT, seguros y financiación de vehículos."),
    ],
    ia: {
      voz: "mecánico aficionado y buen divulgador: directo, práctico y sin tecnicismos innecesarios",
      audiencia: "dueños de motos y carros en Colombia que quieren cuidar su vehículo y entender trámites y costos",
      pautas: [
        "No des precios, tarifas ni plazos legales concretos: pueden cambiar; di que se confirmen en la fuente oficial (RUNT, Ministerio de Transporte, aseguradoras o el taller).",
        "No recomiendes marcas ni talleres concretos.",
        "Para reparaciones riesgosas (frenos, dirección, sistema eléctrico), aconseja acudir a un taller de confianza.",
        "No inventes cifras ni normas; si no estás seguro de un dato, habla en términos generales.",
      ],
      aviso: "Consulta siempre las normas y los costos vigentes en las entidades oficiales y con un taller de confianza.",
      temas: ["Qué revisar antes de un viaje largo en carretera", "Cómo mantener tu moto en buen estado en época de lluvias", "Qué documentos necesitas para la revisión técnico-mecánica", "Señales de que tus frenos necesitan revisión"],
    },
  },
  "hogar-cuidado": {
    seccion: { nombre: "Cuidar en casa", descripcion: "Guías para cuidar a quienes más quieres, con calma y confianza." },
    categorias: ["Adultos mayores", "Niños y bebés", "Recuperación y rehabilitación", "Para cuidadores", "Hogar seguro", "Trámites y apoyos"],
    tipos: [
      { id: "guia", nombre: "Guía de cuidado", guia: "Cómo acompañar una situación de cuidado en casa, paso a paso." },
      { id: "chequeo", nombre: "Lista de chequeo", guia: "Qué revisar o preparar en casa para que sea un lugar seguro y cómodo." },
      { id: "cuidador", nombre: "Para cuidadores", guia: "Consejos para quien cuida: descanso, organización y cómo pedir ayuda." },
      { id: "contratar", nombre: "Cómo elegir ayuda", guia: "Qué preguntar y verificar al contratar apoyo de cuidado o de enfermería a domicilio." },
    ],
    espacios: [
      espacio("cabecera", "Banner superior", "Servicios de cuidado a domicilio, enfermería y fisioterapia."),
      espacio("lateral", "Lateral", "Ayudas técnicas, ropa y mobiliario adaptado, farmacias."),
      espacio("articulo", "Dentro del artículo", "Servicios afines al tema del artículo."),
      espacio("pie", "Antes del pie", "Seguros exequiales, asistencia y centros de día."),
    ],
    ia: {
      voz: "acompañante cálido y sereno, que da seguridad y habla de tú, con frases cortas y claras",
      audiencia: "familias en Colombia que cuidan a adultos mayores, niños o personas en recuperación",
      pautas: [
        "No des indicaciones médicas, de medicamentos ni de terapias; recomienda consultar al médico tratante o al personal de enfermería.",
        "Reconoce el cansancio del cuidador y sugiere pedir apoyo, sin juzgar.",
        "No inventes cifras ni estudios.",
        "Para contratar ayuda, aconseja pedir referencias y verificar documentos, sin recomendar empresas concretas.",
      ],
      aviso: "Este contenido es informativo y no reemplaza la valoración de un profesional de la salud.",
      temas: ["Cómo preparar la casa para un adulto mayor que usa bastón", "Rutina diaria para cuidar a una persona en cama", "Qué preguntar al contratar una cuidadora a domicilio", "Cómo cuidarte a ti mismo cuando cuidas a alguien"],
    },
  },
};

export const tematicaDe = (id: PlantillaId) => TEMATICAS[id];
