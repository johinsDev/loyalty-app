"use client";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePathname } from "@/i18n/navigation";

// Screens with their own chrome own the theme + language controls (the cashier
// Perfil tab; the admin topbar user menu), so the floating corner must not
// overlap them. It stays for chrome-less screens (sign-in, dev tools). Dashboard
// routes now live under a `/[storeId]` segment, so we match both the raw path
// and the path with its leading store segment stripped.
const HIDDEN_ON = [
  "/register",
  "/dashboard",
  "/customers",
  "/purchases",
  "/products",
  "/rewards",
  "/promotions",
  "/loyalty",
  "/campaigns",
  "/notifications",
  "/banners",
  "/analytics",
  "/stores",
  "/employees",
  "/settings",
  "/shortlinks",
];

/**
 * Floating theme + language controls shown top-right across the admin, except
 * on screens that manage these themselves (the cashier register + the store-
 * scoped dashboard, whose user menu owns them).
 */
export function FloatingChrome() {
  const pathname = usePathname();
  const withoutStore = pathname.replace(/^\/[^/]+/, "");
  const isHidden = HIDDEN_ON.some(
    (p) =>
      pathname === p ||
      pathname.startsWith(`${p}/`) ||
      withoutStore === p ||
      withoutStore.startsWith(`${p}/`),
  );
  if (isHidden) {
    return null;
  }
  return (
    <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
      <ThemeToggle />
      <LocaleSwitcher />
    </div>
  );
}
