"use client";

import {
  Button,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Textarea,
} from "@loyalty/ui";
import { useMutation } from "@tanstack/react-query";
import { MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

type Mode = "template" | "custom";
type Mailer = "default" | "log" | "outbox" | "resend";

/**
 * Dev-only "Send test email" form. Queues the `send-test-email`
 * Trigger.dev task (via `emailOutbox.sendTest`) with either a known
 * template or a custom subject + HTML, and an optional mailer override
 * so an operator can force `resend` on a preview deploy to confirm the
 * live provider end to end. On success it bumps `_r` so the outbox table
 * re-suspenses and shows the new row (when the active provider is outbox).
 */
export function SendTestEmailForm() {
  const t = useTranslations("EmailOutbox");
  const trpc = useTRPC();
  const sendTest = useMutation(trpc.emailOutbox.sendTest.mutationOptions());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRefreshing, startTransition] = useTransition();

  const [to, setTo] = useState("");
  const [mode, setMode] = useState<Mode>("template");
  const [templateId, setTemplateId] = useState<"welcome">("welcome");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [mailer, setMailer] = useState<Mailer>("default");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const override = mailer === "default" ? undefined : mailer;
    try {
      if (mode === "template") {
        await sendTest.mutateAsync({
          to,
          mode: "template",
          templateId,
          ...(override && { mailer: override }),
        });
      } else {
        await sendTest.mutateAsync({
          to,
          mode: "custom",
          subject,
          html,
          ...(override && { mailer: override }),
        });
      }
      toast.success(t("testSent", { mailer: override ?? t("mailerDefault") }));
      const next = new URLSearchParams(searchParams);
      next.set("_r", Date.now().toString());
      startTransition(() => router.replace(`${pathname}?${next.toString()}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("testFailedGeneric"));
    }
  };

  const isPending = sendTest.isPending || isRefreshing;

  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 space-y-3 rounded-lg border border-border p-4"
    >
      <h2 className="text-sm font-medium">{t("testTitle")}</h2>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grow space-y-1">
          <Label htmlFor="test-to">{t("testToLabel")}</Label>
          <Input
            id="test-to"
            type="email"
            required
            placeholder="lucia@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="test-mode">{t("testModeLabel")}</Label>
          <NativeSelect
            id="test-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
          >
            <NativeSelectOption value="template">
              {t("testModeTemplate")}
            </NativeSelectOption>
            <NativeSelectOption value="custom">
              {t("testModeCustom")}
            </NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="test-mailer">{t("testMailerLabel")}</Label>
          <NativeSelect
            id="test-mailer"
            value={mailer}
            onChange={(e) => setMailer(e.target.value as Mailer)}
          >
            <NativeSelectOption value="default">
              {t("mailerDefault")}
            </NativeSelectOption>
            <NativeSelectOption value="log">log</NativeSelectOption>
            <NativeSelectOption value="outbox">outbox</NativeSelectOption>
            <NativeSelectOption value="resend">resend</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>

      {mode === "template" ? (
        <div className="space-y-1">
          <Label htmlFor="test-template">{t("testTemplateLabel")}</Label>
          <NativeSelect
            id="test-template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value as "welcome")}
          >
            <NativeSelectOption value="welcome">Welcome</NativeSelectOption>
          </NativeSelect>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="test-subject">{t("testSubjectLabel")}</Label>
            <Input
              id="test-subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="test-html">{t("testHtmlLabel")}</Label>
            <Textarea
              id="test-html"
              required
              rows={5}
              placeholder="<h1>Hola</h1>"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending} aria-busy={isPending}>
          <MailIcon className="size-4" aria-hidden />
          {isPending ? t("testSending") : t("testButton")}
        </Button>
        {mailer === "resend" ? (
          <span className="text-xs text-muted-foreground">
            {t("testResendHint")}
          </span>
        ) : null}
      </div>
    </form>
  );
}
