"use client";

import { authClient } from "@loyalty/auth/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

type State = "loading" | "sent" | "accepting" | "done" | "invalid" | "error";

/**
 * Accept-invitation flow. A signed-in user (matching the invited email)
 * auto-accepts, creating the member + store assignments. A signed-out visitor
 * gets a magic-link sent to the invited email; clicking it returns here
 * signed-in and completes acceptance.
 */
export function AcceptInvitationView({ invitationId }: { invitationId: string | null }) {
  const t = useTranslations("Employees");
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session, isPending } = authClient.useSession();
  const { data: invitation, isLoading } = useQuery({
    ...trpc.employees.pendingInvitation.queryOptions({ invitationId: invitationId ?? "" }),
    enabled: !!invitationId,
  });
  const accept = useMutation(trpc.employees.acceptInvitation.mutationOptions());
  const [state, setState] = useState<State>("loading");
  const acted = useRef(false);

  useEffect(() => {
    if (!invitationId || isPending || isLoading) return;
    if (invitation === null) {
      setState("invalid");
      return;
    }
    if (!invitation) return;
    if (acted.current) return;

    if (session?.user) {
      acted.current = true;
      setState("accepting");
      accept.mutate(
        { invitationId },
        {
          onSuccess: () => {
            setState("done");
            setTimeout(() => router.push("/employees"), 1200);
          },
          onError: () => setState("error"),
        },
      );
    } else {
      acted.current = true;
      const callbackURL = typeof window !== "undefined" ? window.location.href : "/";
      void authClient.signIn
        .magicLink({ email: invitation.email, callbackURL })
        .then(() => setState("sent"))
        .catch(() => setState("error"));
    }
  }, [invitationId, isPending, isLoading, invitation, session, accept, router]);

  const busy = state === "loading" || state === "accepting";

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="bg-primary/10 text-primary grid size-14 place-items-center rounded-full">
        {busy ? <Loader2 className="size-6 animate-spin" /> : <MailCheck className="size-6" />}
      </span>
      <h1 className="font-display text-xl font-semibold tracking-tight">{t("accept.title")}</h1>

      {!invitationId || state === "invalid" ? (
        <p className="text-muted-foreground text-sm">{t("accept.invalid")}</p>
      ) : state === "sent" ? (
        <p className="text-muted-foreground text-sm">
          {t("accept.checkEmail", { email: invitation?.email ?? "" })}
        </p>
      ) : state === "done" ? (
        <p className="text-sm font-semibold text-emerald-600">{t("accept.done")}</p>
      ) : state === "error" ? (
        <p className="text-destructive text-sm">{t("accept.error")}</p>
      ) : (
        <p className="text-muted-foreground text-sm">{t("accept.working")}</p>
      )}
    </div>
  );
}
