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

export const categories = [
  {
    slug: "milk-tea",
    name: "Milk Tea",
    blurb: "El clásico cremoso con perlas de tapioca recién cocidas. Brown sugar, taro o el de siempre.",
    picks: ["Brown Sugar Boba", "Taro Milk Tea", "Classic Milk Tea"],
  },
  {
    slug: "matcha",
    name: "Matcha",
    blurb: "Matcha ceremonial batido al momento, con leche de avena o una nube de fresa encima.",
    picks: ["Iced Matcha Latte", "Matcha Strawberry"],
  },
  {
    slug: "frutales",
    name: "Frutales",
    blurb: "Té de verdad con fruta de verdad. Ligeros, sin lácteos, para los días de calor.",
    picks: ["Peach Oolong", "Strawberry Cloud", "Mango Tango"],
  },
  {
    slug: "especiales",
    name: "Especiales",
    blurb: "Ediciones de temporada que rotan. Cuando se acaban, se acaban.",
    picks: ["Spring Drop", "Dragon Fruit Fizz"],
  },
] as const;

export const customizations = [
  { label: "Tamaño", options: "Mediano · Grande" },
  { label: "Azúcar", options: "0% · 50% · 100%" },
  { label: "Toppings", options: "Perlas · Pudín · Jelly" },
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
