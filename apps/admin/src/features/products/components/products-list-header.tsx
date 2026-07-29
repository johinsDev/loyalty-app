"use client";

import { Button, buttonVariants } from "@loyalty/ui";
import { FolderTree, Plus, PlusCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, useRouter } from "@/i18n/nav";

/** Static products list header (title + subtitle + add-ons / categories / add).
 *  Client so the list page renders its shell synchronously — only the table
 *  streams under Suspense. */
export function ProductsListHeader() {
  const t = useTranslations("Products");
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="h-10 gap-2 rounded-xl font-semibold"
          onClick={() => router.push("/products/add-ons")}
        >
          <PlusCircle className="size-4" />
          {t("addon.title")}
        </Button>
        <Button
          variant="outline"
          className="h-10 gap-2 rounded-xl font-semibold"
          onClick={() => router.push("/products/categories")}
        >
          <FolderTree className="size-4" />
          {t("editCategories")}
        </Button>
        <Link
          href="/products/new"
          className={buttonVariants({ className: "h-10 gap-1.5 rounded-xl" })}
        >
          <Plus className="size-4" />
          {t("add")}
        </Link>
      </div>
    </div>
  );
}
