import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { AcceptInvitationView } from "@/features/employees/components/accept-invitation-view";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ invitationId?: string }>;
};

/** Accept a staff invitation. Outside the (dashboard) role guard because the
 *  invitee isn't a member yet. */
export default async function AcceptInvitationPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  // `searchParams` is dynamic; read it inside a Suspense boundary so the route
  // shell still prerenders under `cacheComponents`.
  return (
    <Suspense fallback={null}>
      <AcceptInvitationLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function AcceptInvitationLoader({
  searchParams,
}: {
  searchParams: Props["searchParams"];
}) {
  const { invitationId } = await searchParams;
  return <AcceptInvitationView invitationId={invitationId ?? null} />;
}
