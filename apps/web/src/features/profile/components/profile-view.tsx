import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/features/auth/components/sign-out-button";

/**
 * Profile placeholder. Will grow into customer profile + preferences.
 */
export async function ProfileView() {
  const t = await getTranslations("Profile");

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("placeholder")}</p>
      </div>
      <SignOutButton />
    </main>
  );
}
