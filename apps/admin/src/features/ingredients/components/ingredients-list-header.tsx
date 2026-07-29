"use client";

import { Button } from "@loyalty/ui";
import { ArrowLeft, FolderTree, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { CatalogCategoriesManager } from "@/features/addons/components/catalog-categories-manager";
import { Link } from "@/i18n/nav";

import {
  IngredientEditorDialog,
  type IngredientDraft,
  emptyIngredientDraft,
} from "./ingredient-editor-dialog";

/** Static shell for the ingredients list. Reuses the add-ons category manager
 *  with `kind="ingredient"` — one component serves both supply catalogs. */
export function IngredientsListHeader() {
  const t = useTranslations("Ingredients");
  const [draft, setDraft] = useState<IngredientDraft | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/products"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-semibold"
          >
            <ArrowLeft className="size-3.5" />
            {t("backToProducts")}
          </Link>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm font-semibold">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
            <FolderTree className="mr-2 size-4" />
            {t("categoriesManage")}
          </Button>
          <Button onClick={() => setDraft(emptyIngredientDraft())}>
            <Plus className="mr-2 size-4" />
            {t("ingredient.new")}
          </Button>
        </div>
      </div>

      <IngredientEditorDialog draft={draft} onClose={() => setDraft(null)} />
      <CatalogCategoriesManager
        kind="ingredient"
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
      />
    </>
  );
}
