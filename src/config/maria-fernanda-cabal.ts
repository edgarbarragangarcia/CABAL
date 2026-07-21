/**
 * Cifras de la trayectoria legislativa de María Fernanda Cabal Molina.
 * Cada dato está respaldado por una fuente pública verificable — no hay
 * cifras estimadas ni de relleno. Al actualizar, mantener la fuente.
 */
export type CabalStat = {
  value: string;
  label: string;
  sourceLabel: string;
  sourceUrl: string;
};

export const cabalStats: CabalStat[] = [
  {
    value: "12 años",
    label: "En el Congreso de la República",
    sourceLabel: "Infobae, 10 jun. 2026",
    sourceUrl:
      "https://www.infobae.com/colombia/2026/06/10/maria-fernanda-cabal-se-despidio-del-senado-tras-doce-anos-en-el-legislativo-me-voy-con-el-orgullo-de-ser-la-mujer-mas-votada-del-congreso/",
  },
  {
    value: "3 periodos",
    label: "1 en Cámara (desde 2014) y 2 en Senado (desde 2018)",
    sourceLabel: "Infobae, 10 jun. 2026",
    sourceUrl:
      "https://www.infobae.com/colombia/2026/06/10/maria-fernanda-cabal-se-despidio-del-senado-tras-doce-anos-en-el-legislativo-me-voy-con-el-orgullo-de-ser-la-mujer-mas-votada-del-congreso/",
  },
  {
    value: "+25",
    label: "Proyectos de ley como autora o coautora solo en 2024–2025",
    sourceLabel: "Congreso Visible, Universidad de los Andes",
    sourceUrl: "https://congresovisible.uniandes.edu.co/congresistas/perfil/autorias/maria-fernanda-cabal-molina/7312/",
  },
];

/** Proyectos de ley con radicación documentada (fuente: Congreso Visible / sitio oficial). */
export const cabalBills: { title: string; topic: string }[] = [
  { title: "Sistema integral de atención al espectro autista", topic: "Salud" },
  { title: "Protección de segundos ocupantes en restitución de tierras", topic: "Víctimas" },
  { title: "Sanciones por ausentismo en el Congreso", topic: "Transparencia" },
  { title: "Prohibición de cobros en cajeros a cuentas de baja transaccionalidad", topic: "Consumidores" },
  { title: "Fondo Especial de Financiamiento Agrícola (FEFA)", topic: "Agro" },
  { title: "Cátedra de prevención al consumo de sustancias psicoactivas", topic: "Educación" },
];

export const cabalProfileUrl =
  "https://congresovisible.uniandes.edu.co/congresistas/perfil/maria-fernanda-cabal-molina/7312/";
