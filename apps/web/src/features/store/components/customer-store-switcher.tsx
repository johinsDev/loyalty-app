"use client";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { setActiveCustomerStoreId, useActiveCustomerStoreId } from "../use-active-customer-store";

/**
 * Customer store switcher — lets the customer pick which store's catalog
 * (menu / rewards / banners / promos) they're browsing. Published stores only,
 * no "all" (a customer is always in one store); defaults to the org's primary
 * and persists per device. Hidden for single-store orgs. The loyalty wallet
 * stays org-wide and is unaffected by the choice.
 */
export function CustomerStoreSwitcher() {
  const t = useTranslations("Store");
  const trpc = useTRPC();
  const { data: stores } = useQuery(trpc.stores.listPublic.queryOptions());
  const active = useActiveCustomerStoreId();
  const [open, setOpen] = useState(false);

  // Seed to the primary (first, listPublic is primary-ordered) when unset/stale.
  useEffect(() => {
    if (!stores || stores.length === 0) return;
    if (!stores.some((s) => s.id === active)) setActiveCustomerStoreId(stores[0]!.id);
  }, [stores, active]);

  if (!stores || stores.length <= 1) return null;
  const current = stores.find((s) => s.id === active) ?? stores[0]!;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border bg-card text-foreground flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold"
      >
        <MapPin className="text-primary size-4" />
        <span className="max-w-32 truncate">{current.name}</span>
        <ChevronDown className="text-muted-foreground size-4" />
      </button>

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("switcherTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <ul className="space-y-1 px-3 pb-4 sm:px-1">
            {stores.map((s) => {
              const selected = s.id === current.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCustomerStoreId(s.id);
                      setOpen(false);
                    }}
                    className="hover:bg-muted flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left"
                  >
                    <MapPin className="text-primary size-5 flex-none" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.name}</div>
                      {s.address ? (
                        <div className="text-muted-foreground truncate text-xs">{s.address}</div>
                      ) : null}
                    </div>
                    {selected ? <Check className="text-primary size-5 flex-none" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
