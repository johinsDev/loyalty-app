import { getTranslations } from "next-intl/server";

/**
 * Profile placeholder. Will grow into customer profile + preferences.
 */
export async function ProfileView() {
  const t = await getTranslations("Profile");

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("placeholder")}</p>
    </main>
  );
}
