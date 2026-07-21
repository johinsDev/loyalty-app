"use client";

import { Button, Kbd, Popover, PopoverContent, PopoverTrigger } from "@loyalty/ui";
import { Check, ChevronsUpDown, Plus, Search, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { QuickCreateStore } from "@/features/stores/components/quick-create-store";
import { usePathname as useIntlPathname, useRouter as useIntlRouter } from "@/i18n/navigation";
import { ALL_STORES, useStoreScope } from "@/lib/store-scope";

/**
 * Store switcher (Vercel project-switcher styled): search + a checkable list of
 * the org's stores plus an aggregate "Todas las tiendas" entry, and a
 * "Crear tienda" footer. Choosing a store re-scopes the whole admin by URL —
 * it keeps the current top-level section (dashboard, customers, …) and swaps the
 * `[storeId]` segment, so you stay where you are, now scoped to that store.
 */
export function StoreSwitcher() {
  const t = useTranslations("Admin");
  const { segment, store, stores } = useStoreScope();
  const router = useIntlRouter();
  const pathname = useIntlPathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Keep the current top-level section when switching store; land on its index.
  const section = pathname.split("/").filter(Boolean)[1] ?? "dashboard";

  const label = segment === ALL_STORES ? t("store.allStores") : (store?.name || t("store.unnamed"));

  const filtered = stores.filter((s) =>
    (s.name || t("store.unnamed")).toLowerCase().includes(query.trim().toLowerCase()),
  );

  const switchTo = (target: string) => {
    setOpen(false);
    setQuery("");
    router.push({
      pathname: `/[storeId]/${section}` as never,
      params: { storeId: target },
    });
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" className="hidden h-10 gap-2 rounded-xl sm:flex">
              <Store className="size-4" />
              <span className="max-w-32 truncate">{label}</span>
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
            <li>
              <StoreRow
                icon={<Store className="text-muted-foreground size-4 flex-none" />}
                label={t("store.allStores")}
                selected={segment === ALL_STORES}
                onSelect={() => switchTo(ALL_STORES)}
              />
            </li>
            {filtered.length === 0 && query ? (
              <li className="text-muted-foreground px-2.5 py-6 text-center text-sm">
                {t("storeEmpty")}
              </li>
            ) : (
              filtered.map((s) => (
                <li key={s.id}>
                  <StoreRow
                    icon={<Store className="text-muted-foreground size-4 flex-none" />}
                    label={s.name || t("store.unnamed")}
                    selected={segment === s.id}
                    onSelect={() => switchTo(s.id)}
                  />
                </li>
              ))
            )}
          </ul>

          <div className="border-border border-t p-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="hover:bg-muted flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium"
            >
              <Plus className="size-4 flex-none" />
              {t("createStore")}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <QuickCreateStore open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

function StoreRow({
  icon,
  label,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="hover:bg-muted flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium"
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {selected ? <Check className="text-primary size-4 flex-none" /> : null}
    </button>
  );
}
