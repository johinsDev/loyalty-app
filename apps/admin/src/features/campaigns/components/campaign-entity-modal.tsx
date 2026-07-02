"use client";

import type { EditorVariable } from "@loyalty/ui";
import {
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

type Scope = "promo" | "product" | "reward" | "category";
type Entity = { id: string; name: string };

/**
 * Search + pick an entity (promo / product / reward) to insert as a bound
 * variable chip. Each result offers "name" or "link" (`.href` → auto-shortlink).
 * Resolves the chosen `{token,label}` back to the editor, or null on cancel.
 */
export function CampaignEntityModal({
  scope,
  onResolve,
}: {
  scope: Scope | null;
  onResolve: (v: EditorVariable | null) => void;
}) {
  const t = useTranslations("Campaigns");
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, { wait: 250 });

  const promos = useQuery({
    ...trpc.promociones.list.queryOptions({ page: 1, pageSize: 20, search: debounced || undefined }),
    enabled: scope === "promo",
  });
  const products = useQuery({
    ...trpc.menu.list.queryOptions({ search: debounced || undefined, pageSize: 20 }),
    enabled: scope === "product",
  });
  const rewards = useQuery({
    ...trpc.rewards.catalog.queryOptions({ search: debounced || undefined }),
    enabled: scope === "reward",
  });
  // `menu.categories` takes no search arg — filter client-side.
  const categories = useQuery({
    ...trpc.menu.categories.queryOptions(),
    enabled: scope === "category",
  });

  const results: Entity[] =
    scope === "promo"
      ? (promos.data?.rows ?? []).map((p) => ({ id: p.id, name: p.name ?? "" }))
      : scope === "product"
        ? (products.data?.items ?? []).map((p) => ({ id: p.id, name: p.name }))
        : scope === "reward"
          ? (rewards.data ?? []).map((r) => ({ id: r.id, name: r.name }))
          : scope === "category"
            ? (categories.data ?? [])
                .filter(
                  (c) =>
                    !debounced || c.name.toLowerCase().includes(debounced.toLowerCase()),
                )
                .map((c) => ({ id: c.id, name: c.name }))
            : [];

  // Always the entity's tracked link; its name is the editable, linked text.
  const pick = (ent: Entity) => {
    onResolve({ token: `{{${scope}#${ent.id}.href}}`, label: ent.name });
    setQuery("");
  };

  return (
    <ResponsiveModal
      open={scope !== null}
      onOpenChange={(o) => {
        if (!o) {
          onResolve(null);
          setQuery("");
        }
      }}
    >
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>
            {scope ? t(`entityPick.${scope}`) : ""}
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="space-y-3 p-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("offerSearchPlaceholder")}
            className="h-10"
            autoFocus
          />
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">{t("offerEmpty")}</p>
            ) : (
              results.map((ent) => (
                <button
                  key={ent.id}
                  type="button"
                  onClick={() => pick(ent)}
                  className="border-border hover:bg-muted/50 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left"
                >
                  <Link2 className="text-muted-foreground size-4 shrink-0" />
                  <span className="flex-1 truncate text-sm font-medium">{ent.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
