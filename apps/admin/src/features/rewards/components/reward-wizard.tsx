"use client";

import type { MessageContentInput } from "@loyalty/api/features/campaigns/schemas";
import { rewardBenefitSummary } from "@loyalty/api/features/rewards/format";
import {
  rewardBenefitConfigSchema,
  type RewardBenefitConfigInput,
  type RewardType,
} from "@loyalty/api/features/rewards/schemas";
import {
  BackgroundPicker,
  Button,
  IconGlyph,
  IconPicker,
  Input,
  Label,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  RichTextEditor,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins as CoinsIcon, Sparkles, Stamp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import {
  AnnounceComposer,
  type AnnounceValue,
} from "@/features/campaigns/components/announce-composer";
import { buildAudienceFilter } from "@/features/campaigns/lib/campaign-audience";
import {
  buildMessageInput,
  isMessageComplete,
  type Channel,
} from "@/features/campaigns/lib/campaign-message";
import { FileUpload } from "@/features/storage/components/file-upload";
import { StoreAvailabilityField } from "@/features/stores/components/store-availability-field";
import { useUploadImage } from "@/features/storage/hooks/use-upload-image";
import { useRouter } from "@/i18n/nav";
import { useStoreScope } from "@/lib/store-scope";
import { useNavigationGuard } from "@/lib/use-unsaved-guard";
import { useTRPC } from "@/lib/trpc/client";

import { rewardAnnounceInitial, rewardLinkUrl } from "../lib/reward-announce";
import { RewardBenefitFields, defaultConfigFor } from "./benefit-forms";
import { CostStepFields, type CostForm, type TierKey } from "./cost-step";

const STEPS = ["essence", "benefit", "cost", "design", "broadcast", "review"] as const;
type Step = (typeof STEPS)[number];

const TYPES: RewardType[] = ["freeProduct", "amountOff", "percentOff", "experience"];
const REWARD_EMOJIS = ["🎁", "🧋", "🍮", "⬆️", "✨", "⚡", "🎂", "⭐"];

type Form = {
  name: string;
  type: RewardType;
  config: RewardBenefitConfigInput;
  // cost & eligibility
  stampsRequired?: number;
  pointsCost?: number;
  costMode: "or" | "and";
  allowedTiers: TierKey[];
  limitPerCustomer: "unlimited" | "once";
  sections: string[];
  sortOrder: number;
  // stores this reward is available at (null = every store)
  storeIds: string[] | null;
  // design
  backgroundCss: string;
  imageUrl: string | null;
  icon: string;
  description: string;
  fulfillmentNote: string;
};

const EMPTY: Form = {
  name: "",
  type: "freeProduct",
  config: defaultConfigFor("freeProduct"),
  costMode: "or",
  allowedTiers: [],
  limitPerCustomer: "unlimited",
  sections: [],
  sortOrder: 0,
  storeIds: null,
  backgroundCss: "linear-gradient(135deg, #1BAD9D, #0e6f64)",
  imageUrl: null,
  icon: "🎁",
  description: "",
  fulfillmentNote: "",
};

/**
 * Server-driven reward wizard (essence → benefit → cost → design → broadcast →
 * review). The draft already exists (the gallery creates it); each Next persists
 * via `advance`, Finish publishes and — when the broadcast toggle is on — fires
 * `campaigns.createFromEntity` (scope "reward") best-effort. Broadcast is
 * intentionally a client-only step.
 */
export function RewardWizard({ id }: { id: string }) {
  const t = useTranslations("Rewards");
  const tc = useTranslations("Campaigns.announce");
  const locale = useLocale();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const uploadImage = useUploadImage();
  const { storeId: scopeStoreId } = useStoreScope();

  const [form, setForm] = useState<Form>(EMPTY);
  const [announce, setAnnounce] = useState<AnnounceValue | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const seeded = useRef(false);
  const finishing = useRef(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const bypass = useNavigationGuard(dirty, (href) => {
    setPendingHref(href);
    setExitOpen(true);
  });
  const confirmLeave = () => {
    bypass.current = true;
    setDirty(false);
    setExitOpen(false);
    if (pendingHref && pendingHref !== "__back__") window.location.href = pendingHref;
    else router.push("/rewards");
  };
  const tryExit = () => {
    if (dirty) {
      setPendingHref(null);
      setExitOpen(true);
    } else {
      router.push("/rewards");
    }
  };

  const stateQuery = useQuery(trpc.rewards.getState.queryOptions({ id }));
  const reward = stateQuery.data?.reward;

  // Seed once from the draft, then resume at the server-derived current step.
  useEffect(() => {
    if (!stateQuery.data || seeded.current) return;
    const r = stateQuery.data.reward;
    const type = (TYPES as string[]).includes(r.type ?? "") ? (r.type as RewardType) : "freeProduct";
    const config = r.benefit ?? defaultConfigFor(type);
    setForm({
      ...EMPTY,
      name: r.name && r.name !== "Borrador" ? r.name : "",
      type,
      config,
      stampsRequired: r.stampsRequired ?? undefined,
      pointsCost: r.pointsCost ?? undefined,
      costMode: (r.costMode as "or" | "and") ?? "or",
      allowedTiers: (r.allowedTiers as TierKey[] | null) ?? [],
      limitPerCustomer: (r.limitPerCustomer as "unlimited" | "once") ?? "unlimited",
      sections: r.sections ?? [],
      sortOrder: r.sortOrder ?? 0,
      // On edit, seed from the saved value; on a fresh draft (cost step never
      // persisted) default to the store the admin is currently scoped to.
      storeIds:
        r.storeIds ??
        (r.stampsRequired == null && r.pointsCost == null && scopeStoreId
          ? [scopeStoreId]
          : null),
      backgroundCss: r.backgroundCss ?? EMPTY.backgroundCss,
      imageUrl: r.imageUrl,
      icon: r.icon ?? "",
      description: r.description ?? "",
      fulfillmentNote: r.fulfillmentNote ?? "",
    });
    seeded.current = true;
    const current = stateQuery.data.state.current;
    const idx = (STEPS as readonly string[]).indexOf(current);
    setStepIndex(current === "review" ? STEPS.indexOf("review") : idx >= 0 ? idx : 0);
  }, [stateQuery.data, scopeStoreId]);

  const advanceMut = useMutation(trpc.rewards.advance.mutationOptions());
  const publishMut = useMutation(trpc.rewards.publish.mutationOptions());
  const createFromEntityMut = useMutation(trpc.campaigns.createFromEntity.mutationOptions());

  const priorCampaignsQuery = useQuery(
    trpc.campaigns.campaignsBySource.queryOptions({ scope: "reward", id }),
  );

  const step = STEPS[stepIndex]!;
  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));

  // Seed the announcement the first time the admin reaches Difusión.
  useEffect(() => {
    if (step === "broadcast" && announce === null && reward) {
      setAnnounce(
        rewardAnnounceInitial({
          name: form.name || (reward.name ?? ""),
          description: form.description,
          benefitSummary: liveSummary(),
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, announce, reward]);

  const configValid = rewardBenefitConfigSchema.safeParse(form.config).success;
  const costValid = form.stampsRequired != null || form.pointsCost != null;
  const designValid =
    form.backgroundCss.trim().length > 0 &&
    (form.type !== "experience" || form.fulfillmentNote.trim().length > 0);
  const valid: Record<Step, boolean> = {
    essence: form.name.trim().length > 0,
    benefit: configValid,
    cost: costValid,
    design: designValid,
    broadcast: announce === null || !announce.enabled || isMessageComplete(announce.message),
    review: true,
  };
  const navigable: string[] = [];
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS.slice(0, i).every((s) => valid[s])) navigable.push(STEPS[i]!);
  }
  const completed = STEPS.slice(0, stepIndex).filter((s) => valid[s]);

  function liveSummary(): string | null {
    if (!configValid) return null;
    return rewardBenefitSummary(form.config, locale === "en" ? "en" : "es");
  }

  async function persistStep(): Promise<boolean> {
    try {
      if (step === "essence") {
        const res = await advanceMut.mutateAsync({
          id,
          step: "essence",
          input: { name: form.name, type: form.type },
        });
        // A type change resets the benefit server-side; mirror it locally.
        if (res.reward.benefit === null && form.config.type !== form.type) {
          setForm((f) => ({ ...f, config: defaultConfigFor(f.type) }));
        }
      } else if (step === "benefit") {
        await advanceMut.mutateAsync({ id, step: "benefit", input: form.config });
      } else if (step === "cost") {
        await advanceMut.mutateAsync({
          id,
          step: "cost",
          input: {
            stampsRequired: form.stampsRequired ?? null,
            pointsCost: form.pointsCost ?? null,
            costMode: form.costMode,
            allowedTiers: form.allowedTiers.length > 0 ? form.allowedTiers : null,
            limitPerCustomer: form.limitPerCustomer,
            sections: form.sections,
            sortOrder: form.sortOrder,
            storeIds: form.storeIds,
          },
        });
      } else if (step === "design") {
        await advanceMut.mutateAsync({
          id,
          step: "design",
          input: {
            backgroundCss: form.backgroundCss,
            imageUrl: form.imageUrl ?? "",
            icon: form.icon || null,
            description: form.description || null,
            fulfillmentNote: form.fulfillmentNote || null,
          },
        });
      }
      await queryClient.invalidateQueries(trpc.rewards.getState.queryFilter({ id }));
      return true;
    } catch {
      toast.error(t("saveError"));
      return false;
    }
  }

  async function goTo(targetIndex: number) {
    if (targetIndex === stepIndex) return;
    setAttempted(false);
    const isServerStep = stepIndex < 4;
    if (isServerStep && valid[step] && !(await persistStep())) return;
    setStepIndex(targetIndex);
  }

  async function onNext() {
    if (!valid[step]) {
      setAttempted(true);
      return;
    }
    if (step === "review") {
      if (finishing.current) return;
      finishing.current = true;
      try {
        await publishMut.mutateAsync({ id });
      } catch {
        toast.error(t("publishError"));
        finishing.current = false;
        return;
      }
      bypass.current = true;
      setDirty(false);
      await queryClient.invalidateQueries(trpc.rewards.adminList.queryFilter());
      let announced = false;
      if (announce?.enabled) {
        announced = true;
        const channelPriority: Channel[] = announce.message.channelPriority.length
          ? announce.message.channelPriority
          : ["push"];
        try {
          await createFromEntityMut.mutateAsync({
            source: { scope: "reward", id },
            name: form.name,
            message: {
              ...(buildMessageInput(announce.message.message) as MessageContentInput),
              linkUrl: rewardLinkUrl(),
            },
            channelPriority,
            audienceFilter: buildAudienceFilter(announce.audience),
            scheduledAt: announce.scheduledAt,
          });
          toast.success(tc("launched"));
        } catch {
          toast.error(tc("failed"));
        }
      }
      if (!announced) toast.success(t("created", { name: form.name }));
      router.push("/rewards");
      return;
    }
    const isServerStep = stepIndex < 4;
    if (!isServerStep || (await persistStep())) {
      setAttempted(false);
      setStepIndex((n) => n + 1);
    }
  }

  const saving = advanceMut.isPending || publishMut.isPending || createFromEntityMut.isPending;
  const summary = liveSummary();

  const costForm: CostForm = {
    stampsRequired: form.stampsRequired,
    pointsCost: form.pointsCost,
    costMode: form.costMode,
    allowedTiers: form.allowedTiers,
    limitPerCustomer: form.limitPerCustomer,
    sections: form.sections,
    sortOrder: form.sortOrder,
  };

  return (
    <>
      <WizardShell
        title={t("newTitle")}
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
        isLast={step === "review"}
        finishLabel={t("publish")}
        saving={saving}
        onExit={tryExit}
        exitLabel={t("title")}
        preview={
          <RewardPreview
            name={form.name}
            icon={form.icon}
            description={form.description || summary || ""}
            backgroundCss={form.backgroundCss}
            imageUrl={form.imageUrl}
            stampsRequired={form.stampsRequired}
            pointsCost={form.pointsCost}
            costMode={form.costMode}
          />
        }
      >
        {!seeded.current ? (
          <p className="text-muted-foreground text-sm">…</p>
        ) : step === "essence" ? (
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
            </Field>
            <Field label={t("fieldType")} hint={t("typeHint")}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TYPES.map((ty) => (
                  <button
                    key={ty}
                    type="button"
                    onClick={() => {
                      set("type", ty);
                      if (form.config.type !== ty) set("config", defaultConfigFor(ty));
                    }}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      form.type === ty
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <p className="text-sm font-semibold">{t(`types.${ty}`)}</p>
                    <p className="text-muted-foreground text-xs">{t(`typeHints.${ty}`)}</p>
                  </button>
                ))}
              </div>
            </Field>
          </div>
        ) : step === "benefit" ? (
          <div className="space-y-4">
            <RewardBenefitFields value={form.config} onChange={(config) => set("config", config)} />
            {summary ? (
              <div className="border-primary/20 bg-primary/5 flex items-center gap-2.5 rounded-2xl border px-4 py-3">
                <Sparkles className="text-primary size-4 shrink-0" />
                <div>
                  <p className="text-primary/70 text-[10px] font-extrabold tracking-wider uppercase">
                    {t("summaryLabel")}
                  </p>
                  <p className="text-sm font-semibold">{summary}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : step === "cost" ? (
          <div className="space-y-4">
            <CostStepFields value={costForm} onChange={(next) => setForm((f) => ({ ...f, ...next }))} />
            <StoreAvailabilityField
              value={form.storeIds}
              onChange={(storeIds) => set("storeIds", storeIds)}
            />
          </div>
        ) : step === "design" ? (
          <div className="space-y-4">
            <Field label={t("fieldBg")}>
              <BackgroundPicker
                value={form.backgroundCss}
                onValueChange={(bg) => set("backgroundCss", bg)}
                onUploadImage={uploadImage}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("fieldIcon")}>
                <IconPicker
                  value={form.icon}
                  onValueChange={(e) => set("icon", e)}
                  emojis={REWARD_EMOJIS}
                  customLabel={t("iconCustom")}
                  uploadLabel={t("imgUpload")}
                  removeLabel={t("imgRemove")}
                />
              </Field>
              <Field label={t("fieldMainImage")} hint={t("optional")}>
                <FileUpload
                  value={form.imageUrl ? [form.imageUrl] : []}
                  onChange={(urls) => set("imageUrl", urls[urls.length - 1] ?? null)}
                  accept={{ "image/*": [] }}
                  multiple={false}
                />
              </Field>
            </div>
            <Field label={t("fieldDescription")} hint={t("optional")}>
              <RichTextEditor
                value={form.description}
                onValueChange={(html) => set("description", html)}
              />
            </Field>
            {form.type === "experience" ? (
              <Field label={t("fieldFulfillment")} hint={t("fulfillmentHint")}>
                <Input
                  value={form.fulfillmentNote}
                  onChange={(e) => set("fulfillmentNote", e.target.value)}
                  placeholder={t("fulfillmentPlaceholder")}
                  className="h-10"
                  aria-invalid={
                    attempted && !form.fulfillmentNote.trim() ? true : undefined
                  }
                />
              </Field>
            ) : null}
          </div>
        ) : step === "broadcast" ? (
          announce ? (
            <AnnounceComposer
              value={announce}
              onChange={(v) => {
                setAnnounce(v);
                setDirty(true);
              }}
              priorCampaigns={priorCampaignsQuery.data ?? []}
              showError={attempted}
            />
          ) : (
            <p className="text-muted-foreground text-sm">…</p>
          )
        ) : (
          <div className="space-y-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">{t("reviewTitle")}</h2>
            <dl className="divide-border divide-y text-sm">
              <ReviewRow label={t("fieldName")} value={form.name || "—"} />
              <ReviewRow label={t("fieldType")} value={t(`types.${form.type}`)} />
              <ReviewRow label={t("reviewBenefit")} value={summary ?? "—"} />
              <ReviewRow label={t("reviewCost")} value={costSummary(form, t)} />
              <ReviewRow
                label={t("cost.limit")}
                value={t(`cost.limit${form.limitPerCustomer === "once" ? "Once" : "Unlimited"}`)}
              />
              <ReviewRow label={t("reviewBroadcast")} value={announce?.enabled ? t("yes") : t("no")} />
            </dl>
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
            <Button type="button" className="h-10 rounded-full px-6 font-semibold" onClick={confirmLeave}>
              {t("leave")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

/** Human cost line for review/preview from the raw form. */
function costSummary(
  form: { stampsRequired?: number; pointsCost?: number; costMode: "or" | "and" },
  t: ReturnType<typeof useTranslations>,
): string {
  const parts: string[] = [];
  if (form.stampsRequired != null) parts.push(t("cost.stamps", { n: form.stampsRequired }));
  if (form.pointsCost != null) parts.push(t("cost.points", { n: form.pointsCost }));
  if (parts.length === 0) return "—";
  return parts.join(form.costMode === "and" ? t("cost.and") : t("cost.or"));
}

/** Mirrors the customer reward card so the editor preview is faithful:
 *  gradient/cover card + icon + name + description + cost badge. */
export function RewardPreview({
  name,
  icon,
  description,
  backgroundCss,
  imageUrl,
  stampsRequired,
  pointsCost,
  costMode,
}: {
  name: string;
  icon: string;
  description: string;
  backgroundCss: string;
  imageUrl: string | null;
  stampsRequired?: number;
  pointsCost?: number;
  costMode: "or" | "and";
}) {
  const t = useTranslations("Rewards");
  return (
    <div
      className="preview-customer relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-black/10 ring-1 ring-black/5"
      style={{ background: backgroundCss }}
    >
      {imageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      ) : null}
      <div className="relative z-10">
        <div className="grid size-14 place-items-center overflow-hidden rounded-2xl bg-white/15 text-3xl">
          {icon ? <IconGlyph value={icon} /> : null}
        </div>
        <div className="font-display mt-3 text-lg font-semibold">{name || t("namePlaceholder")}</div>
        {description ? (
          <div
            className="prose prose-sm prose-invert mt-1 line-clamp-2 text-white/85"
            dangerouslySetInnerHTML={{ __html: description }}
          />
        ) : null}
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-extrabold">
          {stampsRequired != null ? (
            <span className="inline-flex items-center gap-1">
              <Stamp className="size-4" />
              {t("cost.stamps", { n: stampsRequired })}
            </span>
          ) : null}
          {stampsRequired != null && pointsCost != null ? (
            <span>{costMode === "and" ? t("cost.and") : t("cost.or")}</span>
          ) : null}
          {pointsCost != null ? (
            <span className="inline-flex items-center gap-1">
              <CoinsIcon className="size-4" />
              {t("cost.points", { n: pointsCost })}
            </span>
          ) : null}
          {stampsRequired == null && pointsCost == null ? t("cost.free") : null}
        </div>
      </div>
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
