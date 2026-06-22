"use client";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePathname } from "@/i18n/navigation";

// Screens with their own chrome own the theme + language controls (the cashier
// Perfil tab; the admin topbar user menu), so the floating corner must not
// overlap them. It stays for chrome-less screens (sign-in, dev tools).
const HIDDEN_ON = [
  "/register",
  "/dashboard",
  "/customers",
  "/purchases",
  "/products",
  "/rewards",
  "/promotions",
  "/campaigns",
  "/notifications",
  "/banners",
  "/analytics",
  "/stores",
  "/employees",
  "/settings",
];

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
