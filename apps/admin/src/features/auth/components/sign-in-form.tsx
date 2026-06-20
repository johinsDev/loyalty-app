"use client";

import { authClient } from "@loyalty/auth/client";
import { Button, Input, Label, Separator } from "@loyalty/ui";
import { Delete, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";
import { getAppUrl } from "@/lib/app-url";

type Props = {
  /**
   * When true, the email/password form is rendered below the magic-link
   * request — only in dev/preview, paired with the seeded admin. Prod is
   * passwordless magic-link only.
   */
  passwordEnabled: boolean;
};

type Step = "email" | "sent" | "pin";

const GRAD = "bg-gradient-to-br from-primary via-primary/90 to-primary/70";

/**
 * Staff sign-in (admin + cashier share it) — a faithful build of the "T4 Caja ·
 * Ingreso de personal" design on our components. Real passwordless magic-link
 * (the only prod factor); the email/password block is the dev/preview seeded
 * admin. The PIN step is the shared-tablet **shift unlock**: after opening the
 * link, a cashier unlocks the register on the tablet with a 4-digit PIN — a
 * design seam today (any 4 digits open the register), backed by a real
 * per-cashier PIN once the cashier role + shift model land.
 */
export function SignInForm({ passwordEnabled }: Props) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const forbidden = searchParams.get("error") === "forbidden";

  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState<"magic" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");

  const busy = loading !== null;

  const sendMagicLink = async () => {
    setError(null);
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: `${getAppUrl()}/dashboard`,
    });
    if (error) {
      setError(error.message ?? t("magicLinkError"));
      return false;
    }
    return true;
  };

  const onMagicLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading("magic");
    if (await sendMagicLink()) setStep("sent");
    setLoading(null);
  };

  const onEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading("email");
    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: `${getAppUrl()}/dashboard`,
    });
    if (error) {
      setError(error.message ?? t("emailPasswordError"));
      setLoading(null);
    }
  };

  const pressPin = (n: string) => {
    const next = (pin + n).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      // Seam: the real per-cashier PIN check lands with the shift model.
      setTimeout(() => router.push("/register"), 200);
    }
  };

  return (
    <main className="bg-muted/40 flex min-h-screen items-center justify-center p-6">
      <div className="bg-card flex w-full max-w-4xl flex-wrap overflow-hidden rounded-3xl shadow-2xl">
        {/* BRAND PANEL */}
        <div
          className={`relative flex flex-1 basis-80 flex-col gap-3 overflow-hidden p-6 text-white sm:min-h-72 sm:justify-between sm:gap-0 sm:p-10 ${GRAD}`}
        >
          <span className="absolute -top-28 -right-20 size-80 rounded-full bg-white/10" />
          <span className="absolute -bottom-16 -left-12 size-48 rounded-full bg-white/10" />
          <div className="relative flex items-center gap-3">
            <span className="font-display grid size-11 place-items-center rounded-2xl bg-white/20 text-lg font-semibold sm:size-12 sm:text-xl">
              T4
            </span>
            <span className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              T4 Lovers
            </span>
          </div>
          <div className="relative">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-extrabold tracking-wider sm:mb-4">
              {t("brandBadge")}
            </span>
            <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight sm:text-4xl">
              {t("brandHeadline")}
            </h1>
            <p className="mt-3.5 hidden max-w-xs text-sm leading-relaxed text-white/85 sm:block">
              {t("brandSub")}
            </p>
          </div>
          <div className="relative hidden items-center gap-2.5 text-sm text-white/80 sm:flex">
            <span className="size-2 rounded-full bg-teal-200" />
            {t("sharedTablet")}
          </div>
        </div>

        {/* FORM PANEL */}
        <div className="flex flex-1 basis-80 flex-col justify-center p-6 sm:min-h-72 sm:p-10">
          {forbidden ? (
            <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {t("errorForbidden")}
            </div>
          ) : null}

          {step === "email" && (
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {t("staffTitle")}
              </h2>
              <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
                {t("staffSubtitle")}
              </p>
              <form className="flex flex-col gap-3" onSubmit={onMagicLink}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">{t("emailLabel")}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nombre@t4lovers.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                    className="h-14 rounded-2xl text-base"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="h-14 w-full rounded-2xl text-base"
                  disabled={busy}
                >
                  {loading === "magic" ? t("submitting") : t("magicLinkButton")}
                </Button>
              </form>

              {passwordEnabled ? (
                <>
                  <div className="my-1 flex items-center gap-3">
                    <Separator className="flex-1" />
                    <span className="text-muted-foreground text-xs uppercase">
                      {t("orDivider")}
                    </span>
                    <Separator className="flex-1" />
                  </div>
                  <form className="flex flex-col gap-3" onSubmit={onEmail}>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="password">{t("passwordLabel")}</Label>
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={busy}
                        className="h-14 rounded-2xl text-base"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      size="lg"
                      className="h-14 w-full rounded-2xl text-base"
                      disabled={busy}
                    >
                      {loading === "email"
                        ? t("submitting")
                        : t("emailSignInButton")}
                    </Button>
                  </form>
                </>
              ) : null}

              <p className="text-muted-foreground/70 mt-3 text-center text-xs leading-relaxed">
                {t("authorizedOnly")}
              </p>
              {error ? (
                <p className="text-destructive text-sm">{error}</p>
              ) : null}
            </div>
          )}

          {step === "sent" && (
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="bg-muted mb-1.5 grid size-20 place-items-center rounded-3xl">
                <Mail className="text-muted-foreground size-9" />
              </span>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {t("sentTitle")}
              </h2>
              <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
                {t("sentBody")}{" "}
                <strong className="text-foreground">
                  {email || t("yourWorkEmail")}
                </strong>
                . {t("openOnDevice")}
              </p>
              <div className="bg-muted mt-3.5 flex w-full items-center gap-2.5 rounded-2xl px-4 py-3.5 text-left">
                <span className="text-lg">⏱️</span>
                <span className="text-muted-foreground text-xs leading-snug">
                  {t("linkExpires")}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => void sendMagicLink()}
                  className="text-primary font-bold"
                >
                  {t("resend")}
                </button>
                <span className="text-border">·</span>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-muted-foreground font-bold"
                >
                  {t("changeEmail")}
                </button>
              </div>
              <Button
                size="lg"
                className="mt-4 h-14 w-full rounded-2xl text-base"
                onClick={() => {
                  setPin("");
                  setStep("pin");
                }}
              >
                {t("openedLink")}
              </Button>
            </div>
          )}

          {step === "pin" && (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-3">
                <span
                  className={`font-display grid size-12 flex-none place-items-center rounded-full text-base font-semibold text-white ${GRAD}`}
                >
                  LF
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-muted-foreground/70 text-xs font-extrabold tracking-wider">
                    {t("startShift")}
                  </div>
                  <div className="text-lg font-extrabold">
                    {t("hiCashier", { name: "Lucía" })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-primary text-sm font-bold whitespace-nowrap"
                >
                  {t("switchCashier")}
                </button>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("pinHint")}
              </p>
              <div className="flex justify-center gap-3.5 py-2">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`size-4 rounded-full border-2 ${i < pin.length ? "bg-primary border-primary" : "border-border"}`}
                  />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                  <PinKey key={n} onClick={() => pressPin(n)}>
                    {n}
                  </PinKey>
                ))}
                <span />
                <PinKey onClick={() => pressPin("0")}>0</PinKey>
                <PinKey ghost onClick={() => setPin((p) => p.slice(0, -1))}>
                  <Delete className="size-5" />
                </PinKey>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function PinKey({
  ghost,
  onClick,
  children,
}: {
  ghost?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-display grid h-16 place-items-center rounded-2xl text-2xl font-semibold transition-transform active:scale-95 ${ghost ? "text-muted-foreground" : "border-border bg-card text-foreground border"}`}
    >
      {children}
    </button>
  );
}
