"use client";

import { Button } from "@loyalty/ui";
import { QrCode } from "lucide-react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/nav";
import { useStoreScope } from "@/lib/store-scope";

/**
 * Cashier-mode button. Reads the active store scope (`useParams`) to pre-select
 * the register's store when scoped, so it's a dynamic island (inside a
 * `<Suspense>`) rather than part of the static frame. The aggregate view leaves
 * the cashier's own default.
 */
export function CashierButton() {
  const t = useTranslations("Admin");
  const router = useRouter();
  const { storeId } = useStoreScope();

  const openCashier = () =>
    router.push(storeId ? { pathname: "/register", query: { storeId } } : "/register");

  return (
    <Button
      type="button"
      onClick={openCashier}
      className="bg-foreground text-background hover:bg-foreground/90 h-10 gap-2 rounded-xl font-semibold"
    >
      <QrCode className="size-4" />
      <span className="hidden sm:inline">{t("cashierMode")}</span>
    </Button>
  );
}
