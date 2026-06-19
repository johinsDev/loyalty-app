"use client";

import { QrCode } from "lucide-react";
import { useTranslations } from "next-intl";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";

export function ScanCta() {
  const t = useTranslations("Home");
  const openDrawer = useQrDrawer((s) => s.openDrawer);
  return (
    <button
      type="button"
      onClick={openDrawer}
      className="from-primary to-primary/60 flex w-full items-center justify-between gap-4 rounded-3xl bg-gradient-to-br p-5 text-left shadow-xl shadow-primary/30"
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-lg font-semibold text-white">
          {t("scanTitle")}
        </span>
        <span className="text-xs text-white/85">{t("scanSubtitle")}</span>
      </div>
      <span className="grid size-14 flex-none place-items-center rounded-2xl bg-white/20 text-white">
        <QrCode className="size-7" />
      </span>
    </button>
  );
}
