import type { PromoRow } from "@loyalty/db/schema";
import { Badge } from "@loyalty/ui";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CreatePromoButton } from "@/features/promotions/components/create-promo-button";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string }> };

export default async function PromotionsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Promotions" });

  const api = await trpc();
  let rows: PromoRow[] = [];
  let forbidden = false;
  try {
    ({ rows } = await api.promociones.list({}));
  } catch {
    forbidden = true; // managerProcedure — staff without the role
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        {!forbidden && <CreatePromoButton label={t("new")} />}
      </div>

      {forbidden ? (
        <p className="text-sm text-muted-foreground">{t("forbidden")}</p>
      ) : rows.length === 0 ? (
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
            {rows.map((p) => (
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
                  {p.updatedAt.toLocaleDateString(locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
