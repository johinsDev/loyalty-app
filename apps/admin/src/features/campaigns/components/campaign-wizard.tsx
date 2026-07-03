"use client";

import { formatDate } from "@loyalty/date";
import {
  Button,
  DatePicker,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  Switch,
  Textarea,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { useRouter } from "@/i18n/navigation";
import { useNavigationGuard } from "@/lib/use-unsaved-guard";
import { useTRPC } from "@/lib/trpc/client";

import {
  TIERS,
  buildAudienceFilter,
  type Tier,
} from "../lib/campaign-audience";
import {
  CHANNELS,
  EMPTY_MESSAGE,
  buildMessageInput,
  isChannelComplete,
  isMessageComplete,
  toFormMessage,
  type Channel,
} from "../lib/campaign-message";
import { CampaignAudienceFields, ReachBox } from "./campaign-audience-fields";
import { CampaignMessageFields } from "./campaign-message-fields";
import { CampaignMessagePreview, type PreviewMessage } from "./campaign-message-preview";
import { ErrorText, Field } from "./campaign-field";

const STEPS = ["definition", "message", "audience", "schedule"] as const;
type Step = (typeof STEPS)[number];

type Form = {
  name: string;
  objective: string;
  message: PreviewMessage;
  linkUrl: string;
  channelPriority: Channel[];
  tiers: Tier[];
  lastPurchaseOp: "gte" | "lte";
  lastPurchaseDays: string;
  minPurchases: string;
  signedUpAfter: Date | null;
  signedUpBefore: Date | null;
  mode: "once" | "evergreen" | "drip";
  scheduledAt: Date | null;
  special: boolean;
  cooldownDays: string;
  endsAt: Date | null;
  dripIntervalDays: string;
  dripMaxAttempts: string;
};

const EMPTY: Form = {
  name: "",
  objective: "",
  message: EMPTY_MESSAGE,
  linkUrl: "",
  channelPriority: [],
  tiers: [],
  lastPurchaseOp: "gte",
  lastPurchaseDays: "",
  minPurchases: "",
  signedUpAfter: null,
  signedUpBefore: null,
  mode: "once",
  scheduledAt: null,
  special: false,
  cooldownDays: "30",
  endsAt: null,
  dripIntervalDays: "3",
  dripMaxAttempts: "3",
};

/**
 * Server-driven campaign wizard (definition → message → channels → audience →
 * schedule). On "new" it creates a draft immediately; each Next persists the
 * step via `advance`, and Finish publishes (enqueues the send).
 */
export function CampaignWizard({ id }: { id?: string }) {
  const t = useTranslations("Campaigns");
  const locale = useLocale();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // A new campaign's draft id is mirrored into `?draft=` so reloading mid-wizard
  // resumes the same draft instead of starting over (and spawning another one).
  const [draftId, setDraftId] = useQueryState("draft", parseAsString);
  const loadId = id ?? draftId ?? undefined;
  const [campaignId, setCampaignId] = useState<string | undefined>(loadId);
  // If the draft id only arrives from the URL after mount (hydration), adopt it
  // so persist/publish target the resumed draft instead of creating a new one.
  useEffect(() => {
    if (loadId && !campaignId) setCampaignId(loadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadId]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [stepIndex, setStepIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const seeded = useRef(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  // Guard every attempt to navigate away with unsaved edits (links + tab close).
  const bypass = useNavigationGuard(dirty, (href) => {
    setPendingHref(href);
    setExitOpen(true);
  });
  const confirmLeave = () => {
    bypass.current = true;
    setDirty(false);
    setExitOpen(false);
    if (pendingHref && pendingHref !== "__back__") window.location.href = pendingHref;
    else router.push("/campaigns");
  };
  const tryExit = () => {
    if (dirty) {
      setPendingHref(null);
      setExitOpen(true);
    } else {
      router.push("/campaigns");
    }
  };

  // New campaign → the draft is created LAZILY on the first save (not on mount),
  // so opening — or reloading — the wizard never spawns empty drafts.
  const createMut = useMutation(trpc.campaigns.create.mutationOptions());
  async function ensureDraft(): Promise<string | null> {
    if (campaignId) return campaignId;
    try {
      const res = await createMut.mutateAsync();
      setCampaignId(res.campaign.id);
      seeded.current = true;
      // Mirror into the URL so a mid-wizard reload resumes this same draft.
      void setDraftId(res.campaign.id);
      return res.campaign.id;
    } catch {
      toast.error(t("createError"));
      return null;
    }
  }

  // Edit campaign → load + seed once.
  const stateQuery = useQuery({
    ...trpc.campaigns.getState.queryOptions({ id: loadId ?? "" }),
    enabled: Boolean(loadId),
  });
  useEffect(() => {
    if (loadId && stateQuery.data && !seeded.current) {
      const c = stateQuery.data.campaign;
      const msg = toFormMessage(c.message);
      setForm({
        name: c.name ?? "",
        objective: c.objective ?? "",
        message: msg,
        linkUrl: c.linkUrl ?? "",
        channelPriority: (c.channelPriority ?? []).filter((x): x is Channel =>
          (CHANNELS as readonly string[]).includes(x),
        ),
        tiers: (c.audienceFilter?.tiers ?? []).filter((x): x is Tier =>
          (TIERS as readonly string[]).includes(x),
        ),
        lastPurchaseOp: c.audienceFilter?.lastPurchase?.op ?? "gte",
        lastPurchaseDays: c.audienceFilter?.lastPurchase
          ? String(c.audienceFilter.lastPurchase.days)
          : "",
        minPurchases: c.audienceFilter?.minPurchases ? String(c.audienceFilter.minPurchases) : "",
        signedUpAfter: c.audienceFilter?.signedUpAfter
          ? new Date(c.audienceFilter.signedUpAfter)
          : null,
        signedUpBefore: c.audienceFilter?.signedUpBefore
          ? new Date(c.audienceFilter.signedUpBefore)
          : null,
        mode:
          c.mode === "evergreen" ? "evergreen" : c.mode === "drip" ? "drip" : "once",
        scheduledAt: c.scheduledAt ?? null,
        special: c.special,
        cooldownDays: c.cooldownDays != null ? String(c.cooldownDays) : "30",
        endsAt: c.endsAt ?? null,
        dripIntervalDays: c.dripIntervalDays != null ? String(c.dripIntervalDays) : "3",
        dripMaxAttempts: c.dripMaxAttempts != null ? String(c.dripMaxAttempts) : "3",
      });
      seeded.current = true;
      // Resume at the first step still missing data (or the review step if all
      // done), instead of always restarting at Definición.
      const nameOk = !!c.name;
      const msgOk =
        CHANNELS.some((ch) => isChannelComplete(msg, ch)) &&
        (c.channelPriority?.length ?? 0) > 0;
      setStepIndex(!nameOk ? 0 : !msgOk ? 1 : STEPS.length - 1);
    }
  }, [loadId, stateQuery.data]);

  const advanceMut = useMutation(trpc.campaigns.advance.mutationOptions());
  const publishMut = useMutation(trpc.campaigns.publish.mutationOptions());

  const step = STEPS[stepIndex]!;
  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));

  const valid: Record<Step, boolean> = {
    definition: form.name.trim().length > 0,
    message: isMessageComplete({
      message: form.message,
      channelPriority: form.channelPriority,
      linkUrl: form.linkUrl,
    }),
    audience: true,
    schedule: true,
  };
  const navigable: string[] = [];
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS.slice(0, i).every((s) => valid[s])) navigable.push(STEPS[i]!);
  }
  const completed = STEPS.slice(0, stepIndex).filter((s) => valid[s]);

  // Live reach for the schedule step (debounced; audience − opt-outs). The
  // audience step renders its own reach inside CampaignAudienceFields.
  const audienceFilter = buildAudienceFilter(form);
  const reachInput = useMemo(
    () => ({
      audienceFilter,
      channelPriority: form.channelPriority.length > 0 ? form.channelPriority : undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(audienceFilter), form.channelPriority.join(",")],
  );
  const debouncedReach = useDebounce(reachInput, { wait: 400 });
  const reach = useQuery({
    ...trpc.campaigns.countReach.queryOptions(debouncedReach),
    enabled: step === "schedule",
  });

  // Persists the current step, creating the draft first if it doesn't exist yet.
  // Returns the campaign id on success (needed for publish), null on failure.
  async function persistStep(): Promise<string | null> {
    const cid = await ensureDraft();
    if (!cid) return null;
    try {
      if (step === "definition") {
        await advanceMut.mutateAsync({
          id: cid,
          step: "definition",
          input: {
            name: form.name,
            objective: form.objective || undefined,
          },
        });
      } else if (step === "message") {
        await advanceMut.mutateAsync({
          id: cid,
          step: "message",
          input: {
            ...buildMessageInput(form.message),
            channelPriority: form.channelPriority,
            linkUrl: form.linkUrl || undefined,
          },
        });
      } else if (step === "audience") {
        await advanceMut.mutateAsync({
          id: cid,
          step: "audience",
          input: buildAudienceFilter(form) ?? {},
        });
      } else if (step === "schedule") {
        const evergreen = form.mode === "evergreen";
        const drip = form.mode === "drip";
        await advanceMut.mutateAsync({
          id: cid,
          step: "schedule",
          input: {
            mode: form.mode,
            scheduledAt: evergreen || drip ? undefined : (form.scheduledAt ?? undefined),
            special: form.special,
            cooldownDays: evergreen ? Number(form.cooldownDays) || 30 : undefined,
            endsAt: evergreen ? (form.endsAt ?? undefined) : undefined,
            dripIntervalDays: drip ? Number(form.dripIntervalDays) || 3 : undefined,
            dripMaxAttempts: drip ? Number(form.dripMaxAttempts) || 3 : undefined,
          },
        });
      }
      return cid;
    } catch {
      toast.error(t("saveError"));
      return null;
    }
  }

  async function goTo(targetIndex: number) {
    if (targetIndex === stepIndex) return;
    setAttempted(false);
    if (valid[step] && !(await persistStep())) return;
    setStepIndex(targetIndex);
  }

  async function onNext() {
    if (step !== "schedule" && !valid[step]) {
      setAttempted(true);
      return;
    }
    if (step === "schedule") {
      const cid = await persistStep();
      if (!cid) return;
      try {
        await publishMut.mutateAsync({ id: cid });
        bypass.current = true;
        setDirty(false);
        await queryClient.invalidateQueries(trpc.campaigns.adminList.queryFilter());
        toast.success(id ? t("updated", { name: form.name }) : t("created", { name: form.name }));
        router.push("/campaigns");
      } catch {
        toast.error(t("publishError"));
      }
      return;
    }
    if (await persistStep()) {
      setAttempted(false);
      setStepIndex((n) => n + 1);
    }
  }

  const saving = createMut.isPending || advanceMut.isPending || publishMut.isPending;

  return (
    <>
      <WizardShell
        title={id ? t("editTitle") : t("newTitle")}
        steps={steps}
        current={step}
        completed={completed}
        navigable={navigable}
        onStepSelect={(key) => {
          if (!saving) void goTo(STEPS.indexOf(key as Step));
        }}
        onBack={() => goTo(Math.max(0, stepIndex - 1))}
        onNext={onNext}
        isFirst={stepIndex === 0}
        isLast={step === "schedule"}
        finishLabel={id ? t("saveChanges") : t("publish")}
        saving={saving}
        saved={Boolean(campaignId)}
        maxWidthClassName="max-w-7xl"
        onExit={tryExit}
        exitLabel={t("title")}
        preview={
          <CampaignMessagePreview message={form.message} channelPriority={form.channelPriority} />
        }
      >
        {step === "definition" ? (
          <div className="space-y-4">
            <Field label={t("fieldName")}>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("fieldNamePlaceholder")}
                className="h-10"
                aria-invalid={attempted && !form.name.trim() ? true : undefined}
                autoFocus
              />
              {attempted && !form.name.trim() ? <ErrorText>{t("nameRequired")}</ErrorText> : null}
            </Field>
            <Field label={t("fieldObjective")} hint={t("optional")}>
              <Textarea
                value={form.objective}
                onChange={(e) => set("objective", e.target.value)}
                placeholder={t("fieldObjectivePlaceholder")}
                rows={10}
                className="min-h-56"
              />
            </Field>
          </div>
        ) : step === "message" ? (
          <CampaignMessageFields
            value={{
              message: form.message,
              channelPriority: form.channelPriority,
              linkUrl: form.linkUrl,
            }}
            onChange={(next) => {
              setForm((f) => ({
                ...f,
                message: next.message,
                channelPriority: next.channelPriority,
                linkUrl: next.linkUrl,
              }));
              setDirty(true);
            }}
            showError={attempted}
          />
        ) : step === "audience" ? (
          <CampaignAudienceFields
            value={{
              tiers: form.tiers,
              lastPurchaseOp: form.lastPurchaseOp,
              lastPurchaseDays: form.lastPurchaseDays,
              minPurchases: form.minPurchases,
              signedUpAfter: form.signedUpAfter,
              signedUpBefore: form.signedUpBefore,
            }}
            onChange={(next) => {
              setForm((f) => ({ ...f, ...next }));
              setDirty(true);
            }}
            channelPriority={form.channelPriority}
          />
        ) : (
          <div className="space-y-5">
            <h2 className="font-display text-lg font-semibold tracking-tight">{t("reviewTitle")}</h2>
            <dl className="divide-border divide-y text-sm">
              <ReviewRow label={t("fieldName")} value={form.name || "—"} />
              <ReviewRow
                label={t("colChannels")}
                value={
                  form.channelPriority.length > 0
                    ? form.channelPriority.map((c) => t(`channel.${c}`)).join(" › ")
                    : "—"
                }
              />
              <ReviewRow label={t("audienceLabel")} value={audienceSummary(form, t)} />
            </dl>

            <ReachBox reachable={reach.data?.reachable} audience={reach.data?.audience} />

            <div className="grid grid-cols-3 gap-2">
              {(["once", "evergreen", "drip"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set("mode", m)}
                  className={`rounded-2xl border p-3.5 text-left transition-colors ${
                    form.mode === m
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <p className="text-sm font-semibold">{t(`mode.${m}`)}</p>
                  <p className="text-muted-foreground text-xs">{t(`modeHint.${m}`)}</p>
                </button>
              ))}
            </div>

            {form.mode === "once" ? (
              <Field label={t("scheduleLabel")} hint={form.scheduledAt ? undefined : t("sendNow")}>
                <div className="flex max-w-xs items-center gap-2">
                  <DatePicker
                    value={form.scheduledAt ?? undefined}
                    onValueChange={(d) => set("scheduledAt", d ?? null)}
                    placeholder={t("sendNow")}
                    formatLabel={(d) => formatDate(d, { locale })}
                    className="flex-1"
                  />
                  {form.scheduledAt ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="size-9 shrink-0 rounded-lg p-0"
                      aria-label={t("sendNow")}
                      onClick={() => set("scheduledAt", null)}
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </Field>
            ) : form.mode === "evergreen" ? (
              <>
                <Field label={t("cooldownLabel")} hint={t("cooldownHint")}>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={form.cooldownDays}
                      onChange={(e) => set("cooldownDays", e.target.value)}
                      className="h-10 w-24"
                    />
                    <span className="text-muted-foreground text-sm">{t("cooldownUnit")}</span>
                  </div>
                </Field>
                <Field label={t("endsAtLabel")} hint={form.endsAt ? undefined : t("noEndDate")}>
                  <div className="flex max-w-xs items-center gap-2">
                    <DatePicker
                      value={form.endsAt ?? undefined}
                      onValueChange={(d) => set("endsAt", d ?? null)}
                      placeholder={t("noEndDate")}
                      formatLabel={(d) => formatDate(d, { locale })}
                      className="flex-1"
                    />
                    {form.endsAt ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="size-9 shrink-0 rounded-lg p-0"
                        aria-label={t("noEndDate")}
                        onClick={() => set("endsAt", null)}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </Field>
              </>
            ) : (
              <>
                <Field label={t("dripIntervalLabel")} hint={t("dripIntervalHint")}>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={form.dripIntervalDays}
                      onChange={(e) => set("dripIntervalDays", e.target.value)}
                      className="h-10 w-24"
                    />
                    <span className="text-muted-foreground text-sm">{t("cooldownUnit")}</span>
                  </div>
                </Field>
                <Field label={t("dripAttemptsLabel")} hint={t("dripAttemptsHint")}>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={2}
                      max={10}
                      value={form.dripMaxAttempts}
                      onChange={(e) => set("dripMaxAttempts", e.target.value)}
                      className="h-10 w-24"
                    />
                    <span className="text-muted-foreground text-sm">{t("dripAttemptsUnit")}</span>
                  </div>
                </Field>
              </>
            )}

            <label className="border-border flex items-start justify-between gap-3 rounded-2xl border p-4">
              <div>
                <p className="text-sm font-semibold">{t("specialLabel")}</p>
                <p className="text-muted-foreground text-xs">{t("specialHint")}</p>
              </div>
              <Switch checked={form.special} onCheckedChange={(v) => set("special", v)} />
            </label>
          </div>
        )}
      </WizardShell>

      <ResponsiveModal open={exitOpen} onOpenChange={setExitOpen}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("unsavedTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground px-4 pb-2 text-sm">{t("unsavedHint")}</p>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setExitOpen(false)}
            >
              {t("stay")}
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full px-6 font-semibold"
              onClick={confirmLeave}
            >
              {t("leave")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

function audienceSummary(form: Form, t: ReturnType<typeof useTranslations>): string {
  const parts: string[] = [];
  if (form.tiers.length > 0) parts.push(`${t("audienceTiers")}: ${form.tiers.join(", ")}`);
  if (form.lastPurchaseDays.trim()) {
    const op = form.lastPurchaseOp === "gte" ? "≥" : "≤";
    parts.push(`${t("audienceLastPurchase")} ${op} ${form.lastPurchaseDays}d`);
  }
  if (form.minPurchases.trim()) parts.push(`${t("audienceMinPurchases")}: ${form.minPurchases}`);
  return parts.length > 0 ? parts.join(" · ") : t("audienceEveryone");
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground font-semibold">{label}</dt>
      <dd className="truncate text-right font-bold">{value}</dd>
    </div>
  );
}
