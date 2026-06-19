"use client";

import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  SidebarInset,
  SidebarProvider,
  Spinner,
} from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  Check,
  Coffee,
  Flame,
  Gift,
  type LucideIcon,
  MoreHorizontal,
  Star,
  Trash2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { AppSidebar } from "@/features/home/components/app-sidebar";
import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

type TypeConfig = {
  Icon: LucideIcon;
  box: string;
  label: string;
  cta: string | null;
};

// Visual + copy config per notification type. Theme-friendly tints (token /
// standard scale, no arbitrary values) so cards read in light and dark.
const TYPES: Record<string, TypeConfig> = {
  reward: {
    Icon: Gift,
    box: "bg-amber-500/15 text-amber-600",
    label: "typeReward",
    cta: "ctaReward",
  },
  promo: {
    Icon: Flame,
    box: "bg-rose-500/15 text-rose-600",
    label: "typePromo",
    cta: "ctaPromo",
  },
  points: {
    Icon: Star,
    box: "bg-yellow-500/15 text-yellow-600",
    label: "typePoints",
    cta: "ctaPoints",
  },
  stamp: {
    Icon: Coffee,
    box: "bg-primary/10 text-primary",
    label: "typeStamp",
    cta: "ctaStamp",
  },
  system: {
    Icon: Bell,
    box: "bg-indigo-500/15 text-indigo-500",
    label: "typeSystem",
    cta: null,
  },
};

const typeOf = (type: string): TypeConfig => TYPES[type] ?? TYPES.system!;

/**
 * Notification center — a faithful build of the "T4 · Notificaciones" design on
 * the real `database` feed (`notifications.listMine`). Unread items are
 * highlighted; the all/unread filter, the per-item action sheet (mark read /
 * delete) and the detail sheet are all driven from state. The sheets use
 * {@link ResponsiveModal} (drawer on mobile, dialog on desktop) and the list
 * reveals with the shared staggered fade-up. Opening an item marks it read.
 */
export function NotificationsView() {
  const t = useTranslations("Notifications");
  const format = useFormatter();
  const trpc = useTRPC();
  const fade = useFadeUp();

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const list = useQuery(
    trpc.notifications.listMine.queryOptions({
      filter: "all",
      page: 1,
      pageSize: 50,
    }),
  );
  const markRead = useMutation(trpc.notifications.markRead.mutationOptions());
  const markAllRead = useMutation(
    trpc.notifications.markAllRead.mutationOptions(),
  );
  const remove = useMutation(trpc.notifications.delete.mutationOptions());

  const rows = list.data?.rows ?? [];
  const unread = rows.filter((r) => !r.readAt).length;
  const visible = filter === "unread" ? rows.filter((r) => !r.readAt) : rows;

  const menuRow = rows.find((r) => r.id === menuId) ?? null;
  const detailRow = rows.find((r) => r.id === detailId) ?? null;

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await list.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    }
  };

  const open = (id: string, unreadItem: boolean) => {
    setDetailId(id);
    if (unreadItem) void run(() => markRead.mutateAsync({ id }));
  };
  const onDelete = (id: string) => {
    setMenuId(null);
    setDetailId((d) => (d === id ? null : d));
    void run(() => remove.mutateAsync({ id }));
  };

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset className="from-primary/5 to-background text-foreground overflow-x-clip bg-gradient-to-b">
        <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 md:pb-12 lg:max-w-2xl lg:px-8 lg:pt-12">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight">
                {t("title")}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {unread > 0
                  ? t("subtitleUnread", { count: unread })
                  : t("upToDate")}
              </p>
            </div>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void run(() => markAllRead.mutateAsync())}
                className="text-primary mt-1.5 shrink-0 text-sm font-extrabold"
              >
                {t("markAllRead")}
              </button>
            ) : null}
          </div>

          {/* Filters */}
          <div className="mt-5 flex gap-2.5">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
            >
              {t("filterAll")}
            </FilterChip>
            <FilterChip
              active={filter === "unread"}
              onClick={() => setFilter("unread")}
            >
              {t("filterUnread")}
              {unread > 0 ? (
                <span
                  className={`grid size-5 place-items-center rounded-full px-1.5 text-xs font-extrabold ${
                    filter === "unread"
                      ? "bg-background text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {unread}
                </span>
              ) : null}
            </FilterChip>
          </div>

          {/* List */}
          <div className="mt-5 flex flex-col gap-3">
            {list.isLoading ? (
              <div className="flex justify-center py-16">
                <Spinner />
              </div>
            ) : visible.length === 0 ? (
              <EmptyState unread={filter === "unread"} />
            ) : (
              visible.map((row, i) => {
                const cfg = typeOf(row.type);
                const isUnread = !row.readAt;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => open(row.id, isUnread)}
                    style={fade(i)}
                    className={`relative flex gap-3.5 rounded-3xl border p-3.5 text-left shadow-sm transition-colors ${
                      isUnread
                        ? "border-primary/25 bg-card"
                        : "border-border bg-card/60"
                    }`}
                  >
                    <span
                      className={`grid size-12 flex-none place-items-center rounded-2xl ${cfg.box}`}
                    >
                      <cfg.Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1 pr-6">
                      <div className="flex items-center gap-2">
                        {isUnread ? (
                          <span className="bg-primary size-2 flex-none rounded-full" />
                        ) : null}
                        <span
                          className={`text-foreground truncate text-sm ${
                            isUnread ? "font-extrabold" : "font-semibold"
                          }`}
                        >
                          {row.title}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-snug">
                        {row.body}
                      </p>
                      <time className="text-muted-foreground/80 mt-1.5 block text-xs font-semibold">
                        {format.relativeTime(new Date(row.createdAt))}
                      </time>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={t("actions")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId(row.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          setMenuId(row.id);
                        }
                      }}
                      className="text-muted-foreground hover:bg-muted absolute top-2.5 right-2.5 grid size-8 cursor-pointer place-items-center rounded-lg"
                    >
                      <MoreHorizontal className="size-5" />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </SidebarInset>

      {/* Per-item action sheet */}
      <ResponsiveModal
        open={menuRow !== null}
        onOpenChange={(o) => !o && setMenuId(null)}
      >
        <ResponsiveModalContent
          aria-describedby={undefined}
          mobileClassName="mx-auto w-full max-w-md"
        >
          <ResponsiveModalHeader className="text-left">
            <ResponsiveModalTitle className="truncate text-base">
              {menuRow?.title}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="flex flex-col gap-1 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {menuRow && !menuRow.readAt ? (
              <SheetButton
                onClick={() => {
                  const id = menuRow.id;
                  setMenuId(null);
                  void run(() => markRead.mutateAsync({ id }));
                }}
              >
                <Check className="size-5" />
                {t("markRead")}
              </SheetButton>
            ) : null}
            <SheetButton danger onClick={() => menuRow && onDelete(menuRow.id)}>
              <Trash2 className="size-5" />
              {t("delete")}
            </SheetButton>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Detail sheet */}
      <ResponsiveModal
        open={detailRow !== null}
        onOpenChange={(o) => !o && setDetailId(null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          {detailRow ? (
            <DetailContent
              row={detailRow}
              relativeTime={format.relativeTime(new Date(detailRow.createdAt))}
              onDelete={() => onDelete(detailRow.id)}
            />
          ) : null}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </SidebarProvider>
  );
}

function FilterChip({
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
      aria-pressed={active}
      className={`flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-card text-muted-foreground border-border hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SheetButton({
  danger,
  onClick,
  children,
}: {
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hover:bg-muted flex h-14 items-center gap-3.5 rounded-2xl px-3 text-base font-semibold ${
        danger ? "text-rose-500" : "text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function DetailContent({
  row,
  relativeTime,
  onDelete,
}: {
  row: { type: string; title: string; body: string };
  relativeTime: string;
  onDelete: () => void;
}) {
  const t = useTranslations("Notifications");
  const cfg = typeOf(row.type);
  return (
    <div className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3.5">
        <span
          className={`grid size-14 flex-none place-items-center rounded-2xl ${cfg.box}`}
        >
          <cfg.Icon className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-primary text-xs font-extrabold tracking-wider uppercase">
            {t(cfg.label)}
          </p>
          <ResponsiveModalTitle className="font-display mt-0.5 text-2xl font-semibold tracking-tight">
            {row.title}
          </ResponsiveModalTitle>
        </div>
      </div>
      <p className="text-muted-foreground/80 mt-3 text-xs font-semibold">
        {relativeTime}
      </p>
      <ResponsiveModalDescription className="text-foreground mt-3 text-[0.9375rem] leading-relaxed">
        {row.body}
      </ResponsiveModalDescription>

      <div className="mt-6 flex flex-col gap-2">
        {cfg.cta ? (
          <ResponsiveModalClose variant="gradient" className="w-full">
            {t(cfg.cta)}
          </ResponsiveModalClose>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-rose-300 text-sm font-bold text-rose-500"
        >
          <Trash2 className="size-4" />
          {t("deleteNotification")}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ unread }: { unread: boolean }) {
  const t = useTranslations("Notifications");
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 py-16 text-center">
      <span className="bg-card grid size-20 place-items-center rounded-full shadow-sm">
        {unread ? (
          <Check className="text-primary size-8" />
        ) : (
          <BellOff className="size-8" />
        )}
      </span>
      <p className="text-foreground text-base font-bold">
        {unread ? t("emptyUnreadTitle") : t("emptyAllTitle")}
      </p>
      <p className="max-w-xs text-sm">
        {unread ? t("emptyUnreadHint") : t("emptyAllHint")}
      </p>
    </div>
  );
}
