"use client";

import type { EmployeeListItem } from "@loyalty/api/features/employees/schemas";
import { authClient } from "@loyalty/auth/client";
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
import { Ban, Eye, MoreHorizontal, Pencil, Trash2, UserCheck, UserCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import { useImpersonate } from "../use-impersonate";

/** Per-row ⋯ menu for a member: detail · edit · disable/enable · impersonate
 *  (owner) · delete. Invitation rows have no actions here. Owner status +
 *  current user come from the client session so this island is self-contained
 *  in the server table / grid card. */
export function EmployeeRowActions({ row }: { row: EmployeeListItem }) {
  const t = useTranslations("Employees");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { impersonate } = useImpersonate();
  const [, setDetailId] = useQueryState("detalle", parseAsString);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id ?? null;
  const isOwner = (session?.user as { role?: string } | undefined)?.role === "admin";

  // Every list-changing mutation re-runs the server table render via
  // `router.refresh()`; `invalidateQueries` is kept as a harmless legacy no-op.
  const refresh = () => {
    void queryClient.invalidateQueries(trpc.employees.list.queryFilter());
    router.refresh();
  };
  const opts = { onSuccess: refresh };
  const disable = useMutation(trpc.employees.disable.mutationOptions(opts));
  const enable = useMutation(trpc.employees.enable.mutationOptions(opts));
  const remove = useMutation(trpc.employees.remove.mutationOptions(opts));

  if (row.kind !== "member") return null;

  const isSelf = !!currentUserId && row.userId === currentUserId;
  const canManage = isOwner && !isSelf && row.role !== "owner";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={t("actions")} />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => void setDetailId(row.id)}>
            <Eye className="size-4" />
            {t("detail.viewDetail")}
          </DropdownMenuItem>
          {canManage ? (
            <DropdownMenuItem
              onClick={() =>
                router.push({ pathname: "/employees/[id]/edit", params: { id: row.id } })
              }
            >
              <Pencil className="size-4" />
              {t("detail.edit")}
            </DropdownMenuItem>
          ) : null}
          {isOwner && !isSelf && row.userId ? (
            <DropdownMenuItem onClick={() => void impersonate(row.userId!)}>
              <UserCog className="size-4" />
              {t("detail.impersonate")}
            </DropdownMenuItem>
          ) : null}
          {canManage ? (
            <>
              <DropdownMenuSeparator />
              {row.status === "disabled" ? (
                <DropdownMenuItem
                  onClick={() =>
                    enable.mutate(
                      { memberId: row.id },
                      { onSuccess: () => toast.success(t("enabled")) },
                    )
                  }
                >
                  <UserCheck className="size-4" />
                  {t("enable")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() =>
                    disable.mutate(
                      { memberId: row.id },
                      { onSuccess: () => toast.success(t("disabled")) },
                    )
                  }
                >
                  <Ban className="size-4" />
                  {t("disable")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" />
                {t("remove")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveModal open={confirmDelete} onOpenChange={setConfirmDelete}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("removeTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="px-4 pb-2">
            <p className="text-muted-foreground text-sm">
              {t("removeHint", { name: row.name ?? row.email ?? "" })}
            </p>
          </div>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setConfirmDelete(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 rounded-full px-6 font-semibold"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(
                  { memberId: row.id },
                  {
                    onSuccess: () => {
                      toast.success(t("removed", { name: row.name ?? row.email ?? "" }));
                      setConfirmDelete(false);
                    },
                    onError: () => toast.error(t("removeError")),
                  },
                )
              }
            >
              {t("removeConfirm")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
