import { QrCode } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function ScanCta() {
  const t = await getTranslations("Home");
  return (
    <Link
      href="/card"
      className="from-primary to-primary/60 flex items-center justify-between gap-4 rounded-3xl bg-gradient-to-br p-5 text-left shadow-xl shadow-primary/30"
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
    </Link>
  );
}
