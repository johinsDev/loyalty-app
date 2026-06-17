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
    "/customers": { es: "/clientes", en: "/customers" },
    "/rewards": { es: "/premios", en: "/rewards" },
    "/notifications": { es: "/notificaciones", en: "/notifications" },
    "/promotions": { es: "/promociones", en: "/promotions" },
    "/promotions/[id]": { es: "/promociones/[id]", en: "/promotions/[id]" },
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
