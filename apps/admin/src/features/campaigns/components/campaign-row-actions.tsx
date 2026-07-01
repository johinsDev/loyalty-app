"use client";

import type { CampaignDisplayState } from "@loyalty/api/features/campaigns/schemas";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, MoreHorizontal, Pause, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

type RowCampaign = {
  id: string;
  name: string;
  displayState: CampaignDisplayState;
  sent: number;
};

/** Per-row ⋯ menu: view detail · edit (draft) · pause (scheduled/sending) ·
 *  retry (sent) · delete. */
export function CampaignRowActions({ campaign }: { campaign: RowCampaign }) {
  const t = useTranslations("Campaigns");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [, setDetailId] = useQueryState("detalle", parseAsString);
  const [open, setOpen] = useState(false);

  const invalidate = () => queryClient.invalidateQueries(trpc.campaigns.adminList.queryFilter());
  const remove = useMutation(trpc.campaigns.remove.mutationOptions());
  const pause = useMutation(trpc.campaigns.pause.mutationOptions());
  const retry = useMutation(trpc.campaigns.retry.mutationOptions());

  const isDraft = campaign.displayState === "draft";
  const canPause =
    campaign.displayState === "scheduled" || campaign.displayState === "sending";
  const canRetry = campaign.displayState === "sent" || campaign.sent > 0;

  const onDelete = () =>
    remove.mutate(
      { id: campaign.id },
      {
        onSuccess: () => {
          toast.success(t("deleted", { name: campaign.name }));
          setOpen(false);
          void invalidate();
        },
        onError: () => toast.error(t("saveError")),
      },
    );

  const onPause = () =>
    pause.mutate(
      { id: campaign.id },
      {
        onSuccess: () => {
          toast.success(t("paused"));
          void invalidate();
        },
        onError: () => toast.error(t("saveError")),
      },
    );

  const onRetry = () =>
    retry.mutate(
      { id: campaign.id },
      {
        onSuccess: (res) => {
          toast.success(t("retried", { n: res.recipients }));
          void invalidate();
        },
        onError: () => toast.error(t("saveError")),
      },
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={t("edit")} />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => void setDetailId(campaign.id)}>
            <Eye className="size-4" />
            {t("viewDetail")}
          </DropdownMenuItem>
          {isDraft ? (
            <DropdownMenuItem
              onClick={() =>
                router.push({ pathname: "/campaigns/[id]/edit", params: { id: campaign.id } })
              }
            >
              <Pencil className="size-4" />
              {t("edit")}
            </DropdownMenuItem>
          ) : null}
          {canPause ? (
            <DropdownMenuItem onClick={onPause}>
              <Pause className="size-4" />
              {t("pause")}
            </DropdownMenuItem>
          ) : null}
          {canRetry ? (
            <DropdownMenuItem onClick={onRetry}>
              <RotateCcw className="size-4" />
              {t("retry")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setOpen(true)}>
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("deleteTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground px-4 pb-2 text-sm">
            {t("deleteDescription", { name: campaign.name })}
          </p>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 rounded-full px-6 font-semibold"
              onClick={onDelete}
              disabled={remove.isPending}
            >
              {t("deleteConfirm")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
