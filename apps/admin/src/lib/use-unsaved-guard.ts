"use client";

import { useEffect } from "react";

/** Warn on tab close / refresh while there are unsaved edits. (In-app exits are
 *  guarded with a confirm modal by the caller.) */
export function useUnsavedGuard(when: boolean): void {
  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when]);
}
