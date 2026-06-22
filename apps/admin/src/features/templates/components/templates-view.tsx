"use client";

import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import {
  Bell,
  Copy,
  LayoutTemplate,
  Mail,
  MessageCircle,
  MessageSquare,
  Search,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { type FilterOption, FilterSelect } from "@/components/filters";
import { type ViewMode, ViewToggle } from "@/components/view-toggle";
import { useRouter } from "@/i18n/navigation";
import { useFadeUp } from "@/lib/animate";

import { CATEGORIES, type Category, type Channel, templates } from "../data";

const CHANNEL_ICONS: Record<Channel, LucideIcon> = {
  push: Bell,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
};

function ChannelChips({ channels }: { channels: Channel[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {channels.map((c) => {
        const Icon = CHANNEL_ICONS[c];
        return (
          <span
            key={c}
            aria-label={c}
            className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-lg"
          >
            <Icon className="size-3.5" />
          </span>
        );
      })}
    </div>
  );
}

/**
 * Plantillas de campaña — a gallery of ready-made campaign templates filtered by
 * category, with grid/list views. "Usar plantilla" seeds a new campaign draft
 * and opens the wizard; "Duplicar" forks the template. Design-first / hardcoded
 * (../data).
 */
export function TemplatesView() {
  const t = useTranslations("Templates");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const fade = useFadeUp({ step: 30 });

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [view, setView] = useState<ViewMode>("grid");

  const categoryOptions: FilterOption<Category>[] = CATEGORIES.map((c) => ({
    value: c,
    label: t(`cat.${c}`),
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (category && tpl.category !== category) return false;
      if (q && !tpl.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, category]);

  const clearFilters = () => {
    setQuery("");
    setCategory(null);
  };

  const onUse = (name: string) => {
    router.push("/campaigns/new");
    toast.success(t("used", { name }));
  };

  const onDuplicate = (name: string) => {
    toast.success(t("duplicated", { name }));
  };

  let i = 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
          {t("subtitle")}
        </p>
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="border-border bg-card placeholder:text-muted-foreground h-10 w-full rounded-xl border pr-3 pl-9 text-sm outline-none"
          />
        </div>
        <FilterSelect
          allLabel={t("categoryFilter")}
          value={category}
          onValueChange={setCategory}
          options={categoryOptions}
        />
        <ViewToggle
          value={view}
          onValueChange={setView}
          ariaLabel={tCommon("viewToggle")}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title={t("empty")}
          hint={t("emptyHint")}
          action={
            <Button variant="outline" className="rounded-xl" onClick={clearFilters}>
              {t("clearFilters")}
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              style={fade(i++)}
              className="bg-card border-border flex flex-col rounded-3xl border p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span className="bg-primary/10 grid size-12 flex-none place-items-center rounded-2xl text-2xl">
                  {tpl.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{tpl.name}</div>
                  <Badge variant="secondary" className="mt-1 text-muted-foreground">
                    {t(`cat.${tpl.category}`)}
                  </Badge>
                </div>
              </div>

              <p className="text-muted-foreground/80 mt-3 text-sm font-medium">
                {tpl.description}
              </p>

              <div className="mt-4">
                <p className="text-muted-foreground/60 text-[11px] font-bold tracking-wide uppercase">
                  {t("channelsLabel")}
                </p>
                <div className="mt-1.5">
                  <ChannelChips channels={tpl.channels} />
                </div>
              </div>

              <div className="border-border mt-4 flex items-center gap-1 border-t pt-4">
                <Button
                  size="sm"
                  className="h-9 flex-1 gap-1.5 rounded-lg font-semibold"
                  onClick={() => onUse(tpl.name)}
                >
                  <Sparkles className="size-3.5" />
                  {t("use")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-lg"
                  onClick={() => onDuplicate(tpl.name)}
                >
                  <Copy className="size-3.5" />
                  {t("duplicate")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border-border mt-5 overflow-hidden rounded-3xl border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("title")}</TableHead>
                <TableHead>{t("categoryFilter")}</TableHead>
                <TableHead>{t("channelsLabel")}</TableHead>
                <TableHead className="w-56" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tpl) => (
                <TableRow key={tpl.id} className="hover:bg-transparent">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="bg-primary/10 grid size-9 flex-none place-items-center rounded-xl text-lg">
                        {tpl.emoji}
                      </span>
                      <span className="font-bold">{tpl.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-muted-foreground">
                      {t(`cat.${tpl.category}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ChannelChips channels={tpl.channels} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        className="h-9 gap-1.5 rounded-lg font-semibold"
                        onClick={() => onUse(tpl.name)}
                      >
                        <Sparkles className="size-3.5" />
                        {t("use")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 rounded-lg"
                        onClick={() => onDuplicate(tpl.name)}
                      >
                        <Copy className="size-3.5" />
                        {t("duplicate")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
