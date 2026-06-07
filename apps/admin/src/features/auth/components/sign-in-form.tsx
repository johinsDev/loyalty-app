"use client";

import { authClient } from "@loyalty/auth/client";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
} from "@loyalty/ui";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { getAppUrl } from "@/lib/app-url";

// 4×4 grey LQIP. Swap to a real per-asset blurDataURL when the brand asset
// lands in R2 — see `.claude/skills/image-loader/SKILL.md`.
const BRAND_BLUR =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0IDQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNlNWU3ZWIiLz48L3N2Zz4=";

type Props = {
  /**
   * When true, the email/password form is rendered below the magic-link
   * request — only in dev/preview, paired with the seeded admin. Resolved
   * on the server from VERCEL_ENV (see `auth-flags.ts`). Prod is
   * passwordless magic-link only.
   */
  passwordEnabled: boolean;
};

export function SignInForm({ passwordEnabled }: Props) {
  const t = useTranslations("Auth");
  const searchParams = useSearchParams();
  const forbidden = searchParams.get("error") === "forbidden";
  const [loading, setLoading] = useState<"magic" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onMagicLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading("magic");
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: `${getAppUrl()}/dashboard`,
    });
    if (error) {
      setError(error.message ?? t("magicLinkError"));
      setLoading(null);
      return;
    }
    setSentTo(email);
    setLoading(null);
  };

  const onEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading("email");
    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/dashboard",
    });
    if (error) {
      setError(error.message ?? t("emailPasswordError"));
      setLoading(null);
    }
  };

  const busy = loading !== null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <Image
        src="https://placehold.co/480x160/0ea5e9/ffffff/png?text=T4+Admin"
        alt="T4 Admin"
        width={240}
        height={80}
        priority
        sizes="(max-width: 640px) 50vw, 240px"
        placeholder="blur"
        blurDataURL={BRAND_BLUR}
      />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("signInTitle")}</CardTitle>
          <CardDescription>{t("signInSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {forbidden ? (
            <Alert variant="default" className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <AlertDescription>{t("errorForbidden")}</AlertDescription>
            </Alert>
          ) : null}

          {sentTo ? (
            <Alert variant="default" className="border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              <AlertDescription>
                {t("magicLinkSent", { email: sentTo })}
              </AlertDescription>
            </Alert>
          ) : (
            <form className="space-y-3" onSubmit={onMagicLink}>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("emailLabel")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {loading === "magic" ? t("submitting") : t("magicLinkButton")}
              </Button>
            </form>
          )}

          {passwordEnabled && !sentTo ? (
            <>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-muted-foreground text-xs uppercase">
                  {t("orDivider")}
                </span>
                <Separator className="flex-1" />
              </div>
              <form className="space-y-3" onSubmit={onEmail}>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("passwordLabel")}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <Button type="submit" variant="outline" className="w-full" disabled={busy}>
                  {loading === "email"
                    ? t("submitting")
                    : t("emailSignInButton")}
                </Button>
              </form>
            </>
          ) : null}

          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
