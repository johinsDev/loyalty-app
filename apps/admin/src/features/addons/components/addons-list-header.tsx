"use client";

import { Button } from "@loyalty/ui";
import { ArrowLeft, FolderTree, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/nav";

import { AddonEditorDialog, type AddonDraft, emptyAddonDraft } from "./addon-editor-dialog";
import { CatalogCategoriesManager } from "./catalog-categories-manager";

/** Static shell for the add-ons list: back-link, title, and the two entry
 *  points (new add-on, manage categories). Renders synchronously so the route
 *  keeps a prerenderable shell while the table streams. */
export function AddonsListHeader() {
  const t = useTranslations("Addons");
  const [draft, setDraft] = useState<AddonDraft | null>(null);
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
            {t("categories.manage")}
          </Button>
          <Button onClick={() => setDraft(emptyAddonDraft())}>
            <Plus className="mr-2 size-4" />
            {t("addon.new")}
          </Button>
        </div>
      </div>

      <AddonEditorDialog draft={draft} onClose={() => setDraft(null)} />
      <CatalogCategoriesManager
        kind="addon"
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
      />
    </>
  );
}
