"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { Store as StoreIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { setActiveStoreId, useActiveStoreId } from "../use-active-store";

/**
 * Register store-switcher — limited to the cashier's assigned stores (all stores
 * when unassigned). Auto-selects when there's a single store; hidden entirely
 * when the org has just one. The choice is sent with every recorded sale/claim.
 */
export function StoreSwitcher() {
  const trpc = useTRPC();
  const { data: stores } = useQuery(trpc.employees.myStores.queryOptions());
  const active = useActiveStoreId();

  // Cashier mode opened from a store-scoped admin passes ?storeId=<id> — adopt it
  // once (if the cashier is assigned there), overriding the device default.
  const inherited = useSearchParams().get("storeId");
  const adopted = useRef(false);
  useEffect(() => {
    if (adopted.current || !stores || !inherited) return;
    if (stores.some((s) => s.id === inherited)) {
      adopted.current = true;
      setActiveStoreId(inherited);
    }
  }, [stores, inherited]);

  useEffect(() => {
    if (!stores || stores.length === 0) return;
    const valid = stores.some((s) => s.id === active);
    if (!valid) setActiveStoreId(stores[0]!.id);
  }, [stores, active]);

  if (!stores || stores.length <= 1) return null;

  return (
    <Select value={active ?? undefined} onValueChange={(v) => v && setActiveStoreId(v)}>
      <SelectTrigger size="sm" className="h-9 gap-1.5 rounded-xl text-sm">
        <StoreIcon className="size-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {stores.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
