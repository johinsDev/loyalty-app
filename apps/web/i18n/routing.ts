import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "as-needed",
  pathnames: {
    "/": "/",
    "/perfil": { es: "/perfil", en: "/profile" },
    "/tarjeta": { es: "/tarjeta", en: "/card" },
  },
});

export type AppLocale = (typeof routing.locales)[number];
