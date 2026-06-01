import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@loyalty/ui";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { Link } from "@/i18n/navigation";

// 4×4 grey LQIP — placeholder while the real image loads. Swap to a real
// per-asset blurDataURL when the brand asset lands in R2.
const BRAND_BLUR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0IDQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=";

/**
 * Customer PWA landing card with quick links into Card + Profile.
 * Dev tooling (outboxes, realtime/storage smoke) lives in apps/admin
 * under (dev) — gated by role=owner.
 */
export async function Home() {
  const t = await getTranslations("Home");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6">
      <Image
        src="https://placehold.co/480x160/0ea5e9/ffffff/png?text=T4+Loyalty"
        alt="T4 Loyalty"
        width={240}
        height={80}
        priority
        sizes="(max-width: 640px) 50vw, 240px"
        placeholder="blur"
        blurDataURL={BRAND_BLUR}
      />
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
          <Link href="/notifications">
            <Button variant="outline" className="w-full">
              {t("myNotifications")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
