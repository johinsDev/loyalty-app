"use client";

import type { AppRouter } from "@loyalty/api";
import { formatDate } from "@loyalty/date";
import { Badge, Button, StoreAddressPreview } from "@loyalty/ui";
import type { inferRouterOutputs } from "@trpc/server";
import { Clock, Pencil, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

type StoreDetail = NonNullable<inferRouterOutputs<AppRouter>["stores"]["get"]>;

/** Mon→Sun display order over the 0 (Sun)–6 (Sat) keys used by `StoreHours`. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DAY_KEY: Record<number, string> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

/**
 * Read-only store summary — rendered both as the intercepted modal (over the
 * list) and as the full `/stores/[id]` page. Mirrors the customer card (map +
 * address via `StoreAddressPreview`) and surfaces hours/contact/meta. "Editar"
 * routes to the wizard at `/stores/[id]/edit`.
 */
export function StoreDetailView({
  store,
  variant = "page",
}: {
  store: StoreDetail;
  variant?: "page" | "modal";
}) {
  const t = useTranslations("Stores");
  const locale = useLocale();
  const router = useRouter();

  const hours = store.hours as Record<
    string,
    { open: string; close: string; closed: boolean } | undefined
  > | null;

  return (
    <div className={variant === "modal" ? "space-y-5 p-1" : "space-y-5"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display truncate text-xl font-semibold tracking-tight">
            {store.name || t("namePlaceholder")}
          </h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {store.status === "draft" ? (
              <Badge variant="outline">{t("draft")}</Badge>
            ) : (
              <Badge>{t("published")}</Badge>
            )}
            {store.isPrimary ? <Badge variant="secondary">{t("primary")}</Badge> : null}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 shrink-0 gap-1.5 rounded-xl"
          onClick={() => router.push({ pathname: "/stores/[id]/edit", params: { id: store.id } })}
        >
          <Pencil className="size-4" />
          {t("edit")}
        </Button>
      </div>

      <StoreAddressPreview
        address={store.addressParts ?? null}
        name={store.name}
        mapStaticUrl={store.mapStaticUrl}
        labels={{ title: t("previewTitle"), empty: t("previewEmpty") }}
      />

      <section className="space-y-2">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
          <Clock className="size-3.5" />
          {t("fieldHours")}
        </p>
        {hours ? (
          <div className="bg-card border-border divide-border divide-y rounded-2xl border">
            {DAY_ORDER.map((d) => {
              const h = hours[String(d)];
              return (
                <div key={d} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="font-medium">{t(`day.${DAY_KEY[d]}`)}</span>
                  <span className="text-muted-foreground">
                    {!h || h.closed ? t("closed") : `${h.open}–${h.close}`}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("inheritHoursHint")}</p>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
          <Phone className="size-3.5" />
          {t("fieldPhone")}
        </p>
        <p className="text-sm">
          {store.phone || <span className="text-muted-foreground">{t("inheritPhone")}</span>}
        </p>
      </section>

      <dl className="text-muted-foreground grid grid-cols-2 gap-y-1 text-sm">
        <dt>{t("fieldPublished")}</dt>
        <dd className="text-right">{store.isPublished ? t("yes") : t("no")}</dd>
        <dt>{t("colCreated")}</dt>
        <dd className="text-right">{formatDate(store.createdAt, { locale })}</dd>
      </dl>
    </div>
  );
}
