"use client";

import { useSyncExternalStore } from "react";

/**
 * The customer's active store, persisted per device (localStorage) and reactive
 * across the PWA. Sent as `storeId` with the catalog reads (menu, rewards,
 * banners, promos) so they show what's available at that store. The wallet
 * (points/stamps balance + history) stays org-wide and never receives it.
 * Defaults to the org's primary store — seeded by the switcher once the public
 * store list loads (mirror of the cashier's `use-active-store`).
 */
const KEY = "customer.activeStoreId";
const listeners = new Set<() => void>();

function read(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function setActiveCustomerStoreId(id: string): void {
  window.localStorage.setItem(KEY, id);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useActiveCustomerStoreId(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
