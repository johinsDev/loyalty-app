"use client";

import { useEffect, useState } from "react";

import {
  type BeforeInstallPromptEvent,
  isStandalone,
  registerInstallPromptListener,
} from "../lib/pwa";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    return registerInstallPromptListener(setDeferred);
  }, []);

  if (installed || !deferred) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === "accepted") setInstalled(true);
        setDeferred(null);
      }}
      className="fixed bottom-4 right-4 rounded-full bg-green-600 px-5 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-green-700"
    >
      Instalar app
    </button>
  );
}
