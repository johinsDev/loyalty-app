import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "as-needed",
  // Folder names under app/[locale] are English (canonical internal route).
  // Values are the public URL per locale — "/profile" → "/perfil" for es,
  // "/profile" for en.
  pathnames: {
    "/": "/",
    "/profile": { es: "/perfil", en: "/profile" },
    "/card": { es: "/tarjeta", en: "/card" },
    "/whatsapp-outbox": "/whatsapp-outbox",
    "/whatsapp-outbox/[id]": "/whatsapp-outbox/[id]",
    "/sms-outbox": "/sms-outbox",
    "/sms-outbox/[id]": "/sms-outbox/[id]",
  },
});

export type AppLocale = (typeof routing.locales)[number];
