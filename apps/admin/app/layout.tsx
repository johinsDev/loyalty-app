import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { routing } from "@/i18n/routing";

import "./globals.css";

export const metadata: Metadata = {
  title: "Loyalty CRM",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const lang = routing.locales.includes(cookieLocale as (typeof routing.locales)[number])
    ? cookieLocale
    : routing.defaultLocale;

  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
