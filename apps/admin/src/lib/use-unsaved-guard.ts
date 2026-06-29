"use client";

import { useEffect, useRef } from "react";

/**
 * Guard against losing unsaved edits. While `when` is true it intercepts every
 * way of leaving the page and calls `onIntercept(href)` instead, so the caller
 * can show a confirm dialog:
 *  - in-app link clicks (sidebar, anything navigating away) → `onIntercept(href)`
 *  - the browser Back/Forward buttons (`popstate`) → `onIntercept("__back__")`
 *  - tab close / refresh → the native `beforeunload` prompt
 *
 * Returns a `bypass` ref: set `bypass.current = true` right before a deliberate
 * navigation (the user confirmed "leave") so the guard steps aside.
 */
export function useNavigationGuard(when: boolean, onIntercept: (href: string) => void) {
  const bypass = useRef(false);
  const whenRef = useRef(when);
  whenRef.current = when;
  const intercept = useRef(onIntercept);
  intercept.current = onIntercept;
  const primed = useRef(false);

  // Prime one history entry the first time there are unsaved changes, so the
  // first Back press lands on a duplicate of this page (cancellable) instead of
  // actually navigating away.
  useEffect(() => {
    if (when && !primed.current && typeof window !== "undefined") {
      window.history.pushState(null, "", window.location.href);
      primed.current = true;
    }
  }, [when]);

  useEffect(() => {
    const active = () => whenRef.current && !bypass.current;

    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!active()) return;
      e.preventDefault();
      e.returnValue = "";
    };

    const onClick = (e: MouseEvent) => {
      if (!active() || e.defaultPrevented) return;
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

    const onPopState = () => {
      if (!active()) return;
      // Re-push so the page doesn't actually leave, then surface the prompt.
      window.history.pushState(null, "", window.location.href);
      intercept.current("__back__");
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return bypass;
}
