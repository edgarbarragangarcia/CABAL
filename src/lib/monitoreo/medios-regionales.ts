/**
 * Directorio de portales y páginas de Facebook regionales de Colombia, con la ciudad desde la que publican. Cada fila se comprobó
 * en vivo (el 13 de octubre de 2026): el dominio responde, la ciudad sale de la propia página del portal (dirección, pie, nombre) o de
 * dónde se concentra su cobertura, y la página de Facebook es la que el portal enlaza en su sitio.
 *
 * - `web`: Google Noticias indexa el sitio, así que se puede buscar «María Fernanda Cabal» con `site:`.
 * - `rss`: el sitio deja consultar su propio buscador (/?s=…&feed=rss2): se busca directo en el portal, sin pasar por Google.
 * - `fb`: nombre de la página en facebook.com (null: no se encontró una página oficial).
 * - `fbIndexado`: Google Noticias indexa publicaciones de esa página, así que se puede buscar con `site:facebook.com/<página>`.
 *   Si es false, la página existe pero no se puede leer desde aquí: solo se ofrece el enlace.
 * - `lat`/`lon`: centro del municipio en el mapa oficial del proyecto (public/data/geo), para ubicar el punto.
 *
 * Faltan portales en Amazonas, Guainía, Vaupés, Vichada y San Andrés: no se encontró ninguno que Google indexe. Las noticias de esos
 * lugares se ubican por el lugar que nombra el titular (ver lugares.ts).
 */
export type MedioRegional = {
  id: string;
  nombre: string;
  dominio: string;
  tipo: "prensa" | "radio" | "tv" | "digital";
  ciudad: string;
  /** Código DANE del municipio (5 dígitos). */
  dane: string;
  departamento: string;
  lat: number;
  lon: number;
  web: boolean;
  rss: boolean;
  fb: string | null;
  fbIndexado: boolean;
};

export const MEDIOS_REGIONALES: MedioRegional[] = [
  { id: "ciudadsur", nombre: "Ciudad Sur", dominio: "ciudadsur.co", tipo: "digital", ciudad: "Itagüí", dane: "05360", departamento: "Antioquia", lat: 6.171, lon: -75.617, web: true, rss: true, fb: "periodicociudadsur", fbIndexado: true },
  { id: "diarioriente", nombre: "Diario Oriente", dominio: "diarioriente.com", tipo: "digital", ciudad: "La Ceja", dane: "05376", departamento: "Antioquia", lat: 5.989, lon: -75.434, web: true, rss: true, fb: "DiariOriente", fbIndexado: true },
  { id: "entrecejayceja", nombre: "Entre Ceja y Ceja", dominio: "entrecejayceja.co", tipo: "digital", ciudad: "La Ceja", dane: "05376", departamento: "Antioquia", lat: 5.989, lon: -75.434, web: true, rss: false, fb: "entrecejaycejanoticias", fbIndexado: false },
  { id: "agenciapi", nombre: "Agencia de Periodismo Investigativo", dominio: "agenciapi.co", tipo: "digital", ciudad: "Medellín", dane: "05001", departamento: "Antioquia", lat: 6.257, lon: -75.615, web: true, rss: false, fb: "AgenciaPeriodismoInvestigativo", fbIndexado: true },
  { id: "elcolombiano", nombre: "El Colombiano", dominio: "elcolombiano.com", tipo: "prensa", ciudad: "Medellín", dane: "05001", departamento: "Antioquia", lat: 6.257, lon: -75.615, web: true, rss: false, fb: "ElColombiano", fbIndexado: true },
  { id: "elmundo", nombre: "El Mundo Medellín", dominio: "elmundo.com", tipo: "prensa", ciudad: "Medellín", dane: "05001", departamento: "Antioquia", lat: 6.257, lon: -75.615, web: false, rss: false, fb: "periodicoelmundo", fbIndexado: false },
  { id: "h13n", nombre: "Hora 13 Noticias", dominio: "h13n.com", tipo: "digital", ciudad: "Medellín", dane: "05001", departamento: "Antioquia", lat: 6.257, lon: -75.615, web: true, rss: true, fb: "hora13noticias", fbIndexado: true },
  { id: "ifmnoticias", nombre: "IFM Noticias", dominio: "ifmnoticias.com", tipo: "digital", ciudad: "Medellín", dane: "05001", departamento: "Antioquia", lat: 6.257, lon: -75.615, web: true, rss: false, fb: "ifmnoticias", fbIndexado: true },
  { id: "minuto30", nombre: "Minuto30", dominio: "minuto30.com", tipo: "digital", ciudad: "Medellín", dane: "05001", departamento: "Antioquia", lat: 6.257, lon: -75.615, web: true, rss: false, fb: "Minuto30com", fbIndexado: true },
  { id: "qhubomedellin", nombre: "Q'hubo Medellín", dominio: "qhubomedellin.com", tipo: "prensa", ciudad: "Medellín", dane: "05001", departamento: "Antioquia", lat: 6.257, lon: -75.615, web: true, rss: false, fb: "QhuboMedellin", fbIndexado: true },
  { id: "teleantioquia", nombre: "Teleantioquia", dominio: "teleantioquia.co", tipo: "tv", ciudad: "Medellín", dane: "05001", departamento: "Antioquia", lat: 6.257, lon: -75.615, web: true, rss: false, fb: null, fbIndexado: false },
  { id: "telemedellin", nombre: "Telemedellín", dominio: "telemedellin.tv", tipo: "tv", ciudad: "Medellín", dane: "05001", departamento: "Antioquia", lat: 6.257, lon: -75.615, web: true, rss: true, fb: "telemedellin.tv", fbIndexado: true },
  { id: "vivirenelpoblado", nombre: "Vivir en El Poblado", dominio: "vivirenelpoblado.com", tipo: "digital", ciudad: "Medellín", dane: "05001", departamento: "Antioquia", lat: 6.257, lon: -75.615, web: true, rss: true, fb: "vivirenelpoblado", fbIndexado: true },
  { id: "laprensaoriente", nombre: "La Prensa Oriente", dominio: "laprensaoriente.info", tipo: "digital", ciudad: "Rionegro", dane: "05615", departamento: "Antioquia", lat: 6.153, lon: -75.409, web: true, rss: true, fb: "laprensaoriente", fbIndexado: true },
  { id: "mioriente", nombre: "MiOriente", dominio: "mioriente.com", tipo: "digital", ciudad: "Rionegro", dane: "05615", departamento: "Antioquia", lat: 6.153, lon: -75.409, web: true, rss: true, fb: "MiOriente", fbIndexado: true },
  { id: "orientese", nombre: "Oriéntese", dominio: "orientese.co", tipo: "digital", ciudad: "Rionegro", dane: "05615", departamento: "Antioquia", lat: 6.153, lon: -75.409, web: true, rss: true, fb: "WWW.ORIENTESE.CO", fbIndexado: true },
  { id: "primerooriente", nombre: "Primero Oriente", dominio: "primerooriente.com", tipo: "digital", ciudad: "Rionegro", dane: "05615", departamento: "Antioquia", lat: 6.153, lon: -75.409, web: true, rss: true, fb: null, fbIndexado: false },
  { id: "lavozdelcinaruco", nombre: "La Voz del Cinaruco", dominio: "lavozdelcinaruco.com", tipo: "digital", ciudad: "Arauca", dane: "81001", departamento: "Arauca", lat: 6.795, lon: -70.505, web: true, rss: true, fb: "LaVozDelCinaruco", fbIndexado: false },
  { id: "llanera", nombre: "Llanera.com", dominio: "llanera.com", tipo: "digital", ciudad: "Arauca", dane: "81001", departamento: "Arauca", lat: 6.795, lon: -70.505, web: true, rss: false, fb: "llaneracom", fbIndexado: true },
  { id: "meridiano70", nombre: "Meridiano 70", dominio: "meridiano70.co", tipo: "digital", ciudad: "Arauca", dane: "81001", departamento: "Arauca", lat: 6.795, lon: -70.505, web: true, rss: true, fb: "meridiano70", fbIndexado: true },
  { id: "aldia", nombre: "Aldia.co", dominio: "aldia.co", tipo: "prensa", ciudad: "Barranquilla", dane: "08001", departamento: "Atlántico", lat: 10.985, lon: -74.832, web: true, rss: false, fb: "aldiacolombia", fbIndexado: true },
  { id: "cvnoticias", nombre: "CV Noticias", dominio: "cvnoticias.com.co", tipo: "tv", ciudad: "Barranquilla", dane: "08001", departamento: "Atlántico", lat: 10.985, lon: -74.832, web: true, rss: true, fb: "CVnoticiastv", fbIndexado: true },
  { id: "elheraldo", nombre: "El Heraldo", dominio: "elheraldo.co", tipo: "prensa", ciudad: "Barranquilla", dane: "08001", departamento: "Atlántico", lat: 10.985, lon: -74.832, web: true, rss: false, fb: "fansheraldo", fbIndexado: true },
  { id: "emisoraatlantico", nombre: "Emisora Atlántico 1070 AM", dominio: "emisoraatlantico.com.co", tipo: "radio", ciudad: "Barranquilla", dane: "08001", departamento: "Atlántico", lat: 10.985, lon: -74.832, web: true, rss: false, fb: "EmisorAtlantico", fbIndexado: true },
  { id: "impactonews", nombre: "Impacto News", dominio: "impactonews.co", tipo: "digital", ciudad: "Barranquilla", dane: "08001", departamento: "Atlántico", lat: 10.985, lon: -74.832, web: true, rss: false, fb: null, fbIndexado: false },
  { id: "diariolalibertad", nombre: "La Libertad", dominio: "diariolalibertad.com", tipo: "prensa", ciudad: "Barranquilla", dane: "08001", departamento: "Atlántico", lat: 10.985, lon: -74.832, web: true, rss: false, fb: "diariolalibertad", fbIndexado: true },
  { id: "noticiascoopercom", nombre: "Noticias Coopercom", dominio: "noticiascoopercom.co", tipo: "digital", ciudad: "Barranquilla", dane: "08001", departamento: "Atlántico", lat: 10.985, lon: -74.832, web: true, rss: true, fb: "noticiascoopercom", fbIndexado: true },
  { id: "redmas", nombre: "Red+ Noticias", dominio: "redmas.com.co", tipo: "tv", ciudad: "Barranquilla", dane: "08001", departamento: "Atlántico", lat: 10.985, lon: -74.832, web: true, rss: false, fb: "RedMasNoticias", fbIndexado: true },
  { id: "telecaribe", nombre: "Telecaribe", dominio: "telecaribe.co", tipo: "tv", ciudad: "Barranquilla", dane: "08001", departamento: "Atlántico", lat: 10.985, lon: -74.832, web: true, rss: true, fb: null, fbIndexado: false },
  { id: "zonacero", nombre: "Zona Cero", dominio: "zonacero.com", tipo: "digital", ciudad: "Barranquilla", dane: "08001", departamento: "Atlántico", lat: 10.985, lon: -74.832, web: true, rss: false, fb: "zonacerobarranquilla", fbIndexado: true },
  { id: "canalcapital", nombre: "Canal Capital", dominio: "canalcapital.gov.co", tipo: "tv", ciudad: "Bogotá, D.C.", dane: "11001", departamento: "Bogotá, D.C.", lat: 4.329, lon: -74.177, web: true, rss: true, fb: "CanalCapitalOficial", fbIndexado: true },
  { id: "citytv-eltiempo", nombre: "City TV", dominio: "citytv.eltiempo.com", tipo: "tv", ciudad: "Bogotá, D.C.", dane: "11001", departamento: "Bogotá, D.C.", lat: 4.329, lon: -74.177, web: true, rss: false, fb: "citytv.com.co", fbIndexado: true },
  { id: "minuto60", nombre: "Minuto60", dominio: "minuto60.com", tipo: "digital", ciudad: "Bogotá, D.C.", dane: "11001", departamento: "Bogotá, D.C.", lat: 4.329, lon: -74.177, web: true, rss: false, fb: "minuto60", fbIndexado: false },
  { id: "qhubobogota", nombre: "Q'hubo Bogotá", dominio: "qhubobogota.com", tipo: "prensa", ciudad: "Bogotá, D.C.", dane: "11001", departamento: "Bogotá, D.C.", lat: 4.329, lon: -74.177, web: true, rss: true, fb: "qhuboBogota", fbIndexado: false },
  { id: "eluniversal", nombre: "El Universal", dominio: "eluniversal.com.co", tipo: "prensa", ciudad: "Cartagena de Indias", dane: "13001", departamento: "Bolívar", lat: 10.475, lon: -75.45, web: true, rss: false, fb: "eluniversalcartagena", fbIndexado: true },
  { id: "noticias625", nombre: "Noticias 625", dominio: "noticias625.co", tipo: "digital", ciudad: "Cartagena de Indias", dane: "13001", departamento: "Bolívar", lat: 10.475, lon: -75.45, web: true, rss: true, fb: "Notias625", fbIndexado: true },
  { id: "revistametro", nombre: "Revista Metro", dominio: "revistametro.co", tipo: "digital", ciudad: "Cartagena de Indias", dane: "13001", departamento: "Bolívar", lat: 10.475, lon: -75.45, web: true, rss: true, fb: null, fbIndexado: false },
  { id: "724noticias", nombre: "Sucre 724 Noticias", dominio: "724noticias.com.co", tipo: "digital", ciudad: "Cartagena de Indias", dane: "13001", departamento: "Bolívar", lat: 10.475, lon: -75.45, web: true, rss: true, fb: "724noticias", fbIndexado: false },
  { id: "matinalnoticias", nombre: "Matinal Noticias", dominio: "matinalnoticias.com", tipo: "digital", ciudad: "Duitama", dane: "15238", departamento: "Boyacá", lat: 5.898, lon: -73.068, web: true, rss: false, fb: null, fbIndexado: false },
  { id: "boyaca7dias", nombre: "Boyacá 7 Días", dominio: "boyaca7dias.com.co", tipo: "prensa", ciudad: "Tunja", dane: "15001", departamento: "Boyacá", lat: 5.522, lon: -73.378, web: true, rss: true, fb: "boyacasietedias", fbIndexado: true },
  { id: "boyacaradio", nombre: "Boyacá Radio", dominio: "boyacaradio.com", tipo: "radio", ciudad: "Tunja", dane: "15001", departamento: "Boyacá", lat: 5.522, lon: -73.378, web: true, rss: false, fb: "BoyacaRadioOfficial", fbIndexado: true },
  { id: "bcnoticias", nombre: "BC Noticias", dominio: "bcnoticias.com.co", tipo: "digital", ciudad: "Manizales", dane: "17001", departamento: "Caldas", lat: 5.083, lon: -75.521, web: true, rss: true, fb: "BCNoticiasManizales", fbIndexado: true },
  { id: "eje21", nombre: "Eje21", dominio: "eje21.com.co", tipo: "digital", ciudad: "Manizales", dane: "17001", departamento: "Caldas", lat: 5.083, lon: -75.521, web: true, rss: false, fb: "diarioeje21", fbIndexado: true },
  { id: "lapatria", nombre: "La Patria", dominio: "lapatria.com", tipo: "prensa", ciudad: "Manizales", dane: "17001", departamento: "Caldas", lat: 5.083, lon: -75.521, web: true, rss: false, fb: "lapatria.manizales", fbIndexado: true },
  { id: "lenteregional", nombre: "Lente Regional", dominio: "lenteregional.com", tipo: "digital", ciudad: "Florencia", dane: "18001", departamento: "Caquetá", lat: 1.748, lon: -75.557, web: true, rss: true, fb: "lenteregional", fbIndexado: true },
  { id: "casanareonline", nombre: "Casanare Online", dominio: "casanareonline.co", tipo: "digital", ciudad: "Yopal", dane: "85001", departamento: "Casanare", lat: 5.245, lon: -72.259, web: true, rss: true, fb: "CasanareOnline.co", fbIndexado: true },
  { id: "prensalibrecasanare", nombre: "Prensa Libre Casanare", dominio: "prensalibrecasanare.com", tipo: "digital", ciudad: "Yopal", dane: "85001", departamento: "Casanare", lat: 5.245, lon: -72.259, web: true, rss: false, fb: "PrensaLibreCasanarePLC", fbIndexado: false },
  { id: "diariodelcauca", nombre: "Diario del Cauca", dominio: "diariodelcauca.com.co", tipo: "prensa", ciudad: "Popayán", dane: "19001", departamento: "Cauca", lat: 2.475, lon: -76.593, web: true, rss: false, fb: null, fbIndexado: false },
  { id: "periodicovirtual", nombre: "Periódico Virtual", dominio: "periodicovirtual.com", tipo: "digital", ciudad: "Popayán", dane: "19001", departamento: "Cauca", lat: 2.475, lon: -76.593, web: true, rss: false, fb: "periodicovirtual.com.co", fbIndexado: true },
  { id: "radio1040am", nombre: "Radio 1040 AM", dominio: "radio1040am.com", tipo: "radio", ciudad: "Popayán", dane: "19001", departamento: "Cauca", lat: 2.475, lon: -76.593, web: true, rss: false, fb: "popayanradio1040", fbIndexado: true },
  { id: "diariodelcesar", nombre: "Diario del Cesar", dominio: "diariodelcesar.com", tipo: "prensa", ciudad: "Valledupar", dane: "20001", departamento: "Cesar", lat: 10.381, lon: -73.461, web: true, rss: true, fb: "diariodelcesar", fbIndexado: true },
  { id: "elpilon", nombre: "El Pilón", dominio: "elpilon.com.co", tipo: "prensa", ciudad: "Valledupar", dane: "20001", departamento: "Cesar", lat: 10.381, lon: -73.461, web: true, rss: false, fb: "elpilon.com.co", fbIndexado: true },
  { id: "midiario", nombre: "Mi Diario Informa", dominio: "midiario.co", tipo: "digital", ciudad: "Valledupar", dane: "20001", departamento: "Cesar", lat: 10.381, lon: -73.461, web: true, rss: false, fb: null, fbIndexado: false },
  { id: "radioguatapuri", nombre: "Radio Guatapurí", dominio: "radioguatapuri.com", tipo: "radio", ciudad: "Valledupar", dane: "20001", departamento: "Cesar", lat: 10.381, lon: -73.461, web: true, rss: false, fb: "radioguatapuri", fbIndexado: true },
  { id: "choco7dias", nombre: "Chocó 7 Días", dominio: "choco7dias.com", tipo: "prensa", ciudad: "Quibdó", dane: "27001", departamento: "Chocó", lat: 5.937, lon: -76.666, web: true, rss: true, fb: "periodicochoco7dias", fbIndexado: true },
  { id: "chicanoticias", nombre: "Chicanoticias", dominio: "chicanoticias.com", tipo: "digital", ciudad: "Montería", dane: "23001", departamento: "Córdoba", lat: 8.581, lon: -75.947, web: true, rss: true, fb: "ChicaNoticias", fbIndexado: false },
  { id: "elmeridiano", nombre: "El Meridiano", dominio: "elmeridiano.co", tipo: "prensa", ciudad: "Montería", dane: "23001", departamento: "Córdoba", lat: 8.581, lon: -75.947, web: true, rss: false, fb: "elmeridiano.co", fbIndexado: true },
  { id: "larazon", nombre: "La Razón Montería", dominio: "larazon.co", tipo: "prensa", ciudad: "Montería", dane: "23001", departamento: "Córdoba", lat: 8.581, lon: -75.947, web: true, rss: true, fb: "LaRazonCo", fbIndexado: true },
  { id: "notipregonar", nombre: "Notipregonar", dominio: "notipregonar.com", tipo: "digital", ciudad: "Montería", dane: "23001", departamento: "Córdoba", lat: 8.581, lon: -75.947, web: true, rss: true, fb: null, fbIndexado: false },
  { id: "reporteregional", nombre: "Reporte Regional", dominio: "reporteregional.com", tipo: "digital", ciudad: "Montería", dane: "23001", departamento: "Córdoba", lat: 8.581, lon: -75.947, web: true, rss: true, fb: "DiarioReporteRegional", fbIndexado: true },
  { id: "rionoticias", nombre: "Río Noticias", dominio: "rionoticias.co", tipo: "tv", ciudad: "Montería", dane: "23001", departamento: "Córdoba", lat: 8.581, lon: -75.947, web: true, rss: true, fb: "RioNoticiasCo", fbIndexado: true },
  { id: "elobservador", nombre: "El Observador Sabana Centro", dominio: "elobservador.com.co", tipo: "digital", ciudad: "Cajicá", dane: "25126", departamento: "Cundinamarca", lat: 4.938, lon: -74.03, web: true, rss: true, fb: null, fbIndexado: false },
  { id: "portalnews", nombre: "Portal News", dominio: "portalnews.co", tipo: "digital", ciudad: "Chía", dane: "25175", departamento: "Cundinamarca", lat: 4.871, lon: -74.045, web: true, rss: false, fb: "portalnews.co", fbIndexado: true },
  { id: "emisoranuevaepoca", nombre: "Emisora Nueva Época", dominio: "emisoranuevaepoca.com.co", tipo: "radio", ciudad: "Fusagasugá", dane: "25290", departamento: "Cundinamarca", lat: 4.332, lon: -74.385, web: true, rss: false, fb: "EMISORANUEVAEPOCAFUSAGASUGA", fbIndexado: true },
  { id: "noticiasdiaadia", nombre: "Noticias Día a Día", dominio: "noticiasdiaadia.com", tipo: "digital", ciudad: "Fusagasugá", dane: "25290", departamento: "Cundinamarca", lat: 4.332, lon: -74.385, web: true, rss: false, fb: "noticiasdiaadiaonline", fbIndexado: true },
  { id: "cristalinacundinamarca", nombre: "Cristalina Cundinamarca", dominio: "cristalinacundinamarca.com", tipo: "digital", ciudad: "La Mesa", dane: "25386", departamento: "Cundinamarca", lat: 4.651, lon: -74.469, web: true, rss: false, fb: null, fbIndexado: false },
  { id: "elperiodiquito", nombre: "El Periodiquito", dominio: "elperiodiquito.com", tipo: "digital", ciudad: "Soacha", dane: "25754", departamento: "Cundinamarca", lat: 4.538, lon: -74.233, web: true, rss: false, fb: null, fbIndexado: false },
  { id: "marandua", nombre: "Marandúa", dominio: "marandua.com.co", tipo: "radio", ciudad: "San José del Guaviare", dane: "95001", departamento: "Guaviare", lat: 2.485, lon: -71.922, web: true, rss: true, fb: "Marandua-Stereo-1007-Fm-136246793057991", fbIndexado: false },
  { id: "jeanoticias", nombre: "Jeanoticias", dominio: "jeanoticias.com", tipo: "digital", ciudad: "Garzón", dane: "41298", departamento: "Huila", lat: 2.178, lon: -75.567, web: true, rss: true, fb: "Jeanoticias", fbIndexado: true },
  { id: "laultima", nombre: "La Última", dominio: "laultima.com.co", tipo: "digital", ciudad: "Garzón", dane: "41298", departamento: "Huila", lat: 2.178, lon: -75.567, web: true, rss: true, fb: null, fbIndexado: false },
  { id: "diariodelhuila", nombre: "Diario del Huila", dominio: "diariodelhuila.com", tipo: "prensa", ciudad: "Neiva", dane: "41001", departamento: "Huila", lat: 2.993, lon: -75.275, web: true, rss: false, fb: "diariodelhuila", fbIndexado: true },
  { id: "lanacion", nombre: "La Nación", dominio: "lanacion.com.co", tipo: "prensa", ciudad: "Neiva", dane: "41001", departamento: "Huila", lat: 2.993, lon: -75.275, web: true, rss: false, fb: "lanacionneiva", fbIndexado: true },
  { id: "neivaestereo", nombre: "Neiva Estéreo", dominio: "neivaestereo.co", tipo: "radio", ciudad: "Neiva", dane: "41001", departamento: "Huila", lat: 2.993, lon: -75.275, web: true, rss: true, fb: "neivaestereo93.8fm", fbIndexado: true },
  { id: "opanoticias", nombre: "Opanoticias", dominio: "opanoticias.com", tipo: "digital", ciudad: "Neiva", dane: "41001", departamento: "Huila", lat: 2.993, lon: -75.275, web: true, rss: false, fb: "opanoticias", fbIndexado: true },
  { id: "hjdoblekhuila", nombre: "Sistema INRAI", dominio: "hjdoblekhuila.com", tipo: "radio", ciudad: "Neiva", dane: "41001", departamento: "Huila", lat: 2.993, lon: -75.275, web: true, rss: false, fb: null, fbIndexado: false },
  { id: "lavozdelaregion", nombre: "La Voz de la Región", dominio: "lavozdelaregion.co", tipo: "prensa", ciudad: "Pitalito", dane: "41551", departamento: "Huila", lat: 1.835, lon: -76.114, web: true, rss: true, fb: "plavozdelaregion", fbIndexado: true },
  { id: "diariodelnorte", nombre: "Diario del Norte", dominio: "diariodelnorte.net", tipo: "prensa", ciudad: "Riohacha", dane: "44001", departamento: "La Guajira", lat: 11.244, lon: -72.957, web: true, rss: true, fb: "DiarioDelNorte", fbIndexado: false },
  { id: "guajiragrafica", nombre: "Guajira Gráfica", dominio: "guajiragrafica.net", tipo: "digital", ciudad: "Riohacha", dane: "44001", departamento: "La Guajira", lat: 11.244, lon: -72.957, web: true, rss: true, fb: "GuajiraGraficaNet", fbIndexado: false },
  { id: "laguajirahoy", nombre: "La Guajira Hoy", dominio: "laguajirahoy.com", tipo: "digital", ciudad: "Riohacha", dane: "44001", departamento: "La Guajira", lat: 11.244, lon: -72.957, web: true, rss: false, fb: "laguajirahoy", fbIndexado: true },
  { id: "tuuputchika", nombre: "Tuu Putchika", dominio: "tuuputchika.com", tipo: "digital", ciudad: "Riohacha", dane: "44001", departamento: "La Guajira", lat: 11.244, lon: -72.957, web: true, rss: true, fb: "TuuPutchika", fbIndexado: false },
  { id: "elinformador", nombre: "El Informador", dominio: "elinformador.com.co", tipo: "prensa", ciudad: "Santa Marta", dane: "47001", departamento: "Magdalena", lat: 11.12, lon: -73.887, web: true, rss: false, fb: "ElInformadorSM", fbIndexado: true },
  { id: "hoydiariodelmagdalena", nombre: "Hoy Diario del Magdalena", dominio: "hoydiariodelmagdalena.com.co", tipo: "prensa", ciudad: "Santa Marta", dane: "47001", departamento: "Magdalena", lat: 11.12, lon: -73.887, web: true, rss: false, fb: "hoydiariodelmagdalena", fbIndexado: true },
  { id: "opinioncaribe", nombre: "Opinión Caribe", dominio: "opinioncaribe.com", tipo: "digital", ciudad: "Santa Marta", dane: "47001", departamento: "Magdalena", lat: 11.12, lon: -73.887, web: true, rss: true, fb: "OPINIONCARIBE", fbIndexado: true },
  { id: "revistamomentos", nombre: "Revista Momentos", dominio: "revistamomentos.co", tipo: "digital", ciudad: "Santa Marta", dane: "47001", departamento: "Magdalena", lat: 11.12, lon: -73.887, web: true, rss: true, fb: "Momentosrevista", fbIndexado: true },
  { id: "seguimiento", nombre: "Seguimiento.co", dominio: "seguimiento.co", tipo: "digital", ciudad: "Santa Marta", dane: "47001", departamento: "Magdalena", lat: 11.12, lon: -73.887, web: true, rss: false, fb: null, fbIndexado: false },
  { id: "noticierodelllano", nombre: "Noticias del Llano", dominio: "noticierodelllano.com", tipo: "digital", ciudad: "Villavicencio", dane: "50001", departamento: "Meta", lat: 4.094, lon: -73.5, web: true, rss: false, fb: "notillanooficial", fbIndexado: true },
  { id: "periodicodelmeta", nombre: "Periódico del Meta", dominio: "periodicodelmeta.com", tipo: "prensa", ciudad: "Villavicencio", dane: "50001", departamento: "Meta", lat: 4.094, lon: -73.5, web: true, rss: false, fb: "Periodicodelmeta", fbIndexado: true },
  { id: "viveelmeta", nombre: "Vive el Meta", dominio: "viveelmeta.com", tipo: "digital", ciudad: "Villavicencio", dane: "50001", departamento: "Meta", lat: 4.094, lon: -73.5, web: true, rss: false, fb: "viveelmeta", fbIndexado: true },
  { id: "radioipiales", nombre: "Radio Ipiales", dominio: "radioipiales.co", tipo: "radio", ciudad: "Ipiales", dane: "52356", departamento: "Nariño", lat: 0.563, lon: -77.373, web: true, rss: true, fb: "radioipiales", fbIndexado: true },
  { id: "abranoticias", nombre: "Abra Noticias", dominio: "abranoticias.com", tipo: "digital", ciudad: "Pasto", dane: "52001", departamento: "Nariño", lat: 1.087, lon: -77.205, web: true, rss: true, fb: null, fbIndexado: false },
  { id: "diariodelsur", nombre: "Diario del Sur", dominio: "diariodelsur.com.co", tipo: "prensa", ciudad: "Pasto", dane: "52001", departamento: "Nariño", lat: 1.087, lon: -77.205, web: true, rss: false, fb: "diariodelsur", fbIndexado: true },
  { id: "elcontraste", nombre: "El Contraste", dominio: "elcontraste.co", tipo: "digital", ciudad: "Pasto", dane: "52001", departamento: "Nariño", lat: 1.087, lon: -77.205, web: true, rss: false, fb: "ElContrasteNoticias", fbIndexado: true },
  { id: "pagina10", nombre: "Página10", dominio: "pagina10.com", tipo: "digital", ciudad: "Pasto", dane: "52001", departamento: "Nariño", lat: 1.087, lon: -77.205, web: true, rss: true, fb: "pag10com", fbIndexado: true },
  { id: "informativodelguaico", nombre: "Informativo del Guaico", dominio: "informativodelguaico.com", tipo: "digital", ciudad: "Sandoná", dane: "52683", departamento: "Nariño", lat: 1.29, lon: -77.461, web: true, rss: true, fb: "InformativodelGuaico", fbIndexado: true },
  { id: "areacucuta", nombre: "Área Cúcuta", dominio: "areacucuta.com", tipo: "digital", ciudad: "San José de Cúcuta", dane: "54001", departamento: "Norte de Santander", lat: 8.111, lon: -72.489, web: true, rss: true, fb: "areacucuta", fbIndexado: true },
  { id: "laopinion", nombre: "La Opinión Cúcuta", dominio: "laopinion.com.co", tipo: "prensa", ciudad: "San José de Cúcuta", dane: "54001", departamento: "Norte de Santander", lat: 8.111, lon: -72.489, web: true, rss: false, fb: "LaOpiniondeColombia", fbIndexado: true },
  { id: "conexionputumayo", nombre: "Conexión Putumayo", dominio: "conexionputumayo.com", tipo: "digital", ciudad: "Mocoa", dane: "86001", departamento: "Putumayo", lat: 1.223, lon: -76.685, web: true, rss: true, fb: "ConexionPutumayo", fbIndexado: true },
  { id: "hsbnoticias", nombre: "HSB Noticias", dominio: "hsbnoticias.com", tipo: "digital", ciudad: "Mocoa", dane: "86001", departamento: "Putumayo", lat: 1.223, lon: -76.685, web: true, rss: false, fb: null, fbIndexado: false },
  { id: "miputumayo", nombre: "MiPutumayo Noticias", dominio: "miputumayo.com.co", tipo: "digital", ciudad: "Mocoa", dane: "86001", departamento: "Putumayo", lat: 1.223, lon: -76.685, web: true, rss: true, fb: "MiPutumayo.com.co", fbIndexado: true },
  { id: "cronicadelquindio", nombre: "Crónica del Quindío", dominio: "cronicadelquindio.com", tipo: "prensa", ciudad: "Armenia", dane: "63001", departamento: "Quindío", lat: 4.497, lon: -75.725, web: true, rss: true, fb: "cronicadelquindio", fbIndexado: true },
  { id: "elquindiano", nombre: "El Quindiano", dominio: "elquindiano.com", tipo: "prensa", ciudad: "Armenia", dane: "63001", departamento: "Quindío", lat: 4.497, lon: -75.725, web: true, rss: false, fb: "ElQuindianoNoticias", fbIndexado: true },
  { id: "lacuyabraradio", nombre: "La Cuyabra Radio", dominio: "lacuyabraradio.com", tipo: "radio", ciudad: "Armenia", dane: "63001", departamento: "Quindío", lat: 4.497, lon: -75.725, web: true, rss: true, fb: "lacuyabraradio", fbIndexado: true },
  { id: "ciudadregion", nombre: "CiudadRegión", dominio: "ciudadregion.com", tipo: "digital", ciudad: "Pereira", dane: "66001", departamento: "Risaralda", lat: 4.781, lon: -75.721, web: true, rss: false, fb: "CiudadRegion", fbIndexado: true },
  { id: "eldiario", nombre: "El Diario", dominio: "eldiario.com.co", tipo: "prensa", ciudad: "Pereira", dane: "66001", departamento: "Risaralda", lat: 4.781, lon: -75.721, web: true, rss: true, fb: "eldiariopereira", fbIndexado: false },
  { id: "elexpreso", nombre: "El Expreso", dominio: "elexpreso.co", tipo: "prensa", ciudad: "Pereira", dane: "66001", departamento: "Risaralda", lat: 4.781, lon: -75.721, web: true, rss: true, fb: "elexpresopereira", fbIndexado: true },
  { id: "qhubopereira", nombre: "Q'hubo Pereira", dominio: "qhubopereira.co", tipo: "prensa", ciudad: "Pereira", dane: "66001", departamento: "Risaralda", lat: 4.781, lon: -75.721, web: true, rss: true, fb: "QhuboPereira", fbIndexado: true },
  { id: "risaraldahoy", nombre: "Risaralda Hoy", dominio: "risaraldahoy.com", tipo: "digital", ciudad: "Pereira", dane: "66001", departamento: "Risaralda", lat: 4.781, lon: -75.721, web: true, rss: true, fb: "noticiasrisaraldahoy", fbIndexado: true },
  { id: "yariguies", nombre: "Yariguíes Stereo", dominio: "yariguies.com", tipo: "radio", ciudad: "Barrancabermeja", dane: "68081", departamento: "Santander", lat: 7.061, lon: -73.781, web: true, rss: true, fb: "yariguiesoficial", fbIndexado: true },
  { id: "canaltro", nombre: "Canal TRO", dominio: "canaltro.com", tipo: "tv", ciudad: "Bucaramanga", dane: "68001", departamento: "Santander", lat: 7.162, lon: -73.112, web: true, rss: true, fb: "canaltro", fbIndexado: true },
  { id: "elfrente", nombre: "El Frente", dominio: "elfrente.com.co", tipo: "prensa", ciudad: "Bucaramanga", dane: "68001", departamento: "Santander", lat: 7.162, lon: -73.112, web: true, rss: false, fb: "periodicoelfrente", fbIndexado: true },
  { id: "kesedice", nombre: "Ke se dice", dominio: "kesedice.com", tipo: "digital", ciudad: "Bucaramanga", dane: "68001", departamento: "Santander", lat: 7.162, lon: -73.112, web: true, rss: false, fb: "Kesedice-103917244669134", fbIndexado: false },
  { id: "metropolitano", nombre: "Metropolitano", dominio: "metropolitano.com.co", tipo: "prensa", ciudad: "Bucaramanga", dane: "68001", departamento: "Santander", lat: 7.162, lon: -73.112, web: true, rss: true, fb: null, fbIndexado: false },
  { id: "oronoticias", nombre: "Oro Noticias", dominio: "oronoticias.tv", tipo: "tv", ciudad: "Bucaramanga", dane: "68001", departamento: "Santander", lat: 7.162, lon: -73.112, web: true, rss: true, fb: "oronoticias.tv", fbIndexado: true },
  { id: "qhubobucaramanga", nombre: "Q'hubo Bucaramanga", dominio: "qhubobucaramanga.com", tipo: "prensa", ciudad: "Bucaramanga", dane: "68001", departamento: "Santander", lat: 7.162, lon: -73.112, web: true, rss: true, fb: "qhubobga", fbIndexado: true },
  { id: "vanguardia", nombre: "Vanguardia", dominio: "vanguardia.com", tipo: "prensa", ciudad: "Bucaramanga", dane: "68001", departamento: "Santander", lat: 7.162, lon: -73.112, web: true, rss: false, fb: "vanguardiacolombia", fbIndexado: true },
  { id: "correodelsur", nombre: "Correo del Sur", dominio: "correodelsur.com", tipo: "digital", ciudad: "Sincelejo", dane: "70001", departamento: "Sucre", lat: 9.316, lon: -75.429, web: true, rss: false, fb: "correodelsur", fbIndexado: true },
  { id: "dontamalio", nombre: "Don Tamalio", dominio: "dontamalio.com", tipo: "digital", ciudad: "Ibagué", dane: "73001", departamento: "Tolima", lat: 4.449, lon: -75.252, web: true, rss: true, fb: "dontamalio", fbIndexado: true },
  { id: "ecosdelcombeima", nombre: "Ecos del Combeima", dominio: "ecosdelcombeima.com", tipo: "radio", ciudad: "Ibagué", dane: "73001", departamento: "Tolima", lat: 4.449, lon: -75.252, web: true, rss: false, fb: "ecosdelcombeima", fbIndexado: true },
  { id: "elcronista", nombre: "El Cronista", dominio: "elcronista.co", tipo: "prensa", ciudad: "Ibagué", dane: "73001", departamento: "Tolima", lat: 4.449, lon: -75.252, web: true, rss: false, fb: "elcronista.co", fbIndexado: true },
  { id: "elirreverenteibague", nombre: "El Irreverente", dominio: "elirreverenteibague.com", tipo: "digital", ciudad: "Ibagué", dane: "73001", departamento: "Tolima", lat: 4.449, lon: -75.252, web: true, rss: true, fb: "elirreverenteibague", fbIndexado: true },
  { id: "elnuevodia", nombre: "El Nuevo Día", dominio: "elnuevodia.com.co", tipo: "prensa", ciudad: "Ibagué", dane: "73001", departamento: "Tolima", lat: 4.449, lon: -75.252, web: true, rss: false, fb: "diarioelnuevodia", fbIndexado: true },
  { id: "elolfato", nombre: "El Olfato", dominio: "elolfato.com", tipo: "digital", ciudad: "Ibagué", dane: "73001", departamento: "Tolima", lat: 4.449, lon: -75.252, web: true, rss: false, fb: "elolfato", fbIndexado: true },
  { id: "enfoqueteve", nombre: "Enfoque TeVe", dominio: "enfoqueteve.com", tipo: "tv", ciudad: "Ibagué", dane: "73001", departamento: "Tolima", lat: 4.449, lon: -75.252, web: true, rss: true, fb: "EnfoqueTeVe", fbIndexado: true },
  { id: "laotraverdad", nombre: "La Otra Verdad", dominio: "laotraverdad.co", tipo: "digital", ciudad: "Ibagué", dane: "73001", departamento: "Tolima", lat: 4.449, lon: -75.252, web: true, rss: true, fb: "LaOtraVerdadCol", fbIndexado: false },
  { id: "vozdelpueblo920am", nombre: "La Voz del Pueblo 920 AM", dominio: "vozdelpueblo920am.com", tipo: "radio", ciudad: "Ibagué", dane: "73001", departamento: "Tolima", lat: 4.449, lon: -75.252, web: true, rss: true, fb: null, fbIndexado: false },
  { id: "ondasdeibague", nombre: "Ondas de Ibagué", dominio: "ondasdeibague.com", tipo: "radio", ciudad: "Ibagué", dane: "73001", departamento: "Tolima", lat: 4.449, lon: -75.252, web: true, rss: false, fb: null, fbIndexado: false },
  { id: "tolima7dias", nombre: "Tolima 7 Días", dominio: "tolima7dias.com.co", tipo: "prensa", ciudad: "Ibagué", dane: "73001", departamento: "Tolima", lat: 4.449, lon: -75.252, web: true, rss: false, fb: "Tolima7diasCo", fbIndexado: false },
  { id: "tolimastereo", nombre: "Tolima Stereo", dominio: "tolimastereo.com", tipo: "radio", ciudad: "Ibagué", dane: "73001", departamento: "Tolima", lat: 4.449, lon: -75.252, web: true, rss: false, fb: "tolimastereo", fbIndexado: true },
  { id: "buenaventuraenlinea", nombre: "Buenaventura en Línea", dominio: "buenaventuraenlinea.com", tipo: "digital", ciudad: "Buenaventura", dane: "76109", departamento: "Valle del Cauca", lat: 3.612, lon: -77.085, web: true, rss: true, fb: null, fbIndexado: false },
  { id: "soydebuenaventura", nombre: "Soy de Buenaventura", dominio: "soydebuenaventura.com", tipo: "digital", ciudad: "Buenaventura", dane: "76109", departamento: "Valle del Cauca", lat: 3.612, lon: -77.085, web: true, rss: false, fb: "soydebuenaventura", fbIndexado: true },
  { id: "calihoy", nombre: "Cali Hoy", dominio: "calihoy.com", tipo: "digital", ciudad: "Cali", dane: "76001", departamento: "Valle del Cauca", lat: 3.399, lon: -76.578, web: true, rss: false, fb: null, fbIndexado: false },
  { id: "occidente", nombre: "Diario Occidente", dominio: "occidente.co", tipo: "prensa", ciudad: "Cali", dane: "76001", departamento: "Valle del Cauca", lat: 3.399, lon: -76.578, web: true, rss: true, fb: "diarioccidente", fbIndexado: true },
  { id: "elpais", nombre: "El País Cali", dominio: "elpais.com.co", tipo: "prensa", ciudad: "Cali", dane: "76001", departamento: "Valle del Cauca", lat: 3.399, lon: -76.578, web: true, rss: false, fb: "diarioelpaiscali", fbIndexado: true },
  { id: "90minutos", nombre: "Noticiero 90 Minutos", dominio: "90minutos.co", tipo: "tv", ciudad: "Cali", dane: "76001", departamento: "Valle del Cauca", lat: 3.399, lon: -76.578, web: true, rss: false, fb: "noticiero90minutos", fbIndexado: true },
  { id: "proclamadelpacifico", nombre: "Proclama del Pacífico", dominio: "proclamadelpacifico.com", tipo: "prensa", ciudad: "Cali", dane: "76001", departamento: "Valle del Cauca", lat: 3.399, lon: -76.578, web: true, rss: true, fb: "proclamadelpacifico", fbIndexado: true },
  { id: "telepacifico", nombre: "Telepacífico", dominio: "telepacifico.com", tipo: "tv", ciudad: "Cali", dane: "76001", departamento: "Valle del Cauca", lat: 3.399, lon: -76.578, web: true, rss: false, fb: "TelepacificoTV", fbIndexado: true },
  { id: "amprensa", nombre: "AM Prensa", dominio: "amprensa.com", tipo: "digital", ciudad: "Cartago", dane: "76147", departamento: "Valle del Cauca", lat: 4.707, lon: -75.923, web: true, rss: false, fb: "amprensa", fbIndexado: true },
  { id: "elnortehoy", nombre: "El Norte Hoy", dominio: "elnortehoy.com", tipo: "digital", ciudad: "Cartago", dane: "76147", departamento: "Valle del Cauca", lat: 4.707, lon: -75.923, web: true, rss: true, fb: "periodicoelnortehoy", fbIndexado: true },
  { id: "eltabloide", nombre: "El Tabloide", dominio: "eltabloide.com.co", tipo: "prensa", ciudad: "Tuluá", dane: "76834", departamento: "Valle del Cauca", lat: 4.028, lon: -76.033, web: true, rss: true, fb: "eltabloidedigital", fbIndexado: true },
  { id: "df-casanare", nombre: "DF Casanare", dominio: "", tipo: "digital", ciudad: "Yopal", dane: "85001", departamento: "Casanare", lat: 5.245, lon: -72.259, web: false, rss: false, fb: null, fbIndexado: false },
  { id: "dinamica-regional", nombre: "Dinámica Regional", dominio: "", tipo: "digital", ciudad: "Yopal", dane: "85001", departamento: "Casanare", lat: 5.245, lon: -72.259, web: false, rss: false, fb: null, fbIndexado: false },
  { id: "el-nuevo-oriente", nombre: "El Nuevo Oriente", dominio: "", tipo: "digital", ciudad: "Yopal", dane: "85001", departamento: "Casanare", lat: 5.245, lon: -72.259, web: false, rss: false, fb: null, fbIndexado: false },
  { id: "guaviare-estereo", nombre: "Guaviare Estéreo", dominio: "", tipo: "digital", ciudad: "San José del Guaviare", dane: "95001", departamento: "Guaviare", lat: 2.485, lon: -71.922, web: false, rss: false, fb: null, fbIndexado: false },
  { id: "tv-caqueta", nombre: "Tv Caquetá", dominio: "", tipo: "digital", ciudad: "Florencia", dane: "18001", departamento: "Caquetá", lat: 1.748, lon: -75.557, web: false, rss: false, fb: null, fbIndexado: false },
  { id: "red-digital-noticias", nombre: "Red Digital Noticias", dominio: "", tipo: "digital", ciudad: "Florencia", dane: "18001", departamento: "Caquetá", lat: 1.748, lon: -75.557, web: false, rss: false, fb: null, fbIndexado: false },
];

const quitarWww = (d: string) => d.toLowerCase().replace(/^www\./, "");
const PORDOMINIO = new Map(MEDIOS_REGIONALES.map((m) => [m.dominio, m]));

/** El portal regional de un dominio (con o sin «www.»); null si no está en el directorio. */
export function medioPorDominio(dominio: string): MedioRegional | null {
  const d = quitarWww(dominio);
  return PORDOMINIO.get(d) ?? null;
}

export const medioPorId = (id: string) => MEDIOS_REGIONALES.find((m) => m.id === id) ?? null;

const PORFB = new Map(MEDIOS_REGIONALES.filter((m) => m.fb).map((m) => [m.fb!.toLowerCase(), m]));
/** El portal dueño de una página de Facebook (por el nombre de la página en la dirección). */
export function medioPorFb(pagina: string): MedioRegional | null {
  return PORFB.get(pagina.toLowerCase()) ?? null;
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const POR_NOMBRE = MEDIOS_REGIONALES.filter((m) => sinTildes(m.nombre).length >= 8).map((m) => ({ m, n: sinTildes(m.nombre) })).sort((a, b) => b.n.length - a.n.length);
/** Las publicaciones de Facebook que trae Google Noticias suelen empezar por el nombre de la página: «Ecos del Combeima 790 AM. …». */
export function medioPorInicio(texto: string): MedioRegional | null {
  const t = sinTildes(texto);
  return POR_NOMBRE.find((x) => t.startsWith(x.n))?.m ?? null;
}
