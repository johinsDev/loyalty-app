import { getTranslations } from "next-intl/server";

import { SendForm } from "./send-form";

/**
 * Admin "send a notification" screen. Lets staff pick a notification type and
 * one or more customers, then enqueues a Trigger.dev fan-out. The actual
 * delivery (and per-channel marketing opt-out) happens in the job.
 */
export async function NotificationsView() {
  const t = await getTranslations("Notifications");

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <SendForm />
    </main>
  );
}
