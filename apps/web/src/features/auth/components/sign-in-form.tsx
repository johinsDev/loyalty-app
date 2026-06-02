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
  isValidE164Phone,
  Label,
  Separator,
} from "@loyalty/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useRouter } from "@/i18n/navigation";

import { usePhoneOtp } from "../hooks/use-phone-otp";
import { GoogleSignInButton } from "./google-sign-in-button";

export function SignInForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forbidden = searchParams.get("error") === "forbidden";
  const otp = usePhoneOtp();
  const [codeInput, setCodeInput] = useState("");

  const phoneSchema = useMemo(
    () =>
      z.object({
        phone: z
          .string()
          .refine(isValidE164Phone, { message: t("phoneInvalid") }),
      }),
    [t],
  );
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ phone: string }>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  const onRequestOtp = handleSubmit(async ({ phone }) => {
    await otp.requestOtp(phone);
  });

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
          <form className="space-y-3" onSubmit={onRequestOtp} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("phoneLabel")}</Label>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <InputPhone
                    id="phone"
                    defaultCountry="CO"
                    locale={locale}
                    value={field.value}
                    onChange={(v) => field.onChange(v.e164)}
                    onBlur={field.onBlur}
                    aria-invalid={!!errors.phone}
                    placeholder={t("phonePlaceholder")}
                  />
                )}
              />
              {errors.phone ? (
                <p className="text-destructive text-sm">{errors.phone.message}</p>
              ) : null}
            </div>
            {otp.error ? (
              <p className="text-destructive text-sm">{otp.error}</p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={otp.isSending || isSubmitting}
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
