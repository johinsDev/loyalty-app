"use client";

import { Badge } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { CreatePromoButton } from "./create-promo-button";

/**
 * Client-side promo list. Uses React Query (not an RSC) so returning to it after
 * creating/publishing always shows fresh data — React Query refetches on mount +
 * window focus, and `create`/`publish` invalidate this query. (An RSC list would
 * be served stale from the Next.js router cache until a hard reload.)
 */
export function PromoListView() {
  const trpc = useTRPC();
  const t = useTranslations("Promotions");
  const locale = useLocale();
  const { data, isLoading, error } = useQuery(
    trpc.promociones.list.queryOptions({}),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        {!error && <CreatePromoButton label={t("new")} />}
      </div>

      {error ? (
        // managerProcedure — staff without the role lands here.
        <p className="text-sm text-muted-foreground">{t("forbidden")}</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : !data || data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-2 font-medium">{t("colName")}</th>
              <th className="py-2 font-medium">{t("colStatus")}</th>
              <th className="py-2 font-medium">{t("colUpdated")}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border last:border-0 hover:bg-muted/50"
              >
                <td className="py-2">
                  <Link
                    href={{ pathname: "/promotions/[id]", params: { id: p.id } }}
                    className="font-medium text-foreground hover:underline"
                  >
                    {p.name ?? t("untitled")}
                  </Link>
                </td>
                <td className="py-2">
                  <Badge
                    variant={p.status === "published" ? "default" : "secondary"}
                  >
                    {p.status === "published"
                      ? t("statusPublished")
                      : t("statusDraft")}
                  </Badge>
                </td>
                <td className="py-2 text-muted-foreground">
                  {new Date(p.updatedAt).toLocaleDateString(locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
