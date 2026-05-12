"use client";

import { Button } from "@loyalty/ui";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { routing, type AppLocale } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

const LABELS: Record<AppLocale, string> = {
  es: "ES",
  en: "EN",
};

export function LocaleSwitcher() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Common");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const next = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;

  const onClick = () => {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending} aria-label={t("switchLocale")}>
      {LABELS[next]}
    </Button>
  );
}
