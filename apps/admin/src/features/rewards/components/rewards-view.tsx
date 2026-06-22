"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
} from "@loyalty/ui";
import { Coins, Pencil, Plus, Stamp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useFadeUp } from "@/lib/animate";
import { useRouter } from "@/i18n/navigation";

import { type Reward, rewards } from "../data";

/**
 * Recompensas — a card grid of rewards (cost in sellos / puntos, redeemed
 * count). Add/edit open the reward wizard; delete confirms via an AlertDialog.
 * Design-first / hardcoded (../data).
 */
export function RewardsView() {
  const t = useTranslations("Rewards");
  const router = useRouter();
  const fade = useFadeUp({ step: 30 });
  const [toDelete, setToDelete] = useState<Reward | null>(null);

  const onDelete = () => {
    if (!toDelete) return;
    toast.success(t("deleted", { name: toDelete.name }));
    setToDelete(null);
  };

  let i = 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
            {t("subtitle")}
          </p>
        </div>
        <Button
          className="h-10 gap-2 rounded-xl font-semibold"
          onClick={() => router.push("/rewards/new")}
        >
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((r) => (
          <div
            key={r.id}
            style={fade(i++)}
            className="bg-card border-border flex flex-col rounded-3xl border p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="bg-primary/10 grid size-12 flex-none place-items-center rounded-2xl text-2xl">
                {r.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{r.name}</div>
                <span className="text-primary mt-0.5 inline-flex items-center gap-1 text-sm font-extrabold">
                  {r.costType === "stamps" ? (
                    <Stamp className="size-3.5" />
                  ) : (
                    <Coins className="size-3.5" />
                  )}
                  {r.cost === 0
                    ? t("free")
                    : t(`cost.${r.costType}`, { n: r.cost })}
                </span>
              </div>
              {!r.active ? (
                <Badge variant="secondary" className="text-muted-foreground">
                  {t("inactive")}
                </Badge>
              ) : null}
            </div>

            <p className="text-muted-foreground/70 mt-3 text-xs font-semibold">
              {t("redeemedCount", { n: r.redeemed })}
            </p>

            <div className="border-border mt-3 flex items-center gap-1 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                className="h-9 flex-1 gap-1.5 rounded-lg"
                onClick={() =>
                  router.push({
                    pathname: "/rewards/[id]",
                    params: { id: r.id },
                  })
                }
              >
                <Pencil className="size-3.5" />
                {t("edit")}
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("delete")}
                className="text-destructive hover:bg-destructive/10 size-9 rounded-lg"
                onClick={() => setToDelete(r)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { name: toDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
