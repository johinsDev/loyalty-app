"use client";

import { Sheet, SheetContent, SheetTitle } from "@loyalty/ui";
import { Menu } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { usePathname } from "@/i18n/nav";

/**
 * The tablet/mobile (below lg) menu button + drawer. Reads `usePathname` to close
 * the drawer on navigation, so it's a dynamic island (lives inside the shell's
 * `<Suspense>`) rather than part of the static frame. Renders the same server nav
 * hole element as the desktop rail inside the Sheet — role stays server-resolved.
 */
export function MobileNav({ nav, label }: { nav: ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className="border-border bg-card text-muted-foreground hover:text-foreground grid size-10 flex-none place-items-center rounded-xl border lg:hidden"
      >
        <Menu className="size-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">{label}</SheetTitle>
          {nav}
        </SheetContent>
      </Sheet>
    </>
  );
}
