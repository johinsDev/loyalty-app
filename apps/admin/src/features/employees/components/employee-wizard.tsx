"use client";

import {
  Badge,
  Checkbox,
  Input,
  InputPhone,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import { ASSIGNABLE_ROLES, initialsFor } from "../lib";

const STEPS = ["profile", "access", "review"] as const;
type Step = (typeof STEPS)[number];
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

type Draft = {
  name: string;
  email: string;
  phone: string;
  role: AssignableRole;
  storeIds: string[];
  notes: string;
  rating: number | null;
};

const emptyDraft: Draft = {
  name: "",
  email: "",
  phone: "",
  role: "staff",
  storeIds: [],
  notes: "",
  rating: null,
};

/**
 * Employee create/edit wizard. Create = an invitation (email + role + stores);
 * edit = patch the member (name/phone/role/stores/notes/rating). The profile
 * fields other than email are edit-only (an invitee fills them after accepting).
 */
export function EmployeeWizard({ id }: { id?: string }) {
  const t = useTranslations("Employees");
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [stepIndex, setStepIndex] = useState(0);

  const { data: existing } = useQuery({
    ...trpc.employees.get.queryOptions({ memberId: id ?? "" }),
    enabled: isEdit,
  });
  const { data: storesData } = useQuery(
    trpc.stores.list.queryOptions({ page: 1, perPage: 100, sort: [] }),
  );
  const stores = storesData?.rows ?? [];

  useEffect(() => {
    if (!existing) return;
    setDraft({
      name: existing.name ?? "",
      email: existing.email ?? "",
      phone: existing.phone ?? "",
      role: (existing.role === "manager" ? "manager" : "staff") as AssignableRole,
      storeIds: existing.stores.map((s) => s.id),
      notes: existing.notes ?? "",
      rating: existing.rating ?? null,
    });
  }, [existing]);

  const invalidate = () => {
    void queryClient.invalidateQueries(trpc.employees.list.queryFilter());
    if (id) void queryClient.invalidateQueries(trpc.employees.get.queryFilter({ memberId: id }));
  };
  const invite = useMutation(trpc.employees.invite.mutationOptions());
  const update = useMutation(trpc.employees.update.mutationOptions());

  const step = STEPS[stepIndex]!;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));
  const completed = STEPS.slice(0, stepIndex);

  const submit = () => {
    if (isEdit) {
      update.mutate(
        {
          memberId: id!,
          name: draft.name,
          phone: draft.phone || null,
          role: draft.role,
          storeIds: draft.storeIds,
          notes: draft.notes || null,
          rating: draft.rating,
        },
        {
          onSuccess: () => {
            toast.success(t("save"));
            invalidate();
            router.push("/employees");
          },
          onError: () => toast.error(t("saveError")),
        },
      );
    } else {
      if (!draft.email.trim()) {
        toast.error(t("emailRequired"));
        return;
      }
      invite.mutate(
        { email: draft.email.trim(), role: draft.role, storeIds: draft.storeIds },
        {
          onSuccess: () => {
            toast.success(t("inviteSent"));
            invalidate();
            router.push("/employees");
          },
          onError: () => toast.error(t("inviteError")),
        },
      );
    }
  };

  const onNext = () => {
    if (stepIndex === STEPS.length - 1) {
      submit();
      return;
    }
    setStepIndex((n) => n + 1);
  };

  const toggleStore = (storeId: string) =>
    set(
      "storeIds",
      draft.storeIds.includes(storeId)
        ? draft.storeIds.filter((s) => s !== storeId)
        : [...draft.storeIds, storeId],
    );

  return (
    <WizardShell
      title={isEdit ? t("editTitle") : t("newTitle")}
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
      finishLabel={isEdit ? t("save") : t("invite")}
      preview={<Preview draft={draft} stores={stores} t={t} />}
    >
      {step === "profile" ? (
        <div className="space-y-4">
          {isEdit ? (
            <>
              <Field label={t("field.name")}>
                <Input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className="h-10"
                  autoFocus
                />
              </Field>
              <Field label={t("field.phone")}>
                <InputPhone size="sm" value={draft.phone} onChange={(v) => set("phone", v.e164)} />
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
            </>
          ) : (
            <Field label={t("field.email")} hint={t("inviteEmailHint")}>
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder={t("emailPlaceholder")}
                className="h-10"
                autoFocus
              />
            </Field>
          )}
        </div>
      ) : step === "access" ? (
        <div className="space-y-5">
          <Field label={t("field.role")}>
            <Select value={draft.role} onValueChange={(v) => set("role", (v ?? "staff") as AssignableRole)}>
              <SelectTrigger size="lg" className="w-full text-sm">
                <SelectValue>{(v) => t(`role.${v as string}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(`role.${role}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t("field.stores")}>
            <div className="border-border divide-border divide-y rounded-xl border">
              {stores.length === 0 ? (
                <p className="text-muted-foreground p-3 text-sm">{t("noStores")}</p>
              ) : (
                stores.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                    <Checkbox
                      checked={draft.storeIds.includes(s.id)}
                      onCheckedChange={() => toggleStore(s.id)}
                    />
                    <span className="font-medium">{s.name}</span>
                  </label>
                ))
              )}
            </div>
          </Field>

          {isEdit ? (
            <Field label={t("field.rating")}>
              <StarPicker value={draft.rating} onChange={(r) => set("rating", r)} />
            </Field>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">{t("reviewTitle")}</h2>
          <dl className="divide-border divide-y text-sm">
            {isEdit ? (
              <ReviewRow label={t("field.name")} value={draft.name || "—"} />
            ) : (
              <ReviewRow label={t("field.email")} value={draft.email || "—"} />
            )}
            <ReviewRow label={t("field.role")} value={t(`role.${draft.role}`)} />
            <ReviewRow
              label={t("field.stores")}
              value={
                draft.storeIds.length === 0
                  ? "—"
                  : stores
                      .filter((s) => draft.storeIds.includes(s.id))
                      .map((s) => s.name)
                      .join(", ")
              }
            />
            {isEdit ? (
              <ReviewRow label={t("field.rating")} value={draft.rating ? `${draft.rating}★` : "—"} />
            ) : null}
          </dl>
        </div>
      )}
    </WizardShell>
  );
}

function Preview({
  draft,
  stores,
  t,
}: {
  draft: Draft;
  stores: { id: string; name: string }[];
  t: ReturnType<typeof useTranslations>;
}) {
  const label = draft.name || draft.email || t("namePlaceholder");
  return (
    <div className="bg-card border-border rounded-2xl border p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full font-bold">
          {initialsFor({ name: draft.name || null, email: draft.email || null })}
        </div>
        <div className="min-w-0">
          <div className="font-display truncate font-semibold tracking-tight">{label}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{t(`role.${draft.role}`)}</Badge>
          </div>
        </div>
      </div>
      {draft.storeIds.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {stores
            .filter((s) => draft.storeIds.includes(s.id))
            .map((s) => (
              <Badge key={s.id} variant="outline">
                {s.name}
              </Badge>
            ))}
        </div>
      ) : null}
    </div>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`${n}`}
        >
          <Star
            className={
              value && n <= value
                ? "size-6 fill-amber-400 text-amber-400"
                : "text-muted-foreground/40 size-6"
            }
          />
        </button>
      ))}
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
          <span className="text-muted-foreground/70 text-xs font-semibold">{hint}</span>
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
