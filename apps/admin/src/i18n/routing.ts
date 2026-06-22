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
  pathnames: {
    "/": "/",
    "/dashboard": "/dashboard",
    "/register": { es: "/caja", en: "/register" },
    "/register/menu": { es: "/caja/menu", en: "/register/menu" },
    "/register/rewards": { es: "/caja/premios", en: "/register/rewards" },
    "/register/purchases": { es: "/caja/compras", en: "/register/purchases" },
    "/register/profile": { es: "/caja/perfil", en: "/register/profile" },
    "/customers": { es: "/clientes", en: "/customers" },
    "/purchases": { es: "/compras", en: "/purchases" },
    "/rewards": { es: "/premios", en: "/rewards" },
    "/promotions": { es: "/promociones", en: "/promotions" },
    "/promotions/[id]": { es: "/promociones/[id]", en: "/promotions/[id]" },
    "/campaigns": { es: "/campanas", en: "/campaigns" },
    "/notifications": { es: "/notificaciones", en: "/notifications" },
    "/banners": { es: "/banners", en: "/banners" },
    "/products": { es: "/productos", en: "/products" },
    "/stores": { es: "/tiendas", en: "/stores" },
    "/employees": { es: "/empleados", en: "/employees" },
    "/analytics": { es: "/analitica", en: "/analytics" },
    "/settings": { es: "/ajustes", en: "/settings" },
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
    "/shortlinks": { es: "/enlaces", en: "/shortlinks" },
    "/shortlinks/[id]": { es: "/enlaces/[id]", en: "/shortlinks/[id]" },
  },
});

export type AppLocale = (typeof routing.locales)[number];
