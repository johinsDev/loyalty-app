import { brandThemeCss, ThemeProvider } from "@loyalty/ui";
import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { routing } from "@/i18n/routing";
import { trpc } from "@/lib/trpc/server";

import "./globals.css";

const DEFAULT_THEME_COLOR = "#1bad9d";

/** Org brand color (cached, public). Null when unreachable/unset → defaults. */
async function brandColor(): Promise<string | null> {
  try {
    const api = await trpc();
    const branding = await api.settings.branding();
    return branding.brandColor ?? null;
  } catch {
    return null;
  }
}

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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Loyalty",
  },
};

export async function generateViewport(): Promise<Viewport> {
  return {
    themeColor: (await brandColor()) ?? DEFAULT_THEME_COLOR,
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const lang = routing.locales.includes(cookieLocale as (typeof routing.locales)[number])
    ? cookieLocale
    : routing.defaultLocale;

  const themeCss = brandThemeCss(await brandColor());

  return (
    <html
      lang={lang}
      className={`${fraunces.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body>
        {themeCss ? (
          <style id="brand-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />
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
