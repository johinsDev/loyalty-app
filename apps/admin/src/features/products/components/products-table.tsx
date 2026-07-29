import type { AppRouter } from "@loyalty/api";
import { Badge } from "@loyalty/ui";
import type { inferRouterOutputs } from "@trpc/server";
import { getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import {
  type ServerColumn,
  ServerPagination,
  ServerSortHeader,
  ServerTable,
} from "@/components/data-table";
import { StoreAvailabilityBadge } from "@/features/stores/components/store-availability-badge";
import { Link } from "@/i18n/nav";
import { trpc } from "@/lib/trpc/server";

import { buildProductsInput, loadProductsSearchParams } from "../list-params";
import { ProductRowActions } from "./product-row-actions";

type ProductRow = inferRouterOutputs<AppRouter>["menu"]["adminList"]["rows"][number];

/**
 * Server-rendered products table — the dynamic Suspense hole. Reads the URL
 * params, scopes to the active store, runs `menu.adminList` on the server and
 * streams the rows. Interactive cells (name→editor Link, the ⋯ row menu) are
 * client islands; everything else is plain server JSX. Grid is the default view
 * (image-first); list renders the shared `ServerTable`.
 */
export async function ProductsTable({
  searchParams,
  storeId,
}: {
  searchParams: SearchParams;
  storeId: string | null;
}) {
  const t = await getTranslations("Products");

  const values = loadProductsSearchParams(searchParams);
  const input = { ...buildProductsInput(values), storeId: storeId ?? undefined };
  const data = await (await trpc()).menu.adminList(input);
  const pageCount = Math.max(1, Math.ceil(data.total / values.perPage));

  const price = (r: ProductRow) => `$${(r.basePriceCents / 100).toFixed(2)}`;
  const thumb = (r: ProductRow, size: string) => (
    <span className={`bg-muted/50 grid ${size} flex-none place-items-center overflow-hidden rounded-xl`}>
      {r.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.imageUrl} alt="" className="size-full object-cover" />
      ) : (
        "🛍️"
      )}
    </span>
  );
  const statusBadge = (r: ProductRow) => (
    <Badge
      variant="secondary"
      className={r.status === "active" ? "text-emerald-600" : "text-muted-foreground"}
    >
      {t(`status.${r.status}`)}
    </Badge>
  );

  const columns: ServerColumn<ProductRow>[] = [
    {
      id: "product",
      label: t("col.product"),
      hideable: false,
      header: <ServerSortHeader columnId="name" title={t("col.product")} />,
      cell: (r) => (
        <Link
          href={{ pathname: "/products/[id]", params: { id: r.id } }}
          className="hover:text-primary flex items-center gap-2.5 hover:underline"
        >
          {thumb(r, "size-9 text-lg")}
          <span className="font-semibold">{r.name}</span>
          <StoreAvailabilityBadge storeIds={r.storeIds} />
        </Link>
      ),
    },
    {
      id: "category",
      label: t("col.category"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.category")}</span>,
      cell: (r) => (
        <span className="text-muted-foreground text-sm font-semibold">
          {r.categoryNames[0] ?? "—"}
        </span>
      ),
    },
    {
      id: "variants",
      label: t("col.variants"),
      align: "right",
      header: (
        <span className="text-muted-foreground text-xs font-bold">{t("col.variants")}</span>
      ),
      cell: (r) => (
        <span className="text-muted-foreground text-sm font-semibold tabular-nums">
          {r.variantCount}
        </span>
      ),
    },
    {
      id: "price",
      label: t("col.price"),
      align: "right",
      header: <ServerSortHeader columnId="price" title={t("col.price")} align="right" />,
      cell: (r) => <span className="text-sm font-bold tabular-nums">{price(r)}</span>,
    },
    {
      id: "status",
      label: t("col.status"),
      header: <span className="text-muted-foreground text-xs font-bold">{t("col.status")}</span>,
      cell: (r) => statusBadge(r),
    },
    {
      id: "actions",
      hideable: false,
      width: 48,
      header: <span className="sr-only">{t("edit")}</span>,
      cell: (r) => <ProductRowActions product={{ id: r.id, name: r.name }} />,
    },
  ];

  const empty = (
    <div className="text-muted-foreground grid h-40 place-items-center px-6 text-center">
      <div>
        <p className="text-foreground font-semibold">{t("empty")}</p>
        <p className="mt-1 text-sm">{t("emptyHint")}</p>
      </div>
    </div>
  );

  return (
    <>
      {values.view === "grid" ? (
        data.rows.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.rows.map((r) => (
              <div
                key={r.id}
                className="bg-card border-border relative flex flex-col rounded-3xl border p-4 shadow-sm"
              >
                <div className="absolute top-5 right-5 z-10">
                  <ProductRowActions product={{ id: r.id, name: r.name }} />
                </div>
                <Link
                  href={{ pathname: "/products/[id]", params: { id: r.id } }}
                  className="flex flex-1 flex-col"
                >
                  <div className="bg-muted/50 relative grid aspect-square place-items-center overflow-hidden rounded-2xl text-6xl">
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      "🛍️"
                    )}
                    {r.status === "draft" ? (
                      <Badge
                        variant="secondary"
                        className="text-muted-foreground absolute top-2 left-2"
                      >
                        {t("status.draft")}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold">{r.name}</div>
                      <div className="text-muted-foreground/70 text-xs font-semibold">
                        {r.categoryNames[0] ?? ""}
                      </div>
                    </div>
                    <span className="font-bold">{price(r)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-muted-foreground/70 text-xs font-semibold">
                      {t("variantsCount", { n: r.variantCount })}
                    </p>
                    <StoreAvailabilityBadge storeIds={r.storeIds} />
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )
      ) : (
        <ServerTable
          columns={columns}
          rows={data.rows}
          hiddenIds={values.cols}
          getRowId={(r) => r.id}
          emptyState={empty}
        />
      )}
      <ServerPagination pageCount={pageCount} total={data.total} />
    </>
  );
}
