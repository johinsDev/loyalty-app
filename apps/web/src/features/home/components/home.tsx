import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@loyalty/ui";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { isDevOnlyEnabled } from "@/lib/dev-only";

/**
 * Customer PWA landing card with quick links into Card + Profile.
 * On dev + preview deploys an extra block appears at the bottom with
 * shortcuts into the `(dev)` outbox tools (so devs can click instead
 * of typing URLs). Hidden in production.
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

      {isDevOnlyEnabled() ? <DevShortcuts /> : null}
    </main>
  );
}

async function DevShortcuts() {
  const t = await getTranslations("Home");
  return (
    <Card className="w-full border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-100">
            dev
          </span>
          {t("devToolsTitle")}
        </CardTitle>
        <CardDescription className="text-xs">
          {t("devToolsDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Link href="/whatsapp-outbox">
          <Button variant="ghost" size="sm" className="w-full justify-start">
            → WhatsApp Outbox
          </Button>
        </Link>
        <Link href="/sms-outbox">
          <Button variant="ghost" size="sm" className="w-full justify-start">
            → SMS Outbox
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
