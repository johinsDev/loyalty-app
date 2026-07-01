"use client";

import type { OfferInput } from "@loyalty/api/features/campaigns/schemas";
import {
  Button,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { ExternalLink } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

type Kind = "none" | "promo" | "reward";
type Entity = { id: string; name: string };

/**
 * Optional linked offer for a campaign — a Promo or a Reward. Drives the
 * "Canjeados" funnel stage. Kind is a segmented button group; the entity is a
 * searchable combobox that shows the offer's NAME (works in id-space, so the
 * backend can attribute redemptions).
 */
export function CampaignOfferPicker({
  value,
  onChange,
}: {
  value: OfferInput | null;
  onChange: (offer: OfferInput | null) => void;
}) {
  const t = useTranslations("Campaigns");
  const trpc = useTRPC();
  const kind: Kind = value?.kind ?? "none";

  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, { wait: 250 });

  const promos = useQuery({
    ...trpc.promociones.list.queryOptions({
      page: 1,
      pageSize: 20,
      search: debounced || undefined,
    }),
    enabled: kind === "promo",
  });
  const rewards = useQuery({
    ...trpc.rewards.catalog.queryOptions({ search: debounced || undefined }),
    enabled: kind === "reward",
  });

  const fetched: Entity[] =
    kind === "promo"
      ? (promos.data?.rows ?? []).map((p) => ({ id: p.id, name: p.name ?? "" }))
      : kind === "reward"
        ? (rewards.data ?? []).map((r) => ({ id: r.id, name: r.name }))
        : [];

  // Remember names so the selected entity shows its label even after the list
  // re-queries (the combobox value carries only the id).
  const labels = useRef<Record<string, string>>({});
  for (const it of fetched) labels.current[it.id] = it.name;

  const selected: Entity | null = value?.id
    ? { id: value.id, name: labels.current[value.id] ?? "" }
    : null;

  const setKind = (k: Kind) => {
    setQuery("");
    onChange(k === "none" ? null : { kind: k, id: "" });
  };

  const KINDS: { key: Kind; label: string }[] = [
    { key: "none", label: t("offerNone") },
    { key: "promo", label: t("offerPromo") },
    { key: "reward", label: t("offerReward") },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <Button
            key={k.key}
            type="button"
            size="sm"
            variant={kind === k.key ? "default" : "outline"}
            className="h-9 rounded-full"
            onClick={() => setKind(k.key)}
          >
            {k.label}
          </Button>
        ))}
      </div>

      {kind !== "none" ? (
        <Combobox
          items={fetched}
          value={selected}
          onValueChange={(v: Entity | null) =>
            onChange(v ? { kind, id: v.id } : { kind, id: "" })
          }
          itemToStringLabel={(i: Entity) => i.name}
          isItemEqualToValue={(a: Entity, b: Entity) => a.id === b.id}
          filter={null}
          onInputValueChange={setQuery}
        >
          <ComboboxInput
            placeholder={t("offerSearchPlaceholder")}
            className="h-10 rounded-xl"
            showClear={!!value?.id}
          />
          <ComboboxContent>
            <ComboboxEmpty className="py-3">{t("offerEmpty")}</ComboboxEmpty>
            <ComboboxList className="p-2">
              {fetched.map((it) => (
                <ComboboxItem
                  key={it.id}
                  value={it}
                  className="rounded-lg px-3 py-2.5"
                >
                  <span className="flex-1 truncate">{it.name}</span>
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      ) : null}

      {value?.id ? (
        <Link
          href={{
            pathname: kind === "reward" ? "/rewards/[id]" : "/promotions/[id]",
            params: { id: value.id },
          }}
          target="_blank"
          className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline"
        >
          {t("offerViewDetail")}
          <ExternalLink className="size-3" />
        </Link>
      ) : null}
    </div>
  );
}
