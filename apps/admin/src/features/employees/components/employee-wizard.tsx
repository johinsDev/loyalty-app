"use client";

import {
  Badge,
  Button,
  Input,
  InputPhone,
  Label,
  NumberStepper,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@loyalty/ui";
import { CircleCheck, MailPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Bars } from "@/features/dashboard/components/charts";
import { WizardShell } from "@/components/wizard-shell";
import { useRouter } from "@/i18n/navigation";

import {
  type EmployeeDraft,
  emptyEmployeeDraft,
  getActivitySeries,
  getEmployeeDraft,
  type Role,
  ROLES,
  type Status,
} from "../data";

const STEPS = ["profile", "access", "review"] as const;
type Step = (typeof STEPS)[number];

/**
 * Employee create/edit wizard (datos → acceso → revisar) with a live employee
 * card preview. Design-first: step state is local; finish toasts + returns to
 * the list. Seam: the Better Auth organization member + invitation model.
 */
export function EmployeeWizard({ id }: { id?: string }) {
  const t = useTranslations("Employees");
  const router = useRouter();
  const [draft, setDraft] = useState<EmployeeDraft>(
    id ? getEmployeeDraft(id) : emptyEmployeeDraft,
  );
  const [stepIndex, setStepIndex] = useState(0);

  const step = STEPS[stepIndex]!;
  const set = <K extends keyof EmployeeDraft>(key: K, value: EmployeeDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));
  const completed = STEPS.slice(0, stepIndex);

  const onNext = () => {
    if (stepIndex === STEPS.length - 1) {
      toast.success(`${id ? t("save") : t("create")} — ${draft.name}`);
      router.push("/employees");
      return;
    }
    setStepIndex((n) => n + 1);
  };

  return (
    <WizardShell
      title={id ? t("editTitle") : t("newTitle")}
      steps={steps}
      current={step}
      completed={completed}
      onStepSelect={(key) => {
        const idx = STEPS.indexOf(key as Step);
        if (idx <= stepIndex) setStepIndex(idx);
      }}
      onBack={() => setStepIndex((n) => Math.max(0, n - 1))}
      onNext={onNext}
      isFirst={stepIndex === 0}
      isLast={stepIndex === STEPS.length - 1}
      finishLabel={id ? t("save") : t("create")}
      preview={<EmployeePreview draft={draft} id={id} t={t} />}
    >
      {step === "profile" ? (
        <div className="space-y-4">
          <Field label={t("field.name")}>
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("namePlaceholder")}
              className="h-10"
              autoFocus
            />
          </Field>
          <Field label={t("field.email")}>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="h-10"
            />
          </Field>
          <Field label={t("field.phone")}>
            <InputPhone
              size="sm"
              value={draft.phone}
              onChange={(v) => set("phone", v.e164)}
            />
          </Field>
          <Field label={t("field.notes")}>
            <Textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={3}
              className="min-h-20 rounded-xl"
            />
          </Field>
        </div>
      ) : step === "access" ? (
        <div className="space-y-5">
          <Field label={t("field.role")}>
            <Select
              value={draft.role}
              onValueChange={(v) => set("role", (v ?? "staff") as Role)}
            >
              <SelectTrigger size="lg" className="w-full text-sm">
                <SelectValue>{(v) => t(`role.${v as Role}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(`role.${role}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("field.status")}>
            <SegmentedControl<Status>
              value={draft.status}
              onValueChange={(v) => set("status", v)}
              options={[
                {
                  value: "active",
                  label: t("status.active"),
                  icon: CircleCheck,
                },
                {
                  value: "invited",
                  label: t("status.invited"),
                  icon: MailPlus,
                },
              ]}
            />
          </Field>

          <Field label={t("field.dailyCap")} hint={t("dailyCapHint")}>
            <NumberStepper
              value={draft.dailyCap}
              onValueChange={(n) => set("dailyCap", n ?? 0)}
              min={0}
              step={5}
            />
          </Field>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {t("reviewTitle")}
          </h2>
          <dl className="divide-border divide-y text-sm">
            <ReviewRow label={t("field.name")} value={draft.name || "—"} />
            <ReviewRow label={t("field.email")} value={draft.email || "—"} />
            <ReviewRow label={t("field.role")} value={t(`role.${draft.role}`)} />
            <ReviewRow
              label={t("field.status")}
              value={t(`status.${draft.status}`)}
            />
            <ReviewRow
              label={t("field.dailyCap")}
              value={String(draft.dailyCap)}
            />
          </dl>
        </div>
      )}
    </WizardShell>
  );
}

function EmployeePreview({
  draft,
  id,
  t,
}: {
  draft: EmployeeDraft;
  id?: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const avatar = draft.initials || draft.name.slice(0, 2).toUpperCase() || "—";
  return (
    <div className="space-y-3">
      <div className="bg-card border-border rounded-2xl border p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full font-bold">
            {avatar}
          </div>
          <div className="min-w-0">
            <div className="font-display truncate font-semibold tracking-tight">
              {draft.name || t("namePlaceholder")}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">{t(`role.${draft.role}`)}</Badge>
              <Badge
                variant={draft.status === "active" ? "default" : "outline"}
              >
                {t(`status.${draft.status}`)}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border-border rounded-2xl border p-4 shadow-sm">
          <div className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
            {t("detail.stampsGiven")}
          </div>
          <div className="font-display mt-0.5 text-lg font-semibold tracking-tight">
            {draft.stamps.toLocaleString()}
          </div>
        </div>
        <div className="bg-card border-border rounded-2xl border p-4 shadow-sm">
          <div className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
            {t("detail.redemptions")}
          </div>
          <div className="font-display mt-0.5 text-lg font-semibold tracking-tight">
            {draft.redemptions.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="bg-card border-border rounded-2xl border p-4 shadow-sm">
        <div className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
          {t("detail.activityChart")}
        </div>
        <div className="mt-2 h-24">
          <Bars series={getActivitySeries(id ?? "new")} />
        </div>
      </div>

      <Button
        variant="outline"
        className="h-10 w-full rounded-xl"
        onClick={() =>
          toast.success(t("detail.impersonating", { name: draft.name }))
        }
      >
        {t("detail.impersonate")}
      </Button>
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
        {hint ? (
          <span className="text-muted-foreground/70 text-xs font-semibold">
            {hint}
          </span>
        ) : null}
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
