"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";

import { useMenuFavorites } from "../hooks/use-menu-favorites";

/** Heart toggle for a product (cards + detail). Optimistic via useMenuFavorites. */
export function FavoriteButton({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const t = useTranslations("Menu");
  const { isFavorite, toggleFavorite } = useMenuFavorites();
  const fav = isFavorite(productId);

  return (
    <button
      type="button"
      aria-label={t("favorites")}
      aria-pressed={fav}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(productId);
      }}
      className={
        className ??
        "bg-card absolute top-2.5 right-2.5 z-10 grid size-8 place-items-center rounded-full shadow-md shadow-black/20"
      }
    >
      <Heart
        className={`size-4 ${fav ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`}
      />
    </button>
  );
}
