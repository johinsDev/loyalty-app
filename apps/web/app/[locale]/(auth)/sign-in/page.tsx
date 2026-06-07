import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

import { SignInForm } from "@/features/auth/components/sign-in-form";
import { isGoogleEnabled } from "@/lib/auth-flags";

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
  // Google is hidden on preview (per-PR Workers can't have a fixed OAuth
  // redirect URI). Resolved here on the server — see `auth-flags`.
  return <SignInForm googleEnabled={isGoogleEnabled()} />;
}
