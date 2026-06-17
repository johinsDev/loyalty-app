"use client";

import { authClient } from "@loyalty/auth/client";
import {
  Button,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputPhone,
  isValidE164Phone,
  Spinner,
} from "@loyalty/ui";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { parseAsInteger, parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useState } from "react";

import { getAppUrl } from "@/lib/app-url";

import { usePhoneOtp } from "../hooks/use-phone-otp";
import { Confetti } from "./confetti";
import { EmojiTile } from "./emoji-tile";
import { IconWhatsApp } from "./icon-whatsapp";

const STEPS = ["intro", "phone", "otp", "success"] as const;

/**
 * Playful WhatsApp-first onboarding — implements the "T4 Onboarding · Fun"
 * Claude Design template. Mobile-first single-column flow: intro carousel →
 * phone → OTP → success. Phone-OTP + Google run through the real auth client
 * (`usePhoneOtp` + `authClient.signIn.social`). On verify it lands on a
 * celebration screen; "Ver mi tarjeta" goes home.
 */
export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const forbidden = useSearchParams().get("error") === "forbidden";

  const otp = usePhoneOtp();
  // The whole flow is URL-driven: `?step=` is the wizard stage (the browser
  // back button mirrors the in-screen back button) and `?slide=` is the
  // onboarding card. Both clear from the URL at their default for a clean entry.
  const [step, setStep] = useQueryState(
    "step",
    parseAsStringLiteral(STEPS)
      .withDefault("intro")
      .withOptions({ history: "push", clearOnDefault: true }),
  );
  const [intro, setIntro] = useQueryState(
    "slide",
    parseAsInteger.withDefault(0).withOptions({ clearOnDefault: true }),
  );
  const [dir, setDir] = useState<"next" | "prev">("next");
  const goIntro = (i: number) => {
    setDir(i >= intro ? "next" : "prev");
    void setIntro(i);
  };
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const phoneValid = isValidE164Phone(phone);

  // Autofocus the phone field when its screen opens (the conditional remount
  // makes React's autoFocus unreliable across the slide transition).
  useEffect(() => {
    if (step !== "phone") return;
    const id = window.setTimeout(() => {
      document
        .querySelector<HTMLInputElement>('[data-slot="input-phone-number"]')
        ?.focus();
    }, 60);
    return () => window.clearTimeout(id);
  }, [step]);

  const onGoogle = async () => {
    if (!googleEnabled) return;
    setGoogleLoading(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: `${getAppUrl()}/`,
    });
    if (error) setGoogleLoading(false);
  };

  const onSendCode = async () => {
    if (!phoneValid) {
      setPhoneError(t("phoneInvalid"));
      return;
    }
    setPhoneError(null);
    const ok = await otp.requestOtp(phone);
    if (ok) {
      setCode("");
      void setStep("otp");
    } else {
      setPhoneError(t("errorSendFailed"));
    }
  };

  const onVerify = async () => {
    if (code.length !== 6) return;
    const ok = await otp.verifyOtp(code);
    // Hard navigation (not router.push) so the home is fetched fresh with the
    // new session cookie — a soft nav serves the cached, unauthenticated RSC
    // which bounces back to /sign-in. (The success/confetti screen is a stub
    // we'll remove; redirect straight to the card.)
    if (ok) window.location.href = "/";
  };

  const intros = [
    { emoji: "🧋", title: t("intro1Title"), sub: t("intro1Sub") },
    { emoji: "⭐", title: t("intro2Title"), sub: t("intro2Sub") },
    { emoji: "🎁", title: t("intro3Title"), sub: t("intro3Sub") },
  ];
  const lastIntro = intros.length - 1;
  // Clamp the URL-supplied slide so a hand-typed `?slide=99` can't index past
  // the carousel (the raw value still drives the slide-direction animation).
  const slideIdx = Math.min(Math.max(intro, 0), lastIntro);

  return (
    <div className="text-foreground mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-x-hidden">
      {/* ===== 1 · INTRO ===== */}
      {step === "intro" && (
        <Screen>
          <div className="flex h-12 items-center justify-end px-4">
            {slideIdx < lastIntro && (
              <button
                type="button"
                onClick={() => goIntro(lastIntro)}
                className="text-muted-foreground px-2 py-1 text-base font-semibold"
              >
                {t("skip")}
              </button>
            )}
          </div>
          <Content className="items-center justify-center gap-7 text-center">
            <div
              key={slideIdx}
              className={`animate-in fade-in-0 flex flex-col items-center gap-7 duration-300 ease-out ${
                dir === "next" ? "slide-in-from-right-10" : "slide-in-from-left-10"
              }`}
            >
              <button
                type="button"
                onClick={() => goIntro(Math.min(slideIdx + 1, lastIntro))}
                aria-label={t("next")}
              >
                <EmojiTile size="lg">{intros[slideIdx]!.emoji}</EmojiTile>
              </button>
              <div className="flex flex-col gap-3">
                <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight whitespace-pre-line">
                  {intros[slideIdx]!.title}
                </h1>
                <p className="text-muted-foreground text-base leading-relaxed">
                  {intros[slideIdx]!.sub}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {intros.map((slide, i) => (
                <button
                  key={slide.emoji}
                  type="button"
                  onClick={() => goIntro(i)}
                  aria-label={`${i + 1}`}
                  className={`h-2.5 rounded-full transition-all ${
                    slideIdx === i ? "bg-primary w-6" : "w-2.5 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </Content>
          <Footer>
            {/* Primary button is the LAST child → anchored at the bottom on
                every slide. The Google row sits ABOVE it with a reserved height,
                so it appears on the last slide without moving the button (no
                jump, button stays low). */}
            {forbidden && (
              <p className="text-center text-sm font-semibold text-amber-600">
                {t("errorForbidden")}
              </p>
            )}
            <div className="flex h-11 items-center justify-center">
              {slideIdx === lastIntro && googleEnabled && (
                <button
                  type="button"
                  onClick={() => void onGoogle()}
                  disabled={googleLoading}
                  className="text-primary text-base font-semibold disabled:opacity-50"
                >
                  {t("googleLink")}
                </button>
              )}
            </div>
            <Button
              variant="gradient"
              className="h-14 w-full gap-2.5 rounded-full text-base font-bold"
              onClick={() =>
                slideIdx < lastIntro ? goIntro(slideIdx + 1) : void setStep("phone")
              }
            >
              {slideIdx < lastIntro ? (
                t("next")
              ) : (
                <>
                  <IconWhatsApp className="size-6" />
                  {t("whatsappButton")}
                </>
              )}
            </Button>
          </Footer>
        </Screen>
      )}

      {/* ===== 2 · TELÉFONO ===== */}
      {step === "phone" && (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void onSendCode();
          }}
        >
          <BackBar onClick={() => void setStep("intro")} label={t("back")} />
          <Content className="gap-0">
            <EmojiTile className="mb-6">
              <IconWhatsApp className="size-11 text-[#25D366]" />
            </EmojiTile>
            <h1 className="font-display mb-2 text-[2rem] leading-[1.05] font-semibold tracking-tight">
              {t("phoneScreenTitle")}
            </h1>
            <p className="text-muted-foreground mb-7 text-base leading-relaxed">
              {t("phoneScreenSubtitle")}
            </p>
            <span className="mb-2 text-base font-bold">{t("phoneFieldLabel")}</span>
            <InputPhone
              className="[&_button]:h-16 [&_input]:h-16 [&_input]:text-lg"
              defaultCountry="CO"
              locale={locale}
              value={phone}
              onChange={(v) => {
                setPhone(v.e164);
                if (phoneError) setPhoneError(null);
              }}
              aria-invalid={!!phoneError}
              placeholder={t("phonePlaceholder")}
              autoFocus
            />
            {phoneError && (
              <p className="text-destructive mt-2 text-sm">{phoneError}</p>
            )}
          </Content>
          <Footer>
            <Button
              type="submit"
              variant="gradient"
              className="h-14 w-full gap-2.5 rounded-full text-base font-bold"
              disabled={otp.isSending}
            >
              {otp.isSending ? (
                <>
                  <Spinner className="size-5" />
                  {t("sending")}
                </>
              ) : (
                t("sendCodeButton")
              )}
            </Button>
          </Footer>
        </form>
      )}

      {/* ===== 3 · CÓDIGO (OTP) ===== */}
      {step === "otp" && (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void onVerify();
          }}
        >
          <BackBar onClick={() => void setStep("phone")} label={t("back")} />
          <Content className="gap-0">
            <EmojiTile className="mb-6">🔑</EmojiTile>
            <h1 className="font-display mb-2 text-[2rem] leading-[1.05] font-semibold tracking-tight">
              {t("otpTitle")}
            </h1>
            <p className="text-muted-foreground mb-7 text-base leading-relaxed">
              {t("codeSentTo", { phone: otp.phone })}
            </p>
            <div className="mb-4 flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => setCode(v)}
                autoFocus
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="rounded-2xl" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="min-h-6 text-center">
              {otp.error ? (
                <span className="text-destructive text-sm font-bold">
                  {t("otpError")}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">
                  {t("notReceived")}{" "}
                  <button
                    type="button"
                    onClick={() => void otp.resendOtp()}
                    disabled={!otp.canResend || otp.isSending}
                    className="text-primary font-semibold disabled:text-muted-foreground/70 disabled:cursor-not-allowed"
                  >
                    {otp.canResend
                      ? t("resendCode")
                      : t("resendIn", { seconds: otp.secondsLeft })}
                  </button>
                </span>
              )}
            </div>
          </Content>
          <Footer>
            <Button
              type="submit"
              variant="gradient"
              className="h-14 w-full gap-2.5 rounded-full text-base font-bold"
              disabled={code.length !== 6 || otp.isVerifying}
            >
              {otp.isVerifying ? (
                <>
                  <Spinner className="size-5" />
                  {t("verifying")}
                </>
              ) : (
                t("verifyButton")
              )}
            </Button>
          </Footer>
        </form>
      )}

      {/* ===== 5 · ÉXITO ===== */}
      {step === "success" && (
        <Screen className="relative overflow-hidden">
          <Confetti />
          <Content className="z-10 items-center pt-8 text-center">
            <EmojiTile size="lg">🎉</EmojiTile>
            <h1 className="font-display mt-6 mb-2 text-[2rem] leading-[1.05] font-semibold tracking-tight whitespace-pre-line">
              {t("successTitle")}
            </h1>
            <p className="text-muted-foreground mb-6 text-base">
              {t("successSubtitle")}
            </p>
            <div className="from-primary inline-flex items-center gap-2 rounded-full bg-linear-to-br to-[oklch(0.756_0.125_183.7)] px-6 py-3.5 text-xl font-extrabold text-white shadow-lg shadow-primary/30">
              {t("welcomeStamp")}
            </div>
            <WelcomeCard
              title={t("cardTitle")}
              progress={t("cardProgress")}
              remaining={t("cardRemaining")}
            />
          </Content>
          <Footer>
            <Button
              variant="gradient"
              className="h-14 w-full rounded-full text-base font-bold"
              onClick={() => {
                // Hard navigation (not router.push) so the home is fetched fresh
                // with the new session cookie — a soft nav serves the cached,
                // unauthenticated RSC which bounces back to /sign-in.
                window.location.href = "/";
              }}
            >
              {t("viewCard")}
            </Button>
          </Footer>
        </Screen>
      )}
    </div>
  );
}

function Screen({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`flex flex-1 flex-col ${className}`}>{children}</div>;
}

function Content({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-7 pt-4 pb-3 ${className}`}
    >
      {children}
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {children}
    </div>
  );
}

function BackBar({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div className="px-5 pt-6 pb-2">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flex size-11 items-center justify-center rounded-full bg-muted"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 5l-7 7 7 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

function WelcomeCard({
  title,
  progress,
  remaining,
}: {
  title: string;
  progress: string;
  remaining: string;
}) {
  return (
    <div className="ring-foreground/10 mt-4 w-full rounded-3xl p-6 text-left shadow-sm ring-1">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-bold">{title}</span>
        <span className="text-muted-foreground text-[13px]">{progress}</span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${i === 0 ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
      <p className="text-muted-foreground mt-3 text-[13px]">{remaining}</p>
    </div>
  );
}
