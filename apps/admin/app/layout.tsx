import { brandThemeCss, ThemeProvider } from "@loyalty/ui";
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
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
  // `<html lang>` is set to the default locale so the root layout stays fully
  // static (reading the `NEXT_LOCALE` cookie here would force the whole shell —
  // and `/_not-found` — dynamic under `cacheComponents`). The URL-driven locale
  // (next-intl `as-needed` prefix) still localizes the app itself; this attribute
  // is only the document-level default.
  const lang = routing.defaultLocale;

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
