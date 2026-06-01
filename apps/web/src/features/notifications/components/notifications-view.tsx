import { getTranslations } from "next-intl/server";

import { NotificationsList } from "./notifications-list";

/**
 * Customer's in-app notification feed (the `database` channel). Lists every
 * notification, lets the customer mark them read (individually or all), and
 * delete them.
 */
export async function NotificationsView() {
  const t = await getTranslations("Notifications");

  return (
    <main className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <NotificationsList />
    </main>
  );
}
