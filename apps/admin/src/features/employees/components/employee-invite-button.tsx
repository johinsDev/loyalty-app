"use client";

import { authClient } from "@loyalty/auth/client";
import { buttonVariants } from "@loyalty/ui";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/nav";

/**
 * Owner-only "Add employee" action in the list header. Gated on the client
 * session (owner = the seeded org admin), so it stays a small island over the
 * otherwise static page shell. Managers see the list but not this button.
 */
export function EmployeeInviteButton() {
  const t = useTranslations("Employees");
  const { data: session } = authClient.useSession();
  const isOwner = (session?.user as { role?: string } | undefined)?.role === "admin";

  if (!isOwner) return null;

  return (
    <Link href="/employees/new" className={buttonVariants({ className: "h-10 gap-1.5 rounded-xl" })}>
      <Plus className="size-4" />
      {t("add")}
    </Link>
  );
}
