"use client";

import {
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
} from "@loyalty/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useRouter } from "@/i18n/navigation";

import { usePhoneOtp } from "../hooks/use-phone-otp";

/**
 * Phone-capture step for customers who signed in with Google (the loyalty
 * identity is the phone). Verifying with `updatePhoneNumber: true` links the
 * phone to the current session and the Worker provisions their `customer` row.
 */
export function CompletePhoneForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
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
    const ok = await otp.verifyOtp(codeInput, { updatePhoneNumber: true });
    if (ok) router.push("/");
  };

  const onChangePhone = () => {
    setCodeInput("");
    otp.reset();
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t("completePhoneTitle")}</CardTitle>
        <CardDescription>{t("completePhoneSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
