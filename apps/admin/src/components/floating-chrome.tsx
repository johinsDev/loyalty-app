"use client";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePathname } from "@/i18n/navigation";

// The cashier segment owns its own header and puts theme + language in the
// Perfil tab, so the floating corner controls must not overlap it there.
const HIDDEN_ON = ["/register"];

/**
 * Floating theme + language controls shown top-right across the admin, except
 * on screens that manage these themselves (the cashier register).
 */
export function FloatingChrome() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  return (
    <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
      <ThemeToggle />
      <LocaleSwitcher />
    </div>
  );
}
