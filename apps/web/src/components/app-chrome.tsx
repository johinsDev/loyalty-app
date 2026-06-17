"use client";

import { InstallPrompt } from "@/components/install-prompt";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePathname } from "@/i18n/navigation";

// The onboarding/auth screens AND the home are full-bleed mobile designs with
// their own header — the floating theme/locale switchers and the install prompt
// overlap them (and aren't part of the design). Hide all global chrome there; it
// still shows on the inner app pages. (Install + theme/locale move into the
// profile later.)
const HIDDEN_ON = ["/", "/welcome", "/sign-in", "/complete-phone"];

export function AppChrome() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  return (
    <>
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
      <InstallPrompt />
    </>
  );
}
