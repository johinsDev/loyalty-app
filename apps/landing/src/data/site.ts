export const brand = {
  name: "T4 Diverplaza",
  tagline: "Bubble tea, matcha y té de fruta en el corazón de Diverplaza.",
  club: "Diver Club",
  portalUrl: "https://app.t4diverclub.app",
} as const;

/** Razón social del RUT. Meta la contrasta contra el documento en la verificación de negocio. */
export const legal = {
  companyName: "A&J FRANQUICIAS S.A.S",
  taxId: "NIT 901.985.172-3",
  address: "Transversal 99 Bis # 70A-89",
  addressExtra: "CC Diverplaza, Piso 3, Local 352",
  city: "Bogotá D.C., Colombia",
  postalCode: "111111",
  phone: "+57 313 858 1722",
  phoneHref: "tel:+573138581722",
  email: "ajfranquicias@gmail.com",
} as const;

export const mapsUrl = "https://www.google.com/maps/search/?api=1&query=T4+DIVERPLAZA+Bogot%C3%A1";

/** Instantánea del perfil de Google del local (2026-08-18); el conteo cambia con el tiempo. */
export const googleRating = { score: "5,0", reviews: 55 } as const;

export const services = ["Consumo en el lugar", "Para llevar", "Domicilio"] as const;

export const hours = [
  { days: "Lunes a sábado", time: "10:30 – 21:30" },
  { days: "Domingos", time: "10:30 – 21:00" },
] as const;

/** schema.org sólo entiende días en inglés y horas en 24h; `hours` es para leer. */
export const openingHoursSpec = [
  {
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "10:30",
    closes: "21:30",
  },
  { days: ["Sunday"], opens: "10:30", closes: "21:00" },
] as const;

export const categories = [
  {
    slug: "especiales-taiwan",
    name: "Especiales de Taiwán",
    blurb: "Los sabores que hicieron famoso al bubble tea. Té y crema no láctea con perlas, jelly o pasta de taro.",
    picks: ["Pearl Milk Tea", "Taro Boba", "Taipei Special", "QQ Style"],
  },
  {
    slug: "tes-refrescantes",
    name: "Tés Refrescantes",
    blurb: "Extractos frutales y florales sobre té verde, royal o negro. Ligeros y sin lácteos.",
    picks: ["Frutos Rojos", "Maracuyá Royal", "Elegant Rose", "Lychee Negro"],
  },
  {
    slug: "especiales-leche",
    name: "Especiales en Leche",
    blurb: "Cremosos de verdad: té con crema no láctea, leche y coronas de crema.",
    picks: ["Té clásico", "Rosa Clásica", "Fresas con Crema", "Oolong Peach"],
  },
  {
    slug: "smoothies",
    name: "Smoothies",
    blurb: "Granizados para el calor de Bogotá, con fruta, té royal y leche condensada.",
    picks: ["Maracuyá Smoothie", "Wild Berries", "Limonada de Coco", "Taro Batido"],
  },
  {
    slug: "super-alimentos",
    name: "Super Alimentos",
    blurb: "La opción nutritiva: matcha molido, jengibre, chía y agar.",
    picks: ["Kyoto Matcha", "Matchia", "Ginger Cítrico", "Agar Milk Tea"],
  },
  {
    slug: "clasicos-taiwan",
    name: "Tés Clásicos de Taiwán",
    blurb: "Para los que aman el té puro. Sin fruta, sin leche: solo la infusión.",
    picks: ["Jadeite Royal", "Jasmine Verde", "Earl Grey", "Tieguanyin Oolong"],
  },
] as const;

export const toppings = [
  "Perlas",
  "Mini perlas",
  "Perlas de melón",
  "Perlas de arándanos",
  "Coffee jelly",
  "Tropical jelly",
  "Pudín",
  "Aloe",
  "Agar",
  "Semillas de chía",
] as const;

export const customizations = [
  { label: "Azúcar", options: "Sin · Poca · Normal · Mucha" },
  { label: "Hielo", options: "Sin · Poco · Normal · Mucho" },
  { label: "Agrandado", options: "700 ml · 24 oz" },
] as const;

export const clubBenefits = [
  {
    title: "Un sello por visita",
    body: "Muestras tu QR en caja y listo. Sin tarjetas de cartón que se pierden en la billetera.",
  },
  {
    title: "Premios que sí llegan",
    body: "Al completar la tarjeta reclamas tu bebida gratis. Te avisamos por WhatsApp apenas se desbloquea.",
  },
  {
    title: "Tu historial, siempre a la mano",
    body: "Cada compra queda registrada: qué pediste, cuánto acumulaste y qué te falta para el próximo premio.",
  },
] as const;

export const STAMP_GOAL = 5;
