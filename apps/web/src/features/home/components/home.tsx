import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@loyalty/ui";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

/**
 * Customer PWA landing card with quick links into Card + Profile.
 */
export async function Home() {
  const t = await getTranslations("Home");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("cardTitle")}</CardTitle>
          <CardDescription>{t("cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/card">
            <Button className="w-full">{t("viewCard")}</Button>
          </Link>
          <Link href="/profile">
            <Button variant="outline" className="w-full">
              {t("myProfile")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
