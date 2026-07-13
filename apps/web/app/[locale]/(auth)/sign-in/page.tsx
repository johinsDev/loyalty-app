import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import { SignInForm } from "@/features/auth/components/sign-in-form";
import { isGoogleEnabled } from "@/lib/auth-flags";
import { redirectIfSignedIn } from "@/lib/auth-guard";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("title") };
}

export default async function SignInPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Already signed in → don't show the login again (home routes them on).
  await redirectIfSignedIn();
  // Admin-authored onboarding carousel, resolved to this locale (x-locale is
  // forwarded by the server caller). Empty → the form shows its built-in
  // default. Never let a failed read block the login.
  const onboarding = await (await trpc()).settings.onboarding().catch(() => []);
  // Google is hidden on preview (per-PR Workers can't have a fixed OAuth
  // redirect URI). Resolved here on the server — see `auth-flags`.
  return <SignInForm googleEnabled={isGoogleEnabled()} onboarding={onboarding} />;
}
