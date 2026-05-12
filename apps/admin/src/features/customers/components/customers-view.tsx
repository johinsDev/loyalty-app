import { getTranslations } from "next-intl/server";

export async function CustomersView() {
  const t = await getTranslations("Customers");

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("placeholder")}</p>
    </main>
  );
}
