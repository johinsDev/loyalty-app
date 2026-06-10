import { setRequestLocale } from "next-intl/server";

import { env } from "@/env";
import { getSession } from "@/lib/auth-guard";
import { RealtimeDevPage } from "@/features/realtime/components/dev-page";

type Props = { params: Promise<{ locale: string }> };

export default async function RealtimeSmokePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The (dev) layout already runs `isDevOnlyEnabled()` so we get here
  // only in dev / preview. Still need a session to mint tickets — the
  // realtime.issueTicket mutation is `protectedProcedure`, so pass
  // `null` when signed out and let the dev page render a sign-in hint.
  const session = await getSession();
  const selfId = session?.user?.id ?? null;

  return (
    <RealtimeDevPage
      selfId={selfId}
      partykitHost={env.NEXT_PUBLIC_PARTYKIT_HOST}
    />
  );
}
