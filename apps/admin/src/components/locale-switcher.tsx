"use client";

import { SegmentedControl } from "@loyalty/ui";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { type AppLocale } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Common");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const onValueChange = (next: AppLocale) => {
    if (next === locale) return;
    startTransition(() => {
      // Cast: next-intl preserves dynamic segments at runtime, but TS narrows
      // `pathname` to a union that includes route templates like
      // "/whatsapp-outbox/[id]" which `replace` only accepts in
      // `{ pathname, params }` form. Safe in this round-trip context.
      router.replace(pathname as Parameters<typeof router.replace>[0], {
        locale: next,
      });
    });
  };

  return (
    <SegmentedControl<AppLocale>
      aria-label={t("switchLocale")}
      value={locale}
      onValueChange={onValueChange}
      options={[
        { value: "es", label: "ES" },
        { value: "en", label: "EN" },
      ]}
    />
  );
}
