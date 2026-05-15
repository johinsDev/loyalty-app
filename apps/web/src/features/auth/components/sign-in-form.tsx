"use client";

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputPhone,
  Label,
  Separator,
} from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";

import { usePhoneOtp } from "../hooks/use-phone-otp";
import { GoogleSignInButton } from "./google-sign-in-button";

export function SignInForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const forbidden = searchParams.get("error") === "forbidden";
  const otp = usePhoneOtp();
  const [phoneInput, setPhoneInput] = useState<string | undefined>("");
  const [codeInput, setCodeInput] = useState("");

  const onRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput || phoneInput.length < 8) return;
    await otp.requestOtp(phoneInput);
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codeInput.length !== 6) return;
    const ok = await otp.verifyOtp(codeInput);
    if (ok) router.push("/");
  };

  const onChangePhone = () => {
    setCodeInput("");
    otp.reset();
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {forbidden ? (
          <Alert variant="default" className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <AlertDescription>{t("errorForbidden")}</AlertDescription>
          </Alert>
        ) : null}
        <GoogleSignInButton />

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs uppercase text-muted-foreground">
            {t("or")}
          </span>
        </div>

        {otp.step === "phone" ? (
          <form className="space-y-3" onSubmit={onRequestOtp}>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("phoneLabel")}</Label>
              <InputPhone
                id="phone"
                name="phone"
                value={phoneInput}
                onChange={setPhoneInput}
                placeholder={t("phonePlaceholder")}
                autoComplete="tel"
                required
              />
            </div>
            {otp.error ? (
              <p className="text-destructive text-sm">{otp.error}</p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={otp.isSending || !phoneInput || phoneInput.length < 8}
            >
              {otp.isSending ? t("sending") : t("sendCodeButton")}
            </Button>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={onVerifyOtp}>
            <div className="space-y-1.5">
              <Label>{t("codeLabel")}</Label>
              <p className="text-muted-foreground text-sm">
                {t("codeSentTo", { phone: otp.phone })}
              </p>
              <div className="flex justify-center pt-2">
                <InputOTP
                  maxLength={6}
                  value={codeInput}
                  onChange={setCodeInput}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            {otp.error ? (
              <p className="text-destructive text-sm">{otp.error}</p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={otp.isVerifying || codeInput.length !== 6}
            >
              {otp.isVerifying ? t("verifying") : t("verifyButton")}
            </Button>
            <div className="flex flex-col items-center gap-1.5 text-sm">
              <button
                type="button"
                onClick={() => void otp.resendOtp()}
                disabled={!otp.canResend || otp.isSending}
                className="text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {otp.canResend
                  ? t("resendCode")
                  : t("resendIn", { seconds: otp.secondsLeft })}
              </button>
              <button
                type="button"
                onClick={onChangePhone}
                className="text-muted-foreground hover:text-foreground underline"
              >
                {t("changePhone")}
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
