"use client";

import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryStates } from "nuqs";

import { useFadeUp } from "@/lib/animate";

import { categories, products } from "../data";

/**
 * Menú tab — the full product catalog the cashier can browse: search by name +
 * filter by category (both in the URL via nuqs), and tap a product for detail.
 * Read-only lookup; reveals with the shared staggered fade-up.
 */
export function MenuView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();
  const [{ q, cat, p }, setQuery] = useQueryStates({
    q: parseAsString.withDefault(""),
    cat: parseAsString.withDefault(""),
    p: parseAsString.withDefault(""),
  });

  const filtered = products.filter(
    (item) =>
      (!cat || item.category === cat) &&
      item.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const selected = products.find((item) => item.id === p) ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-5 lg:max-w-4xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t("menuTitle")}
      </h1>

      <div className="border-border bg-card mt-4 flex h-12 items-center gap-2 rounded-2xl border px-4">
        <Search className="text-muted-foreground/70 size-4" />
        <input
          value={q}
          onChange={(e) => void setQuery({ q: e.target.value || null })}
          placeholder={t("menuSearch")}
          className="placeholder:text-muted-foreground/70 w-full bg-transparent text-sm font-semibold outline-none"
        />
      </div>

      <div className="scrollbar-hide -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip active={!cat} onClick={() => void setQuery({ cat: null })}>
          {t("all")}
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c}
            active={cat === c}
            onClick={() => void setQuery({ cat: cat === c ? null : c })}
          >
            {c}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          {t("menuEmpty")}
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void setQuery({ p: item.id })}
              style={fade(i)}
              className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3.5 text-left shadow-sm"
            >
              <span className="bg-muted grid size-11 flex-none place-items-center rounded-xl text-xl">
                {item.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{item.name}</div>
                <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                  {item.description}
                </div>
              </div>
              <span className="bg-primary/10 text-primary flex-none rounded-full px-2 py-1 text-[0.6875rem] font-extrabold">
                +{item.earns}
              </span>
            </button>
          ))}
        </div>
      )}

      <ResponsiveModal
        open={selected !== null}
        onOpenChange={(o) => !o && void setQuery({ p: null })}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          {selected ? (
            <div className="flex flex-col px-6 pt-2 pb-6">
              <span className="bg-muted mb-3 grid size-20 place-items-center rounded-3xl text-4xl">
                {selected.emoji}
              </span>
              <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
                {selected.name}
              </ResponsiveModalTitle>
              <div className="mt-2 flex items-center gap-2">
                <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-xs font-bold">
                  {selected.category}
                </span>
                <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-extrabold">
                  +{selected.earns}{" "}
                  {selected.earns === 1 ? t("stampOne") : t("stampMany")}
                </span>
              </div>
              <ResponsiveModalDescription className="text-foreground mt-3 text-sm leading-relaxed">
                {selected.description}
              </ResponsiveModalDescription>
              <ResponsiveModalClose
                variant="secondary"
                className="mt-6 h-14 w-full rounded-2xl text-base"
              >
                {t("close")}
              </ResponsiveModalClose>
            </div>
          ) : null}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 flex-none rounded-full border px-4 text-xs font-bold whitespace-nowrap transition-colors ${active ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border"}`}
    >
      {children}
    </button>
  );
}
