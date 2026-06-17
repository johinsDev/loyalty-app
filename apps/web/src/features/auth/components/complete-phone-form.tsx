"use client";

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
import { useState } from "react";

import { usePhoneOtp } from "../hooks/use-phone-otp";

/**
 * Phone-capture step for customers who signed in with Google (the loyalty
 * identity is the phone). Verifying with `updatePhoneNumber: true` links the
 * phone to the current session and the Worker provisions their `customer` row.
 * Matches the "T4 Onboarding · Fun" capture screen (full-screen, mobile-first).
 */
export function CompletePhoneForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const otp = usePhoneOtp();
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const phoneValid = isValidE164Phone(phone);

  const onSendCode = async () => {
    if (!phoneValid) {
      setPhoneError(t("phoneInvalid"));
      return;
    }
    setPhoneError(null);
    const ok = await otp.requestOtp(phone);
    if (ok) setCode("");
    else setPhoneError(t("errorSendFailed"));
  };

  const onVerify = async () => {
    if (code.length !== 6) return;
    const ok = await otp.verifyOtp(code, { updatePhoneNumber: true });
    // Hard navigation so the home is fetched fresh with the new session cookie
    // (a soft router.push serves the cached, unauthenticated RSC → bounce loop).
    if (ok) window.location.href = "/";
  };

  return (
    <form
      className="text-foreground mx-auto flex min-h-[100dvh] w-full max-w-md flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (otp.step === "phone") void onSendCode();
        else void onVerify();
      }}
    >
      <div className="flex-1 overflow-y-auto px-7 pt-6 pb-3">
        {/* orange tile — distinct from the teal flow, per the design */}
        <div className="mb-6 flex size-24 items-center justify-center rounded-[1.75rem] bg-linear-to-b from-[#fff6ec] to-[#ffe7cf] text-5xl shadow-xl shadow-[#ffaa50]/35">
          📲
        </div>
        {otp.step === "phone" ? (
          <>
            <h1 className="font-display mb-2 text-[2rem] leading-[1.05] font-semibold tracking-tight">
              {t("completePhoneTitle")}
            </h1>
            <p className="text-muted-foreground mb-7 text-base leading-relaxed">
              {t("completePhoneSubtitle")}
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
          </>
        ) : (
          <>
            <h1 className="font-display mb-2 text-[2rem] leading-[1.05] font-semibold tracking-tight">
              {t("otpTitle")}
            </h1>
            <p className="text-muted-foreground mb-7 text-base leading-relaxed">
              {t("codeSentTo", { phone: otp.phone })}
            </p>
            <div className="mb-4 flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
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
          </>
        )}
      </div>
      <div className="px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {otp.step === "phone" ? (
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
        ) : (
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
        )}
      </div>
    </form>
  );
}
