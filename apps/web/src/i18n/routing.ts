import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "as-needed",
  // Always default to Spanish — don't switch to English based on the browser's
  // Accept-Language. Users opt into English explicitly via the locale switcher.
  localeDetection: false,
  // Folder names under app/[locale] are English (canonical internal route).
  // Values are the public URL per locale — "/profile" → "/perfil" for es,
  // "/profile" for en.
  pathnames: {
    "/": "/",
    "/welcome": { es: "/bienvenida", en: "/welcome" },
    "/profile": { es: "/perfil", en: "/profile" },
    "/rewards": { es: "/recompensas", en: "/rewards" },
    "/card": { es: "/tarjeta", en: "/card" },
    "/notifications": { es: "/notificaciones", en: "/notifications" },
    "/sign-in": { es: "/iniciar-sesion", en: "/sign-in" },
    "/complete-phone": { es: "/completar-telefono", en: "/complete-phone" },
  },
});

export type AppLocale = (typeof routing.locales)[number];
