"use client";

import { InstallPrompt } from "@/components/install-prompt";
import { usePathname } from "@/i18n/navigation";

// Theme + language now live in the profile (Preferences). What's left here is
// the install prompt, hidden on the full-bleed onboarding/auth/home screens
// (which have their own header) and shown on the inner app pages.
const HIDDEN_ON = ["/", "/welcome", "/qr", "/sign-in", "/complete-phone"];

export function AppChrome() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  return <InstallPrompt />;
}
