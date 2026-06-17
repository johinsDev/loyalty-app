import { QrCode } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export async function ScanCta() {
  const t = await getTranslations("Home");
  return (
    <Link
      href="/card"
      className="from-primary flex items-center justify-between gap-4 rounded-3xl bg-gradient-to-br to-[#7fd8c8] p-5 text-left shadow-[0_16px_30px_-14px_rgba(27,173,157,.7)]"
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-[19px] font-semibold text-white">
          {t("scanTitle")}
        </span>
        <span className="text-[13px] text-white/85">{t("scanSubtitle")}</span>
      </div>
      <span className="grid size-[54px] flex-none place-items-center rounded-2xl bg-white/20 text-white">
        <QrCode className="size-7" />
      </span>
    </Link>
  );
}
