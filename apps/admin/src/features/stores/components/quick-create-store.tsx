"use client";

import {
  Button,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Quick-create a store from the switcher: just a name, then drop the user inside
 * the new store's wizard to finish it. The full wizard (address, hours, brand)
 * lives at `/stores/[id]/edit`; this is the fast path.
 */
export function QuickCreateStore({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Admin");
  const trpc = useTRPC();
  const router = useRouter();
  const [name, setName] = useState("");

  const create = useMutation(
    trpc.stores.create.mutationOptions({
      onSuccess: (row) => {
        onOpenChange(false);
        setName("");
        // Land inside the new store (by slug), on its wizard, to finish setup.
        router.push({
          pathname: "/stores/[id]/edit",
          params: { storeId: row.slug ?? row.id, id: row.id },
        });
      },
      onError: () => toast.error(t("createStoreError")),
    }),
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (create.isPending) return;
    create.mutate({ name: name.trim() || undefined });
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <form onSubmit={onSubmit}>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("createStoreTitle")}</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              {t("createStoreDesc")}
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <div className="px-4 pb-2">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("createStorePlaceholder")}
              className="h-10"
            />
          </div>
          <ResponsiveModalFooter>
            <Button
              type="submit"
              disabled={create.isPending}
              className="h-10 rounded-xl font-semibold"
            >
              {t("createStoreSubmit")}
            </Button>
          </ResponsiveModalFooter>
        </form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
