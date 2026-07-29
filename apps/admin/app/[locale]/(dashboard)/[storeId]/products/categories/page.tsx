import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import { CategoriesView } from "@/features/products/components/categories-view";
import { loadStoreScope } from "@/lib/store-scope-server";

type Props = { params: Promise<{ locale: string; storeId: string }> };

/**
 * Category management — a **static** shell with the tree streaming into the
 * Suspense hole. The store scope resolves inside the nested async seed so nothing
 * is awaited at the page top (a top-level await de-opts the static shell). The
 * tree itself stays a live client react-query list: it mutates constantly
 * (create/rename/archive/reorder) and an RSC prefetch would only get in the way.
 */
export default function ProductCategoriesPage({ params }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoriesSeed params={params} />
      </Suspense>
    </IslandBoundary>
  );
}

async function CategoriesSeed({ params }: Props) {
  const { locale, storeId } = await params;
  setRequestLocale(locale);
  // The tree is org-wide; the scope only narrows the per-row sales figures.
  const { scope } = await loadStoreScope(storeId);
  return <CategoriesView storeId={scope?.storeId ?? null} />;
}

function CategoriesSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-6 lg:px-8">
      <div className="bg-muted h-4 w-24 animate-pulse rounded" />
      <div className="bg-muted mt-4 h-7 w-48 animate-pulse rounded" />
      <div className="bg-muted mt-2 h-4 w-72 animate-pulse rounded" />
      <div className="mt-5 flex gap-2">
        <div className="bg-muted h-10 flex-1 animate-pulse rounded-xl" />
        <div className="bg-muted h-10 w-32 animate-pulse rounded-xl" />
      </div>
      <div className="border-border bg-card divide-border mt-6 divide-y rounded-2xl border">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3.5">
            <span className="bg-muted size-4 animate-pulse rounded" />
            <span className="bg-muted h-4 w-40 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
