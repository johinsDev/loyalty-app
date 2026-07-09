"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@loyalty/ui";
import { Eye, MoreHorizontal, Pencil, Send, SquareArrowOutUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";

import { useRouter } from "@/i18n/navigation";

/** Per-row ⋯ menu. Read-only in v1: quick-view + open full page. The write
 *  actions (resend receipt, adjust points) are deferred features — shown
 *  disabled so the affordance is discoverable. */
export function PurchaseRowActions({ id }: { id: string }) {
  const t = useTranslations("Purchases");
  const router = useRouter();
  const [, setDetailId] = useQueryState("detalle", parseAsString);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={t("actions")} />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => void setDetailId(id)}>
          <Eye className="size-4" />
          {t("viewDetail")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push({ pathname: "/purchases/[id]", params: { id } })}
        >
          <SquareArrowOutUpRight className="size-4" />
          {t("openPage")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Send className="size-4" />
          {t("resendReceipt")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Pencil className="size-4" />
          {t("adjustPoints")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
