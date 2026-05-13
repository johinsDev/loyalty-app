import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "as-needed",
  // Folder names under app/[locale] are English (canonical internal route).
  // Values are the public URL per locale.
  pathnames: {
    "/": "/",
    "/dashboard": "/dashboard",
    "/customers": { es: "/clientes", en: "/customers" },
    "/rewards": { es: "/premios", en: "/rewards" },
    "/sign-in": { es: "/iniciar-sesion", en: "/sign-in" },
    "/whatsapp-outbox": "/whatsapp-outbox",
    "/whatsapp-outbox/[id]": "/whatsapp-outbox/[id]",
    "/sms-outbox": "/sms-outbox",
    "/sms-outbox/[id]": "/sms-outbox/[id]",
    "/email-outbox": "/email-outbox",
    "/email-outbox/[id]": "/email-outbox/[id]",
  },
});

export type AppLocale = (typeof routing.locales)[number];
