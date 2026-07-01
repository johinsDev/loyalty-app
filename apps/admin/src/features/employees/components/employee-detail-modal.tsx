"use client";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
  Skeleton,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

import { EmployeeDetailView } from "./employee-detail-view";

/**
 * Quick-view employee detail as a ResponsiveModal over the list, driven by the
 * `?detalle=<memberId>` URL param (shareable, no intercepting routes). A hard
 * load of `/employees/[id]` renders the full page instead.
 */
export function EmployeeDetailModal({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("Employees");
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.employees.get.queryOptions({ memberId: id ?? "" }),
    enabled: !!id,
  });

  return (
    <ResponsiveModal open={!!id} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveModalContent
        showCloseButton={false}
        mobileClassName="mx-auto w-full max-w-md"
        desktopClassName="sm:max-w-xl"
      >
        <ResponsiveModalTitle className="sr-only">{t("title")}</ResponsiveModalTitle>
        {id && data ? (
          <EmployeeDetailView detail={data} variant="modal" />
        ) : (
          <div className="flex flex-col gap-4 p-5">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
