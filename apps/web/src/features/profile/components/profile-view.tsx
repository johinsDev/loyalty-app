import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { env } from "@/env";
import { requireSession } from "@/lib/auth-guard";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { NotificationPreferences } from "@/features/profile/components/notification-preferences";
import { PushEnableButton } from "@/features/push/components/push-enable-button";

/**
 * Profile placeholder. Surfaces the customer's session controls:
 * Push enable (so they can opt in to "stamp earned" / "reward ready"
 * notifications) + Sign out.
 */
export async function ProfileView() {
  const t = await getTranslations("Profile");
  await requireSession();

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("placeholder")}</p>
      </div>
      <section className="space-y-3 rounded-2xl border p-4">
        <h2 className="text-sm font-semibold">{t("preferences.title")}</h2>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">
            {t("preferences.theme")}
          </span>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">
            {t("preferences.language")}
          </span>
          <LocaleSwitcher />
        </div>
      </section>
      <PushEnableButton vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
      <NotificationPreferences />
      <SignOutButton />
    </main>
  );
}
