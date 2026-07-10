"use client";

import type { MarketingChannel } from "@loyalty/api/features/customers/schemas";
import {
  Button,
  DateWheelPicker,
  Input,
  InputPhone,
  Label,
  NumberInput,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
  Skeleton,
  Textarea,
} from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  Coins,
  Mail,
  MessageCircle,
  MessageSquare,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { useRouter } from "@/i18n/navigation";
import { compactNumber } from "@/lib/money";
import { useTRPC } from "@/lib/trpc/client";

import { customerInitials } from "../lib/initials";

const CHANNELS: MarketingChannel[] = ["push", "mail", "sms", "whatsapp"];
const CHANNEL_META: Record<MarketingChannel, { icon: LucideIcon; key: string }> = {
  push: { icon: Bell, key: "push" },
  mail: { icon: Mail, key: "email" },
  sms: { icon: MessageSquare, key: "sms" },
  whatsapp: { icon: MessageCircle, key: "whatsapp" },
};

type BirthDate = { day: number; month: number; year: number };

type Draft = {
  name: string;
  nickname: string;
  phone: string;
  email: string;
  birthday: BirthDate | null;
  notes: string;
  channels: MarketingChannel[];
  initialStamps: number;
  initialPoints: number;
};

const EMPTY: Draft = {
  name: "",
  nickname: "",
  phone: "",
  email: "",
  birthday: null,
  notes: "",
  channels: ["push", "mail"],
  initialStamps: 0,
  initialPoints: 0,
};

const toBirthDate = (d: Date): BirthDate => ({
  day: d.getUTCDate(),
  month: d.getUTCMonth() + 1,
  year: d.getUTCFullYear(),
});
const toDate = (b: BirthDate): Date => new Date(Date.UTC(b.year, b.month - 1, b.day));

export function CustomerWizard({ id }: { id?: string }) {
  const trpc = useTRPC();

  // Edit mode: hydrate the draft from the real customer + their prefs before
  // rendering the form, so nothing flickers from empty to filled.
  const detail = useQuery({ ...trpc.customers.adminGet.queryOptions({ customerId: id ?? "" }), enabled: !!id });
  const prefs = useQuery({ ...trpc.customers.marketingChannels.queryOptions({ customerId: id ?? "" }), enabled: !!id });

  if (id && (detail.isPending || prefs.isPending)) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-96 w-full rounded-3xl" />
      </div>
    );
  }

  const initial: Draft =
    id && detail.data
      ? {
          name: detail.data.name ?? "",
          nickname: detail.data.nickname ?? "",
          phone: detail.data.phone,
          email: detail.data.email ?? "",
          birthday: detail.data.birthday ? toBirthDate(new Date(detail.data.birthday)) : null,
          notes: detail.data.notes ?? "",
          channels: prefs.data ?? [],
          initialStamps: 0,
          initialPoints: 0,
        }
      : EMPTY;

  return <WizardInner id={id} initial={initial} />;
}

function WizardInner({ id, initial }: { id?: string; initial: Draft }) {
  const t = useTranslations("Customers");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const trpc = useTRPC();

  const [draft, setDraft] = useState<Draft>(initial);
  const [stepIndex, setStepIndex] = useState(0);
  const [bdayOpen, setBdayOpen] = useState(false);

  // The initial-load step is create-only; balances are edited from the detail.
  const STEPS = useMemo(
    () => (id ? (["basics", "preferences", "review"] as const) : (["basics", "loyalty", "preferences", "review"] as const)),
    [id],
  );
  const step = STEPS[stepIndex]!;

  const monthLabels = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2000, i, 1)),
      ),
    [locale],
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const toggleChannel = (c: MarketingChannel) =>
    set("channels", draft.channels.includes(c) ? draft.channels.filter((x) => x !== c) : [...draft.channels, c]);

  const create = useMutation(trpc.customers.create.mutationOptions());
  const update = useMutation(trpc.customers.update.mutationOptions());
  const saving = create.isPending || update.isPending;

  const phoneValid = draft.phone.trim().length >= 8;

  const onError = (err: { message?: string }) => {
    if (err.message === "PHONE_IN_USE") toast.error(t("errPhoneInUse"));
    else if (err.message === "NICKNAME_IN_USE") toast.error(t("errNicknameInUse"));
    else toast.error(id ? t("errUpdate") : t("errCreate"));
  };

  const submit = () => {
    const name = draft.name.trim();
    const birthday = draft.birthday ? toDate(draft.birthday) : null;

    if (id) {
      update.mutate(
        {
          id,
          name,
          email: draft.email.trim() || null,
          nickname: draft.nickname.trim() || null,
          birthday,
          notes: draft.notes.trim() || null,
          marketingChannels: draft.channels,
        },
        {
          onSuccess: () => {
            toast.success(t("updated", { name: name || draft.phone }));
            router.push({ pathname: "/customers/[id]", params: { id } });
          },
          onError,
        },
      );
      return;
    }

    create.mutate(
      {
        phone: draft.phone.trim(),
        name: name || undefined,
        email: draft.email.trim() || undefined,
        nickname: draft.nickname.trim() || undefined,
        birthday: birthday ?? undefined,
        notes: draft.notes.trim() || undefined,
        marketingChannels: draft.channels,
        initialStamps: draft.initialStamps || undefined,
        initialPoints: draft.initialPoints || undefined,
      },
      {
        onSuccess: ({ id: newId }) => {
          toast.success(t("created", { name: name || draft.phone }));
          router.push({ pathname: "/customers/[id]", params: { id: newId } });
        },
        onError,
      },
    );
  };

  const onNext = () => {
    if (step === "basics" && !phoneValid) {
      toast.error(t("errPhoneRequired"));
      return;
    }
    if (stepIndex === STEPS.length - 1) {
      submit();
      return;
    }
    setStepIndex((n) => n + 1);
  };

  const steps = STEPS.map((key) => ({ key, label: t(`wizard.${key}`) }));

  return (
    <WizardShell
      title={id ? t("editTitle") : t("newTitle")}
      steps={steps}
      current={step}
      completed={STEPS.slice(0, stepIndex)}
      onStepSelect={(key) => {
        const idx = (STEPS as readonly string[]).indexOf(key);
        if (idx >= 0 && idx <= stepIndex) setStepIndex(idx);
      }}
      onBack={() => setStepIndex((n) => Math.max(0, n - 1))}
      onNext={onNext}
      isFirst={stepIndex === 0}
      isLast={stepIndex === STEPS.length - 1}
      finishLabel={id ? t("saveChanges") : t("create")}
      saving={saving}
      onExit={() => router.push("/customers")}
      exitLabel={t("backToList")}
      preview={<CustomerPreview draft={draft} monthLabels={monthLabels} showLoyalty={!id} t={t} format={format} />}
    >
      {step === "basics" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("fieldName")} hint={t("optional")}>
              <Input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("fieldNamePlaceholder")}
                className="h-10"
                autoFocus
              />
            </Field>
            <Field label={t("fieldNickname")} hint={t("optional")}>
              <Input
                value={draft.nickname}
                onChange={(e) => set("nickname", e.target.value)}
                placeholder={t("fieldNicknamePlaceholder")}
                className="h-10"
              />
            </Field>
          </div>
          <Field label={t("fieldPhone")}>
            <InputPhone size="sm" value={draft.phone} onChange={(v) => set("phone", v.e164)} />
          </Field>
          <Field label={t("email")} hint={t("optional")}>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="cliente@correo.com"
              className="h-10"
            />
          </Field>
          <Field label={t("birthday")} hint={t("optional")}>
            <button
              type="button"
              onClick={() => setBdayOpen(true)}
              className="border-input bg-input/30 hover:bg-input/50 flex h-10 w-full items-center gap-2.5 rounded-xl border px-4 text-left text-sm transition-colors"
            >
              <CalendarDays className="text-muted-foreground size-4" />
              {draft.birthday
                ? `${draft.birthday.day} ${monthLabels[draft.birthday.month - 1]} ${draft.birthday.year}`
                : t("detail.noBirthday")}
            </button>
          </Field>
        </div>
      ) : step === "loyalty" ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">{t("initialHint")}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("initialStamps")} hint={t("optional")}>
              <NumberInput
                value={draft.initialStamps}
                onValueChange={(v) => set("initialStamps", v ?? 0)}
                className="h-10"
              />
            </Field>
            <Field label={t("initialPoints")} hint={t("optional")}>
              <NumberInput
                value={draft.initialPoints}
                onValueChange={(v) => set("initialPoints", v ?? 0)}
                className="h-10"
              />
            </Field>
          </div>
        </div>
      ) : step === "preferences" ? (
        <div className="space-y-5">
          <Field label={t("channelsLabel")} hint={t("channelsHint")}>
            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map((c) => {
                const Icon = CHANNEL_META[c].icon;
                const on = draft.channels.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleChannel(c)}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-semibold transition-colors ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                    {t(`channel.${CHANNEL_META[c].key}`)}
                  </button>
                );
              })}
            </div>
          </Field>
          <p className="text-muted-foreground/80 text-xs font-semibold">{t("marketingHint")}</p>
          <Field label={t("notes")} hint={t("optional")}>
            <Textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={5}
              className="min-h-36 rounded-xl"
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">{t("reviewTitle")}</h2>
          <dl className="divide-border divide-y text-sm">
            <ReviewRow label={t("fieldName")} value={draft.name || "—"} />
            <ReviewRow label={t("fieldPhone")} value={draft.phone || "—"} />
            <ReviewRow label={t("email")} value={draft.email || "—"} />
            {!id ? (
              <>
                <ReviewRow label={t("initialStamps")} value={`${draft.initialStamps}`} />
                <ReviewRow label={t("initialPoints")} value={format.number(draft.initialPoints)} />
              </>
            ) : null}
            <ReviewRow
              label={t("channelsLabel")}
              value={
                draft.channels.length
                  ? draft.channels.map((c) => t(`channel.${CHANNEL_META[c].key}`)).join(", ")
                  : "—"
              }
            />
          </dl>
        </div>
      )}

      <ResponsiveModal open={bdayOpen} onOpenChange={setBdayOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="px-6 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("birthday")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm">
              {t("birthdayHint")}
            </ResponsiveModalDescription>
            <DateWheelPicker
              className="mt-4"
              value={draft.birthday ?? { day: 1, month: 1, year: 2000 }}
              onValueChange={(v) => set("birthday", v)}
              monthLabels={monthLabels}
              maxYear={new Date().getFullYear()}
            />
            <Button onClick={() => setBdayOpen(false)} className="mt-4 h-12 w-full rounded-xl font-semibold">
              {t("done")}
            </Button>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </WizardShell>
  );
}

function CustomerPreview({
  draft,
  monthLabels,
  showLoyalty,
  t,
  format,
}: {
  draft: Draft;
  monthLabels: string[];
  showLoyalty: boolean;
  t: ReturnType<typeof useTranslations>;
  format: ReturnType<typeof useFormatter>;
}) {
  const initials = customerInitials(draft.name || null, draft.phone || "T4");
  return (
    <div className="preview-customer bg-card border-border rounded-3xl border p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary font-display grid size-12 flex-none place-items-center rounded-2xl text-lg font-bold">
          {initials}
        </span>
        <div className="min-w-0">
          <div className="truncate font-bold">{draft.name || t("namePlaceholder")}</div>
          {draft.nickname ? (
            <div className="text-muted-foreground/70 truncate text-xs font-semibold">
              @{draft.nickname}
            </div>
          ) : null}
        </div>
      </div>
      {showLoyalty ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-primary inline-flex items-center gap-1 text-xs font-bold">
            <Stamp className="size-3" />
            {draft.initialStamps}
          </span>
          <span className="text-primary inline-flex items-center gap-1 text-xs font-bold">
            <Coins className="size-3" />
            {compactNumber(format, draft.initialPoints)}
          </span>
        </div>
      ) : null}
      <div className="text-muted-foreground/80 mt-3 space-y-1 text-xs font-semibold">
        {draft.phone ? <div>{draft.phone}</div> : null}
        {draft.birthday ? (
          <div>
            {t("birthday")}: {draft.birthday.day} {monthLabels[draft.birthday.month - 1]}
          </div>
        ) : null}
      </div>
      {draft.channels.length ? (
        <div className="mt-3 flex gap-1.5">
          {draft.channels.map((c) => {
            const Icon = CHANNEL_META[c].icon;
            return (
              <span
                key={c}
                className="bg-muted text-muted-foreground grid size-7 place-items-center rounded-lg"
              >
                <Icon className="size-3.5" />
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {hint ? <span className="text-muted-foreground/70 text-xs font-semibold">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground font-semibold">{label}</dt>
      <dd className="truncate text-right font-bold">{value}</dd>
    </div>
  );
}
