import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "as-needed",
  // Always default to Spanish — don't switch to English based on the browser's
  // Accept-Language. Users opt into English explicitly via the locale switcher.
  localeDetection: false,
  // Folder names under app/[locale] are English (canonical internal route).
  // Values are the public URL per locale.
  // Admin CRM routes live under a `[storeId]` segment — `all` (aggregate) or a
  // real store id — so switching store re-scopes the whole app by URL. The
  // segment is non-localized (identical in both locales). Register (caja), auth
  // and dev tools are org-level and stay at the root.
  pathnames: {
    "/": "/",
    "/register": { es: "/caja", en: "/register" },
    "/register/menu": { es: "/caja/menu", en: "/register/menu" },
    "/register/rewards": { es: "/caja/premios", en: "/register/rewards" },
    "/register/purchases": { es: "/caja/compras", en: "/register/purchases" },
    "/register/profile": { es: "/caja/perfil", en: "/register/profile" },
    "/[storeId]/dashboard": "/[storeId]/dashboard",
    "/[storeId]/customers": { es: "/[storeId]/clientes", en: "/[storeId]/customers" },
    "/[storeId]/customers/new": { es: "/[storeId]/clientes/nuevo", en: "/[storeId]/customers/new" },
    "/[storeId]/customers/[id]": { es: "/[storeId]/clientes/[id]", en: "/[storeId]/customers/[id]" },
    "/[storeId]/customers/[id]/edit": {
      es: "/[storeId]/clientes/[id]/editar",
      en: "/[storeId]/customers/[id]/edit",
    },
    "/[storeId]/purchases": { es: "/[storeId]/compras", en: "/[storeId]/purchases" },
    "/[storeId]/purchases/[id]": { es: "/[storeId]/compras/[id]", en: "/[storeId]/purchases/[id]" },
    "/[storeId]/rewards": { es: "/[storeId]/premios", en: "/[storeId]/rewards" },
    "/[storeId]/rewards/new": { es: "/[storeId]/premios/nuevo", en: "/[storeId]/rewards/new" },
    "/[storeId]/rewards/[id]": { es: "/[storeId]/premios/[id]", en: "/[storeId]/rewards/[id]" },
    "/[storeId]/loyalty": { es: "/[storeId]/lealtad", en: "/[storeId]/loyalty" },
    "/[storeId]/promotions": { es: "/[storeId]/promociones", en: "/[storeId]/promotions" },
    "/[storeId]/promotions/new": {
      es: "/[storeId]/promociones/nueva",
      en: "/[storeId]/promotions/new",
    },
    "/[storeId]/promotions/[id]": {
      es: "/[storeId]/promociones/[id]",
      en: "/[storeId]/promotions/[id]",
    },
    "/[storeId]/campaigns": { es: "/[storeId]/campanas", en: "/[storeId]/campaigns" },
    "/[storeId]/campaigns/new": { es: "/[storeId]/campanas/nueva", en: "/[storeId]/campaigns/new" },
    "/[storeId]/campaigns/[id]": { es: "/[storeId]/campanas/[id]", en: "/[storeId]/campaigns/[id]" },
    "/[storeId]/campaigns/[id]/edit": {
      es: "/[storeId]/campanas/[id]/editar",
      en: "/[storeId]/campaigns/[id]/edit",
    },
    "/[storeId]/campaigns/rules": { es: "/[storeId]/campanas/reglas", en: "/[storeId]/campaigns/rules" },
    "/[storeId]/campaigns/automated": {
      es: "/[storeId]/campanas/automatizadas",
      en: "/[storeId]/campaigns/automated",
    },
    "/[storeId]/banners": { es: "/[storeId]/banners", en: "/[storeId]/banners" },
    "/[storeId]/banners/new": { es: "/[storeId]/banners/nuevo", en: "/[storeId]/banners/new" },
    "/[storeId]/banners/[id]": { es: "/[storeId]/banners/[id]", en: "/[storeId]/banners/[id]" },
    "/[storeId]/banners/[id]/edit": {
      es: "/[storeId]/banners/[id]/editar",
      en: "/[storeId]/banners/[id]/edit",
    },
    "/[storeId]/products": { es: "/[storeId]/productos", en: "/[storeId]/products" },
    "/[storeId]/products/new": { es: "/[storeId]/productos/nuevo", en: "/[storeId]/products/new" },
    "/[storeId]/products/categories": {
      es: "/[storeId]/productos/categorias",
      en: "/[storeId]/products/categories",
    },
    "/[storeId]/products/[id]": { es: "/[storeId]/productos/[id]", en: "/[storeId]/products/[id]" },
    "/[storeId]/stores": { es: "/[storeId]/tiendas", en: "/[storeId]/stores" },
    "/[storeId]/stores/new": { es: "/[storeId]/tiendas/nueva", en: "/[storeId]/stores/new" },
    "/[storeId]/stores/[id]": { es: "/[storeId]/tiendas/[id]", en: "/[storeId]/stores/[id]" },
    "/[storeId]/stores/[id]/edit": {
      es: "/[storeId]/tiendas/[id]/editar",
      en: "/[storeId]/stores/[id]/edit",
    },
    "/[storeId]/employees": { es: "/[storeId]/empleados", en: "/[storeId]/employees" },
    "/[storeId]/employees/new": { es: "/[storeId]/empleados/nuevo", en: "/[storeId]/employees/new" },
    "/[storeId]/employees/audit": {
      es: "/[storeId]/empleados/actividad",
      en: "/[storeId]/employees/audit",
    },
    "/[storeId]/employees/performance": {
      es: "/[storeId]/empleados/rendimiento",
      en: "/[storeId]/employees/performance",
    },
    "/[storeId]/employees/[id]": { es: "/[storeId]/empleados/[id]", en: "/[storeId]/employees/[id]" },
    "/[storeId]/employees/[id]/edit": {
      es: "/[storeId]/empleados/[id]/editar",
      en: "/[storeId]/employees/[id]/edit",
    },
    "/[storeId]/employees/[id]/activity": {
      es: "/[storeId]/empleados/[id]/actividad",
      en: "/[storeId]/employees/[id]/activity",
    },
    "/[storeId]/analytics": { es: "/[storeId]/analitica", en: "/[storeId]/analytics" },
    "/[storeId]/analytics/cohorts": {
      es: "/[storeId]/analitica/cohortes",
      en: "/[storeId]/analytics/cohorts",
    },
    "/[storeId]/analytics/funnel": {
      es: "/[storeId]/analitica/embudo",
      en: "/[storeId]/analytics/funnel",
    },
    "/[storeId]/analytics/promotions": {
      es: "/[storeId]/analitica/promociones",
      en: "/[storeId]/analytics/promotions",
    },
    "/[storeId]/settings": { es: "/[storeId]/ajustes", en: "/[storeId]/settings" },
    "/[storeId]/settings/team": { es: "/[storeId]/ajustes/equipo", en: "/[storeId]/settings/team" },
    "/[storeId]/settings/integrations": {
      es: "/[storeId]/ajustes/integraciones",
      en: "/[storeId]/settings/integrations",
    },
    "/[storeId]/shortlinks": { es: "/[storeId]/enlaces", en: "/[storeId]/shortlinks" },
    "/[storeId]/shortlinks/[id]": { es: "/[storeId]/enlaces/[id]", en: "/[storeId]/shortlinks/[id]" },
    "/accept-invitation": {
      es: "/aceptar-invitacion",
      en: "/accept-invitation",
    },
    "/sign-in": { es: "/iniciar-sesion", en: "/sign-in" },
    "/whatsapp-outbox": "/whatsapp-outbox",
    "/whatsapp-outbox/[id]": "/whatsapp-outbox/[id]",
    "/sms-outbox": "/sms-outbox",
    "/sms-outbox/[id]": "/sms-outbox/[id]",
    "/email-outbox": "/email-outbox",
    "/email-outbox/[id]": "/email-outbox/[id]",
    "/push-outbox": "/push-outbox",
    "/push-outbox/[id]": "/push-outbox/[id]",
    "/realtime": "/realtime",
    "/storage": "/storage",
    "/flags": "/flags",
  },
});

export type AppLocale = (typeof routing.locales)[number];
