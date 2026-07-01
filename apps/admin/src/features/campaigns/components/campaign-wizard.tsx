"use client";

import { formatDate } from "@loyalty/date";
import {
  Button,
  Checkbox,
  DatePicker,
  Input,
  Label,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  type EditorVariable,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import {
  Bell,
  GripVertical,
  Mail,
  MessageCircle,
  MessageSquare,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { WizardShell } from "@/components/wizard-shell";
import { useRouter } from "@/i18n/navigation";
import { useNavigationGuard } from "@/lib/use-unsaved-guard";
import { useTRPC } from "@/lib/trpc/client";

import { useUploadImage } from "@/features/storage/hooks/use-upload-image";

import { CAMPAIGN_PRESETS, type CampaignPreset } from "../presets";
import { CampaignEntityModal } from "./campaign-entity-modal";
import { CampaignMessagePreview, type PreviewMessage } from "./campaign-message-preview";

const STEPS = ["definition", "message", "channels", "audience", "schedule"] as const;
type Step = (typeof STEPS)[number];

const CHANNELS = ["push", "email", "sms", "whatsapp"] as const;
type Channel = (typeof CHANNELS)[number];

const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  push: Bell,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
};
const TIERS = ["hoja", "flor", "oro"] as const;
type Tier = (typeof TIERS)[number];
// Dynamic (per-recipient / per-org) variables. Entity variables (promo/product/
// reward with a picker) arrive in V3.
const CAMPAIGN_VARS = [
  { token: "{{user.name}}", label: "Nombre" },
  { token: "{{user.tier}}", label: "Nivel" },
  { token: "{{store.name}}", label: "Sucursal" },
] as const;

type EntityScope = "promo" | "product" | "reward";
const ENTITY_KINDS: { scope: EntityScope; label: string }[] = [
  { scope: "promo", label: "Promoción" },
  { scope: "product", label: "Producto" },
  { scope: "reward", label: "Recompensa" },
];

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
  scheduledAt: Date | null;
  special: boolean;
};

const EMPTY_MESSAGE: PreviewMessage = {
  push: { title: "", body: "" },
  email: { subject: "", body: "" },
  sms: { text: "" },
  whatsapp: { text: "" },
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
  scheduledAt: null,
  special: false,
};

function toFormMessage(m: CampaignPreset["message"] | null): PreviewMessage {
  return {
    push: { title: m?.push?.title ?? "", body: m?.push?.body ?? "" },
    email: { subject: m?.email?.subject ?? "", body: m?.email?.body ?? "" },
    sms: { text: m?.sms?.text ?? "" },
    whatsapp: { text: m?.whatsapp?.text ?? "" },
  };
}

function isChannelComplete(m: PreviewMessage, c: Channel): boolean {
  if (c === "push") return !!(m.push.title && m.push.body);
  if (c === "email") return !!(m.email.subject && m.email.body);
  if (c === "sms") return !!m.sms.text;
  return !!m.whatsapp.text;
}

/** Only the channels that have complete content (schema-compatible). */
function buildMessageInput(m: PreviewMessage): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (m.push.title && m.push.body) out.push = { title: m.push.title, body: m.push.body };
  if (m.email.subject && m.email.body) out.email = { subject: m.email.subject, body: m.email.body };
  if (m.sms.text) out.sms = { text: m.sms.text };
  if (m.whatsapp.text) out.whatsapp = { text: m.whatsapp.text };
  return out;
}

type AudienceFilter = {
  tiers?: Tier[];
  lastPurchase?: { op: "gte" | "lte"; days: number };
  minPurchases?: number;
  signedUpAfter?: Date;
  signedUpBefore?: Date;
};

function buildAudienceFilter(form: Form): AudienceFilter | undefined {
  const f: AudienceFilter = {};
  if (form.tiers.length > 0) f.tiers = form.tiers;
  const days = Number.parseInt(form.lastPurchaseDays, 10);
  if (form.lastPurchaseDays.trim() && !Number.isNaN(days))
    f.lastPurchase = { op: form.lastPurchaseOp, days };
  const min = Number.parseInt(form.minPurchases, 10);
  if (form.minPurchases.trim() && !Number.isNaN(min)) f.minPurchases = min;
  if (form.signedUpAfter) f.signedUpAfter = form.signedUpAfter;
  if (form.signedUpBefore) f.signedUpBefore = form.signedUpBefore;
  return Object.keys(f).length > 0 ? f : undefined;
}

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

  const [campaignId, setCampaignId] = useState<string | undefined>(id);
  const [form, setForm] = useState<Form>(EMPTY);
  const [stepIndex, setStepIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<{ channel: Channel; key: string } | null>(null);
  const seeded = useRef(false);
  const creating = useRef(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const setMsg = (channel: Channel, key: string, value: string) => {
    setForm((f) => ({
      ...f,
      message: { ...f.message, [channel]: { ...f.message[channel], [key]: value } },
    }));
    setDirty(true);
  };

  const insertToken = (token: string) => {
    if (!activeField) {
      toast.info(t("tokenHint"));
      return;
    }
    const { channel, key } = activeField;
    setForm((f) => {
      const current = (f.message[channel] as Record<string, string>)[key] ?? "";
      const sep = current && !current.endsWith(" ") ? " " : "";
      const next = `${current}${sep}${token}`;
      return {
        ...f,
        message: { ...f.message, [channel]: { ...f.message[channel], [key]: next } },
      };
    });
    setDirty(true);
  };

  const applyPreset = (preset: CampaignPreset) => {
    const message = toFormMessage(preset.message);
    setForm((f) => ({
      ...f,
      message,
      channelPriority:
        f.channelPriority.length > 0
          ? f.channelPriority
          : CHANNELS.filter((c) => isChannelComplete(message, c)),
    }));
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

  // New campaign → create a draft once.
  const createMut = useMutation(trpc.campaigns.create.mutationOptions());
  const [createErr, setCreateErr] = useState(false);
  const createTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startDraft = () => {
    setCreateErr(false);
    creating.current = true;
    createMut.reset();
    createMut.mutate(undefined, {
      onSuccess: (res) => {
        clearTimeout(createTimer.current);
        setCampaignId(res.campaign.id);
        seeded.current = true;
      },
      onError: () => {
        clearTimeout(createTimer.current);
        creating.current = false;
        setCreateErr(true);
        toast.error(t("createError"));
      },
    });
    // Don't hang on "Guardando…" forever if the request never returns (a stale
    // API-worker bundle after a schema/route change → restart wrangler dev).
    createTimer.current = setTimeout(() => {
      creating.current = false;
      createMut.reset();
      setCreateErr(true);
      toast.error(t("createError"));
    }, 12_000);
  };
  useEffect(() => {
    if (id || campaignId || creating.current) return;
    startDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, campaignId]);

  // Edit campaign → load + seed once.
  const stateQuery = useQuery({
    ...trpc.campaigns.getState.queryOptions({ id: id ?? "" }),
    enabled: Boolean(id),
  });
  useEffect(() => {
    if (id && stateQuery.data && !seeded.current) {
      const c = stateQuery.data.campaign;
      setForm({
        name: c.name ?? "",
        objective: c.objective ?? "",
        message: toFormMessage(c.message),
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
        scheduledAt: c.scheduledAt ?? null,
        special: c.special,
      });
      seeded.current = true;
    }
  }, [id, stateQuery.data]);

  const advanceMut = useMutation(trpc.campaigns.advance.mutationOptions());
  const publishMut = useMutation(trpc.campaigns.publish.mutationOptions());

  const step = STEPS[stepIndex]!;
  const steps = STEPS.map((key) => ({ key, label: t(`step.${key}`) }));

  const valid: Record<Step, boolean> = {
    definition: form.name.trim().length > 0,
    message: CHANNELS.some((c) => isChannelComplete(form.message, c)),
    channels: form.channelPriority.length > 0,
    audience: true,
    schedule: true,
  };
  const navigable: string[] = [];
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS.slice(0, i).every((s) => valid[s])) navigable.push(STEPS[i]!);
  }
  const completed = STEPS.slice(0, stepIndex).filter((s) => valid[s]);

  // Live reach for the audience/schedule steps (debounced; audience − opt-outs).
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
    enabled: step === "audience" || step === "schedule",
  });

  async function persistStep(): Promise<boolean> {
    if (!campaignId) return false;
    try {
      if (step === "definition") {
        await advanceMut.mutateAsync({
          id: campaignId,
          step: "definition",
          input: {
            name: form.name,
            objective: form.objective || undefined,
          },
        });
      } else if (step === "message") {
        await advanceMut.mutateAsync({
          id: campaignId,
          step: "message",
          input: { ...buildMessageInput(form.message), linkUrl: form.linkUrl || undefined },
        });
      } else if (step === "channels") {
        await advanceMut.mutateAsync({
          id: campaignId,
          step: "channels",
          input: { channelPriority: form.channelPriority },
        });
      } else if (step === "audience") {
        await advanceMut.mutateAsync({
          id: campaignId,
          step: "audience",
          input: buildAudienceFilter(form) ?? {},
        });
      } else if (step === "schedule") {
        await advanceMut.mutateAsync({
          id: campaignId,
          step: "schedule",
          input: { scheduledAt: form.scheduledAt ?? undefined, special: form.special },
        });
      }
      return true;
    } catch {
      toast.error(t("saveError"));
      return false;
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
      if (!campaignId) return;
      const ok = await persistStep();
      if (!ok) return;
      try {
        await publishMut.mutateAsync({ id: campaignId });
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
    const ok = await persistStep();
    if (ok) {
      setAttempted(false);
      setStepIndex((n) => n + 1);
    }
  }

  const busy = createMut.isPending && !campaignId && !createErr;
  const saving = advanceMut.isPending || publishMut.isPending;

  const toggleChannel = (c: Channel) =>
    set(
      "channelPriority",
      form.channelPriority.includes(c)
        ? form.channelPriority.filter((x) => x !== c)
        : [...form.channelPriority, c],
    );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Entity-variable picker: the editor requests an entity, we open the modal and
  // resolve the chosen chip back to it.
  const [entityReq, setEntityReq] = useState<{
    scope: EntityScope;
    resolve: (v: EditorVariable | null) => void;
  } | null>(null);
  const onRequestEntity = (scope: string) =>
    new Promise<EditorVariable | null>((resolve) =>
      setEntityReq({ scope: scope as EntityScope, resolve }),
    );
  const uploadImage = useUploadImage();
  const reorderChannel = (from: number, to: number) => {
    if (from === to) return;
    const next = [...form.channelPriority];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    set("channelPriority", next);
  };
  const toggleTier = (tier: Tier) =>
    set(
      "tiers",
      form.tiers.includes(tier) ? form.tiers.filter((x) => x !== tier) : [...form.tiers, tier],
    );

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
        saving={saving || busy}
        maxWidthClassName="max-w-7xl"
        onExit={tryExit}
        exitLabel={t("title")}
        preview={
          <CampaignMessagePreview message={form.message} channelPriority={form.channelPriority} />
        }
      >
        {!campaignId && (createMut.isError || createErr) ? (
          <div className="space-y-3 py-4">
            <p className="text-destructive text-sm font-medium">{t("createError")}</p>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={startDraft}
            >
              {t("retryCreate")}
            </Button>
          </div>
        ) : step === "definition" ? (
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
                rows={6}
              />
            </Field>
          </div>
        ) : step === "message" ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs">{t("presetsLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {CAMPAIGN_PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 rounded-full"
                    onClick={() => applyPreset(p)}
                  >
                    <span>{p.emoji}</span>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("tokensLabel")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {CAMPAIGN_VARS.map((v) => (
                  <Button
                    key={v.token}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-full text-xs font-semibold"
                    onClick={() => insertToken(v.token)}
                  >
                    {v.label}
                  </Button>
                ))}
                {ENTITY_KINDS.map((e) => (
                  <Button
                    key={e.scope}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full border-dashed text-xs font-semibold"
                    onClick={() =>
                      void onRequestEntity(e.scope).then((v) => v && insertToken(v.token))
                    }
                  >
                    + {e.label}
                  </Button>
                ))}
              </div>
            </div>


            {attempted && !valid.message ? <ErrorText>{t("messageRequired")}</ErrorText> : null}

            <ChannelBlock label={t("channel.push")}>
              <Input
                value={form.message.push.title}
                onChange={(e) => setMsg("push", "title", e.target.value)}
                onFocus={() => setActiveField({ channel: "push", key: "title" })}
                placeholder={t("pushTitlePlaceholder")}
                className="h-10"
              />
              <Textarea
                value={form.message.push.body}
                onChange={(e) => setMsg("push", "body", e.target.value)}
                onFocus={() => setActiveField({ channel: "push", key: "body" })}
                placeholder={t("pushBodyPlaceholder")}
                rows={2}
              />
            </ChannelBlock>

            <ChannelBlock label={t("channel.email")}>
              <Input
                value={form.message.email.subject}
                onChange={(e) => setMsg("email", "subject", e.target.value)}
                onFocus={() => setActiveField({ channel: "email", key: "subject" })}
                placeholder={t("emailSubjectPlaceholder")}
                className="h-10"
              />
              <RichTextEditor
                value={form.message.email.body}
                // Treat an empty editor (`<p></p>`) as no content.
                onValueChange={(html) =>
                  setMsg("email", "body", html.replace(/<[^>]*>/g, "").trim() ? html : "")
                }
                placeholder={t("emailBodyPlaceholder")}
                variables={[...CAMPAIGN_VARS]}
                entities={ENTITY_KINDS}
                onRequestEntity={onRequestEntity}
                onUploadImage={uploadImage}
              />
            </ChannelBlock>

            <ChannelBlock label={t("channel.sms")}>
              <Textarea
                value={form.message.sms.text}
                onChange={(e) => setMsg("sms", "text", e.target.value)}
                onFocus={() => setActiveField({ channel: "sms", key: "text" })}
                placeholder={t("smsPlaceholder")}
                rows={2}
              />
            </ChannelBlock>

            <ChannelBlock label={t("channel.whatsapp")}>
              <Textarea
                value={form.message.whatsapp.text}
                onChange={(e) => setMsg("whatsapp", "text", e.target.value)}
                onFocus={() => setActiveField({ channel: "whatsapp", key: "text" })}
                placeholder={t("whatsappPlaceholder")}
                rows={2}
              />
            </ChannelBlock>
          </div>
        ) : step === "channels" ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">{t("channelsPriorityHint")}</p>
            {attempted && !valid.channels ? <ErrorText>{t("channelsRequired")}</ErrorText> : null}

            {form.channelPriority.length > 0 ? (
              <ol className="space-y-2">
                {form.channelPriority.map((c, i) => {
                  const Icon = CHANNEL_ICON[c];
                  return (
                    <li
                      key={c}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null) reorderChannel(dragIndex, i);
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      className={`border-border bg-card flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${
                        dragIndex === i ? "opacity-50" : ""
                      } ${dragIndex !== null && dragIndex !== i ? "hover:border-primary/50" : ""}`}
                    >
                      <GripVertical className="text-muted-foreground/50 size-4 flex-none cursor-grab active:cursor-grabbing" />
                      <span className="bg-primary/10 text-primary grid size-6 flex-none place-items-center rounded-md text-xs font-bold">
                        {i + 1}
                      </span>
                      <Icon className="text-muted-foreground size-4 flex-none" />
                      <span className="flex-1 text-sm font-semibold">{t(`channel.${c}`)}</span>
                      {!isChannelComplete(form.message, c) ? (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[0.625rem] font-bold tracking-wide text-amber-700 uppercase dark:bg-amber-900/40 dark:text-amber-300">
                          {t("channelEmpty")}
                        </span>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg"
                        aria-label={t("remove")}
                        onClick={() => toggleChannel(c)}
                      >
                        <X className="size-4" />
                      </Button>
                    </li>
                  );
                })}
              </ol>
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-xs">{t("addChannel")}</Label>
              <div className="flex flex-wrap gap-3">
                {CHANNELS.filter((c) => !form.channelPriority.includes(c)).map((c) => (
                  <Button
                    key={c}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full"
                    onClick={() => toggleChannel(c)}
                  >
                    + {t(`channel.${c}`)}
                  </Button>
                ))}
                {form.channelPriority.length === CHANNELS.length ? (
                  <span className="text-muted-foreground text-sm">{t("allChannelsAdded")}</span>
                ) : null}
              </div>
            </div>
          </div>
        ) : step === "audience" ? (
          <div className="space-y-5">
            <p className="text-muted-foreground text-sm">{t("audienceHint")}</p>

            <Field label={t("audienceTiers")} hint={t("optional")}>
              <div className="flex flex-wrap gap-3">
                {TIERS.map((tier) => (
                  <label
                    key={tier}
                    className="flex items-center gap-2 text-sm font-semibold capitalize"
                  >
                    <Checkbox
                      checked={form.tiers.includes(tier)}
                      onCheckedChange={() => toggleTier(tier)}
                    />
                    {tier}
                  </label>
                ))}
              </div>
            </Field>

            <Field label={t("audienceLastPurchase")} hint={t("optional")}>
              <div className="flex items-center gap-2">
                <Select
                  value={form.lastPurchaseOp}
                  onValueChange={(v) => set("lastPurchaseOp", (v as "gte" | "lte") ?? "gte")}
                >
                  <SelectTrigger size="lg" className="h-10 w-40 text-sm">
                    <SelectValue>{(v) => t(`lastPurchaseOp.${v as string}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gte">{t("lastPurchaseOp.gte")}</SelectItem>
                    <SelectItem value="lte">{t("lastPurchaseOp.lte")}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  value={form.lastPurchaseDays}
                  onChange={(e) => set("lastPurchaseDays", e.target.value)}
                  placeholder="0"
                  className="h-10 w-28"
                />
                <span className="text-muted-foreground text-sm">{t("days")}</span>
              </div>
            </Field>

            <Field label={t("audienceMinPurchases")} hint={t("optional")}>
              <Input
                type="number"
                min={1}
                value={form.minPurchases}
                onChange={(e) => set("minPurchases", e.target.value)}
                placeholder="0"
                className="h-10 w-40"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("audienceSignedUpAfter")} hint={t("optional")}>
                <DatePicker
                  value={form.signedUpAfter ?? undefined}
                  onValueChange={(d) => set("signedUpAfter", d ?? null)}
                  placeholder={t("datePlaceholder")}
                  formatLabel={(d) => formatDate(d, { locale })}
                />
              </Field>
              <Field label={t("audienceSignedUpBefore")} hint={t("optional")}>
                <DatePicker
                  value={form.signedUpBefore ?? undefined}
                  onValueChange={(d) => set("signedUpBefore", d ?? null)}
                  placeholder={t("datePlaceholder")}
                  formatLabel={(d) => formatDate(d, { locale })}
                />
              </Field>
            </div>

            <ReachBox reachable={reach.data?.reachable} audience={reach.data?.audience} />
          </div>
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

            <Field label={t("scheduleLabel")} hint={form.scheduledAt ? undefined : t("sendNow")}>
              <div className="flex items-center gap-2">
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

      <CampaignEntityModal
        scope={entityReq?.scope ?? null}
        onResolve={(v) => {
          entityReq?.resolve(v);
          setEntityReq(null);
        }}
      />
    </>
  );
}

function ReachBox({ reachable, audience }: { reachable?: number; audience?: number }) {
  const t = useTranslations("Campaigns");
  return (
    <div className="bg-muted/40 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm">
      <Users className="text-muted-foreground size-4 shrink-0" />
      {reachable !== undefined && audience !== undefined ? (
        <p className="font-semibold">{t("reach", { reachable, audience })}</p>
      ) : (
        <p className="text-muted-foreground">…</p>
      )}
    </div>
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

function ChannelBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border space-y-2 rounded-2xl border p-3">
      <p className="text-muted-foreground text-xs font-bold">{label}</p>
      {children}
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

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-destructive text-xs font-semibold">{children}</p>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground font-semibold">{label}</dt>
      <dd className="truncate text-right font-bold">{value}</dd>
    </div>
  );
}
