export const siteConfig = {
  name: "Fundación Escuela Libertad",
  shortName: "Escuela Libertad",
  description:
    "La Fundación Escuela Libertad impulsa educación, oportunidades y desarrollo comunitario en Colombia a través de programas sociales de alto impacto.",
  url: "https://fundacionescuelalibertad.com.co",
  ogImage: "/og-image.jpg",
  locale: "es_CO",
  keywords: [
    "Fundación Escuela Libertad",
    "ONG Colombia",
    "educación social",
    "donaciones Colombia",
    "fundación educativa",
    "impacto social",
  ],
  links: {
    facebook: "https://facebook.com/fundacionescuelalibertad",
    instagram: "https://instagram.com/fundacionescuelalibertad",
    x: "https://x.com/escuelalibertad",
    youtube: "https://youtube.com/@fundacionescuelalibertad",
  },
  contact: {
    email: "contacto@fundacionescuelalibertad.com.co",
    phone: "+57 300 000 0000",
    address: "Colombia",
  },
} as const;

export type NavChild = {
  label: string;
  href: string;
  description: string;
};

export type NavItem = {
  label: string;
  href: string;
  children?: NavChild[];
};

export const mainNav: NavItem[] = [
  { label: "Inicio", href: "/" },
  { label: "Nosotros", href: "/nosotros" },
  {
    label: "Academia",
    href: "/academia",
    children: [
      {
        label: "Publicaciones",
        href: "/academia/publicaciones",
        description: "Investigación y análisis producidos por la fundación.",
      },
      {
        label: "Observatorio Legislativo",
        href: "/academia/observatorio-legislativo",
        description: "Seguimiento al trámite de proyectos de ley relevantes.",
      },
      {
        label: "Observatorio Económico",
        href: "/academia/observatorio-economico",
        description: "Cifras oficiales de seguridad, economía e institucionalidad, departamento por departamento.",
      },
      {
        label: "Boletines",
        href: "/academia/boletines",
        description: "Derechos humanos y comunicados de prensa de la fundación.",
      },
    ],
  },
  { label: "Opinión", href: "/opinion" },
  { label: "Eventos", href: "/eventos" },
  { label: "Tienda", href: "/tienda" },
  { label: "Contacto", href: "/contacto" },
];

export const footerNav = {
  fundacion: [
    { label: "Quiénes somos", href: "/nosotros" },
    { label: "Academia", href: "/academia" },
    { label: "Opinión", href: "/opinion" },
    { label: "Eventos", href: "/eventos" },
  ],
  ayuda: [
    { label: "Donar ahora", href: "/donar" },
    { label: "Tienda", href: "/tienda" },
    { label: "Contacto", href: "/contacto" },
    { label: "Transparencia", href: "/donar#transparencia" },
  ],
  legal: [
    { label: "Estatutos", href: "/estatutos" },
    { label: "Preguntas frecuentes", href: "/faqs" },
    { label: "Privacidad", href: "/privacidad" },
  ],
} as const;
