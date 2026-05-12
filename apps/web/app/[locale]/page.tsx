import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@loyalty/ui";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("cardTitle")}</CardTitle>
          <CardDescription>{t("cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link href="/tarjeta">
            <Button className="w-full">{t("viewCard")}</Button>
          </Link>
          <Link href="/perfil">
            <Button variant="outline" className="w-full">
              {t("myProfile")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
