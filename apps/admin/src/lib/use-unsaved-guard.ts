"use client";

import { useEffect, useRef } from "react";

/**
 * Guard against losing unsaved edits. While `when` is true it:
 *  - prompts on tab close / refresh (`beforeunload`), and
 *  - intercepts clicks on in-app links (sidebar, anything navigating away) and
 *    calls `onIntercept(href)` instead of letting the navigation happen — so the
 *    caller can show a confirm dialog.
 *
 * Returns a `bypass` ref: set `bypass.current = true` right before a deliberate
 * navigation (e.g. the user confirmed "leave") so the guard steps aside.
 */
export function useNavigationGuard(when: boolean, onIntercept: (href: string) => void) {
  const bypass = useRef(false);
  const intercept = useRef(onIntercept);
  intercept.current = onIntercept;

  useEffect(() => {
    if (!when) return;
    bypass.current = false;

    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (bypass.current) return;
      e.preventDefault();
      e.returnValue = "";
    };

    const onClick = (e: MouseEvent) => {
      if (bypass.current || e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      const href = anchor?.getAttribute("href");
      if (!anchor || !href || href.startsWith("#")) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      intercept.current(url.pathname + url.search + url.hash);
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [when]);

  return bypass;
}
