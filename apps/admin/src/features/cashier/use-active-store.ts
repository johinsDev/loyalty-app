"use client";

import { useSyncExternalStore } from "react";

/**
 * The register's active store, persisted per device (localStorage) and reactive
 * across the register views. The chosen id is sent as `storeId` with
 * recordPurchase / reward-claim so the sale is attributed to that store; the
 * server validates it against the cashier's assignments and falls back to the
 * primary store when unset.
 */
const KEY = "cashier.activeStoreId";
const listeners = new Set<() => void>();

function read(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setActiveStoreId(id: string): void {
  window.localStorage.setItem(KEY, id);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useActiveStoreId(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
