"use client";

import { Badge, Button, Input, Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

/** Resolve the filtered customer's identity from the `?customer=<id>` in the
 *  URL — arriving from a profile, that's all we have. */
function useSelectedCustomer(id: string | null) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.customers.adminListByIds.queryOptions({ ids: id ? [id] : [] }),
    enabled: id != null,
    select: (rows) => rows[0] ?? null,
  });
}

export function CustomerFilterChip({
  customerId,
  onClear,
}: {
  customerId: string;
  onClear: () => void;
}) {
  const t = useTranslations("Purchases");
  const { data, isPending } = useSelectedCustomer(customerId);

  return (
    <Button variant="secondary" size="sm" className="h-10 gap-1.5 rounded-xl" onClick={onClear}>
      {isPending ? t("customerFilter") : (data?.name ?? data?.phone ?? t("customerFilter"))}
      <X className="size-3.5" />
    </Button>
  );
}

/** Server-searched single-select. The customer list is unbounded, so unlike the
 *  store / cashier facets this cannot filter a preloaded array client-side. */
export function CustomerFilter({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const t = useTranslations("Purchases");
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const selected = useSelectedCustomer(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const results = useQuery({
    ...trpc.customers.search.queryOptions({ query: debounced, limit: 20 }),
    enabled: value == null,
  });

  if (value != null) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="min-w-0 flex-1 justify-start gap-1.5 py-1.5">
          {selected.isPending ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <span className="truncate">
              {selected.data?.name ?? selected.data?.phone ?? value}
            </span>
          )}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("clearCustomer")}
          className="size-8 rounded-lg"
          onClick={() => onChange(null)}
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("searchCustomer")}
        className="h-9"
      />
      <div className="max-h-56 overflow-y-auto">
        {results.isPending ? (
          <div className="space-y-1.5 py-1">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : results.data?.length === 0 ? (
          <p className="text-muted-foreground py-3 text-center text-sm">{t("noCustomers")}</p>
        ) : (
          <ul>
            {results.data?.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onChange(c.id)}
                  className="hover:bg-muted/60 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {c.name || c.phone}
                  </span>
                  {c.name ? (
                    <span className="text-muted-foreground truncate text-xs">{c.phone}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
