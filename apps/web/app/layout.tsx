import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { InstallPrompt } from "../components/install-prompt";
import { Providers } from "./providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Loyalty",
  description: "Tarjeta digital de fidelización",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Loyalty",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
        <InstallPrompt />
      </body>
    </html>
  );
}
