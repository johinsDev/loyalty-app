"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@loyalty/ui";
import { useMutation } from "@tanstack/react-query";
import { Eye, MoreHorizontal, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

/** Per-row ⋯ menu: open the detail page · resend the WhatsApp receipt. */
export function PurchaseRowActions({ id }: { id: string }) {
  const t = useTranslations("Purchases");
  const router = useRouter();
  const trpc = useTRPC();
  const resend = useMutation(
    trpc.purchases.resendReceipt.mutationOptions({
      onSuccess: () => toast.success(t("resendOk")),
      onError: () => toast.error(t("resendError")),
    }),
  );

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
        <DropdownMenuItem
          onClick={() => router.push({ pathname: "/purchases/[id]", params: { id } })}
        >
          <Eye className="size-4" />
          {t("viewDetail")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={resend.isPending} onClick={() => resend.mutate({ id })}>
          <Send className="size-4" />
          {t("resendReceipt")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
