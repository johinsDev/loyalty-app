"use client";

import { Button, Kbd, Popover, PopoverContent, PopoverTrigger } from "@loyalty/ui";
import { Check, ChevronsUpDown, Plus, Search, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const STORES = ["allStores", "t4Centro", "t4Norte"] as const;
type StoreKey = (typeof STORES)[number];

/**
 * Store switcher styled after Vercel's project switcher — a popover with a
 * search input (Esc hint), a checkable list, and a "Crear tienda" footer.
 * Works with a single store. Hardcoded for now; the seam is `value`/`onChange`.
 */
export function StoreSwitcher() {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [store, setStore] = useState<StoreKey>("allStores");
  const [query, setQuery] = useState("");

  const matches = STORES.filter((s) =>
    t(`store.${s}`).toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="hidden h-10 gap-2 rounded-xl sm:flex">
            <Store className="size-4" />
            <span className="max-w-32 truncate">{t(`store.${store}`)}</span>
            <ChevronsUpDown className="size-4 opacity-60" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-72 rounded-xl p-0">
        <div className="border-border relative flex items-center border-b px-3">
          <Search className="text-muted-foreground pointer-events-none size-4" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("storeSearch")}
            className="placeholder:text-muted-foreground h-11 flex-1 bg-transparent px-2 text-sm outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>

        <ul className="max-h-64 overflow-y-auto p-1.5">
          {matches.length === 0 ? (
            <li className="text-muted-foreground px-2.5 py-6 text-center text-sm">
              {t("storeEmpty")}
            </li>
          ) : (
            matches.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => {
                    setStore(s);
                    setOpen(false);
                  }}
                  className="hover:bg-muted flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium"
                >
                  <Store className="text-muted-foreground size-4 flex-none" />
                  <span className="flex-1 truncate">{t(`store.${s}`)}</span>
                  {store === s ? (
                    <Check className="text-primary size-4 flex-none" />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="border-border border-t p-1.5">
          <button
            type="button"
            className="hover:bg-muted flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium"
          >
            <Plus className="size-4 flex-none" />
            {t("createStore")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
