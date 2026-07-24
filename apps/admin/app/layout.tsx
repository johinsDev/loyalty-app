import { brandThemeCss, ThemeProvider } from "@loyalty/ui";
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { routing } from "@/i18n/routing";
import { getBranding } from "@/lib/branding-server";

import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Loyalty CRM",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const lang = routing.locales.includes(cookieLocale as (typeof routing.locales)[number])
    ? cookieLocale
    : routing.defaultLocale;

  // The admin chrome uses the preset's fixed Violet accent (see globals.css).
  // The tenant brand color only themes the customer-facing preview islands, so
  // scope `brandThemeCss` (which targets :root/.dark) down to `.preview-customer`.
  const brandCss = brandThemeCss((await getBranding())?.brandColor ?? null)
    .replaceAll(":root", ".preview-customer")
    .replaceAll(".dark", ".dark .preview-customer");

  return (
    <html
      lang={lang}
      className={`${fraunces.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {brandCss ? (
          <style id="brand-theme" dangerouslySetInnerHTML={{ __html: brandCss }} />
        ) : null}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
