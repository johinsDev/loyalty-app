"use client";

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
import { Archive, Eye, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

type RewardActionsRow = {
  id: string;
  name: string;
  status: string;
  redemptions: number;
};

/** Per-row ⋯ menu: open · archive (published only) · delete (draft / unused only). */
export function RewardRowActions({ reward }: { reward: RewardActionsRow }) {
  const t = useTranslations("Rewards");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const name = reward.name || t("list.namePlaceholder");
  const invalidate = () => queryClient.invalidateQueries(trpc.rewards.adminList.queryFilter());

  const archive = useMutation(trpc.rewards.archive.mutationOptions());
  const remove = useMutation(trpc.rewards.remove.mutationOptions());

  const canArchive = reward.status === "published";
  const canDelete = reward.status === "draft" || reward.redemptions === 0;

  const onArchive = () =>
    archive.mutate(
      { id: reward.id },
      {
        onSuccess: () => {
          toast.success(t("list.archivedToast", { name }));
          setConfirmArchive(false);
          void invalidate();
        },
        onError: () => toast.error(t("list.archiveError")),
      },
    );

  const onDelete = () =>
    remove.mutate(
      { id: reward.id },
      {
        onSuccess: () => {
          toast.success(t("deleted", { name }));
          setConfirmDelete(false);
          void invalidate();
        },
        onError: (err) => {
          const code = (err as { data?: { code?: string } }).data?.code;
          toast.error(code === "PRECONDITION_FAILED" ? err.message : t("list.deleteError"));
        },
      },
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={t("list.open")} />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => router.push({ pathname: "/rewards/[id]", params: { id: reward.id } })}
          >
            <Eye className="size-4" />
            {t("list.open")}
          </DropdownMenuItem>
          {canArchive ? (
            <DropdownMenuItem onClick={() => setConfirmArchive(true)}>
              <Archive className="size-4" />
              {t("list.archive")}
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" />
                {t("delete")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmModal
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t("list.archiveTitle")}
        description={t("list.archiveDescription", { name })}
        confirmLabel={t("list.archiveConfirm")}
        cancelLabel={t("cancel")}
        busy={archive.isPending}
        onConfirm={onArchive}
      />

      <ConfirmModal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("deleteTitle")}
        description={t("deleteDescription", { name })}
        confirmLabel={t("deleteConfirm")}
        cancelLabel={t("cancel")}
        busy={remove.isPending}
        destructive
        onConfirm={onDelete}
      />
    </>
  );
}

function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy,
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  busy: boolean;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <p className="text-muted-foreground px-4 pb-2 text-sm">{description}</p>
        <ResponsiveModalFooter className="gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full px-5"
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 rounded-full px-6 font-semibold"
                : "h-10 rounded-full px-6 font-semibold"
            }
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
