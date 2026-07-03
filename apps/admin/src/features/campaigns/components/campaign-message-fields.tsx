"use client";

import {
  Button,
  Input,
  Label,
  RichTextEditor,
  type EditorVariable,
} from "@loyalty/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Bell,
  GripVertical,
  HelpCircle,
  Mail,
  MessageCircle,
  MessageSquare,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

import { useUploadImage } from "@/features/storage/hooks/use-upload-image";

import { CAMPAIGN_VARS } from "../lib/campaign-vars";
import {
  CHANNELS,
  buildMessageInput,
  isChannelComplete,
  isMessageComplete,
  toFormMessage,
  type CampaignMessageValue,
  type Channel,
} from "../lib/campaign-message";
import { CAMPAIGN_PRESETS, type CampaignPreset } from "../presets";
import { CampaignEntityModal } from "./campaign-entity-modal";
import { CampaignPresetsGallery } from "./campaign-presets-gallery";
import { CampaignTemplates, type LoadedTemplate } from "./campaign-templates";
import { CampaignVariablesHelp } from "./campaign-variables-help";
import { ErrorText } from "./campaign-field";

const CHANNEL_ICON: Record<Channel, LucideIcon> = {
  push: Bell,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
};

type EntityScope = "promo" | "product" | "reward" | "category";
const ENTITY_KINDS: { scope: EntityScope; label: string }[] = [
  { scope: "promo", label: "Promoción" },
  { scope: "product", label: "Producto" },
  { scope: "category", label: "Categoría" },
  { scope: "reward", label: "Recompensa" },
];

/**
 * Controlled editor for a campaign message: the ordered channel-priority list,
 * the preset/template shortcuts, the merge-variable pills, and a per-channel
 * content block (push/email/sms/whatsapp). Owns its own entity-picker modal,
 * variables-help modal and preset gallery so callers don't wire them. The live
 * message preview lives outside this component (rendered by the caller) since it
 * sits in the wizard's sticky preview column.
 */
export function CampaignMessageFields({
  value,
  onChange,
  showError,
}: {
  value: CampaignMessageValue;
  onChange: (next: CampaignMessageValue) => void;
  /** Render the "at least one channel required" error (wizard's attempted state). */
  showError?: boolean;
}) {
  const t = useTranslations("Campaigns");
  const trpc = useTRPC();
  const uploadImage = useUploadImage();

  const [activeField, setActiveField] = useState<{ channel: Channel; key: string } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Entity-variable picker: the editor requests an entity, we open the modal and
  // resolve the chosen chip back to it.
  const [entityReq, setEntityReq] = useState<{
    scope: EntityScope;
    resolve: (v: EditorVariable | null) => void;
  } | null>(null);

  const setMsg = (channel: Channel, key: string, val: string) =>
    onChange({
      ...value,
      message: { ...value.message, [channel]: { ...value.message[channel], [key]: val } },
    });

  const insertToken = (token: string) => {
    if (!activeField) {
      toast.info(t("tokenHint"));
      return;
    }
    const { channel, key } = activeField;
    const current = (value.message[channel] as Record<string, string>)[key] ?? "";
    const sep = current && !current.endsWith(" ") ? " " : "";
    const next = `${current}${sep}${token}`;
    onChange({
      ...value,
      message: { ...value.message, [channel]: { ...value.message[channel], [key]: next } },
    });
  };

  const toggleChannel = (c: Channel) =>
    onChange({
      ...value,
      channelPriority: value.channelPriority.includes(c)
        ? value.channelPriority.filter((x) => x !== c)
        : [...value.channelPriority, c],
    });

  const reorderChannel = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value.channelPriority];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    onChange({ ...value, channelPriority: next });
  };

  const applyPreset = (preset: CampaignPreset) => {
    const message = toFormMessage(preset.message);
    onChange({
      ...value,
      message,
      channelPriority:
        value.channelPriority.length > 0
          ? value.channelPriority
          : CHANNELS.filter((c) => isChannelComplete(message, c)),
    });
  };

  // Load a saved template — replaces the message + channel priority outright.
  const applyTemplate = (tpl: LoadedTemplate) => {
    const message = toFormMessage((tpl.message as CampaignPreset["message"]) ?? null);
    const channelPriority = (tpl.channelPriority ?? []).filter((x): x is Channel =>
      (CHANNELS as readonly string[]).includes(x),
    );
    onChange({
      ...value,
      message,
      channelPriority:
        channelPriority.length > 0
          ? channelPriority
          : CHANNELS.filter((c) => isChannelComplete(message, c)),
    });
  };

  const onRequestEntity = (scope: string) =>
    new Promise<EditorVariable | null>((resolve) =>
      setEntityReq({ scope: scope as EntityScope, resolve }),
    );

  // Resolve bound-entity names in the message so chips loaded from a saved
  // token show the real product/promo name (not just "Producto").
  const entityRefs = useMemo(() => {
    const text = [
      value.message.push.title,
      value.message.push.body,
      value.message.email.subject,
      value.message.email.body,
      value.message.sms.text,
      value.message.whatsapp.text,
    ].join(" ");
    const re = /\{\{\s*(promo|product|reward|category)#([a-zA-Z0-9:_-]+)/gi;
    const seen = new Set<string>();
    const refs: { scope: EntityScope; id: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const key = `${m[1]}#${m[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push({ scope: m[1] as EntityScope, id: m[2]! });
      }
    }
    return refs;
  }, [value.message]);
  const entityNamesQuery = useQuery({
    ...trpc.campaigns.resolveEntities.queryOptions({ refs: entityRefs }),
    enabled: entityRefs.length > 0,
    placeholderData: keepPreviousData,
  });
  const entityNames = entityNamesQuery.data ?? {};

  const messageValid = isMessageComplete(value);

  return (
    <div className="space-y-5">
      <div className="border-border space-y-2.5 rounded-2xl border p-3.5">
        <div>
          <Label className="text-xs">{t("channelsLabel")}</Label>
          <p className="text-muted-foreground text-xs">{t("channelsPriorityHint")}</p>
        </div>
        {value.channelPriority.length > 0 ? (
          <ol className="space-y-2">
            {value.channelPriority.map((c, i) => {
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
                  className={`border-border bg-card flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                    dragIndex === i ? "opacity-50" : ""
                  } ${dragIndex !== null && dragIndex !== i ? "hover:border-primary/50" : ""}`}
                >
                  <GripVertical className="text-muted-foreground/50 size-4 flex-none cursor-grab active:cursor-grabbing" />
                  <span className="bg-primary/10 text-primary grid size-6 flex-none place-items-center rounded-md text-xs font-bold">
                    {i + 1}
                  </span>
                  <Icon className="text-muted-foreground size-4 flex-none" />
                  <span className="flex-1 text-sm font-semibold">{t(`channel.${c}`)}</span>
                  {!isChannelComplete(value.message, c) ? (
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
        {value.channelPriority.length < CHANNELS.length ? (
          <div className="flex flex-wrap gap-2">
            {CHANNELS.filter((c) => !value.channelPriority.includes(c)).map((c) => (
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
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">{t("presetsLabel")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          {CAMPAIGN_PRESETS.slice(0, 4).map((p) => (
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary h-9 gap-1.5 rounded-full font-semibold"
            onClick={() => setGalleryOpen(true)}
          >
            <Sparkles className="size-3.5" />
            {t("presetsBrowse")}
          </Button>
        </div>
      </div>

      <CampaignTemplates
        getMessage={() => buildMessageInput(value.message)}
        getChannelPriority={() => value.channelPriority}
        canSave={messageValid}
        onLoad={applyTemplate}
      />

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs">{t("tokensLabel")}</Label>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-semibold"
          >
            <HelpCircle className="size-3.5" />
            {t("variablesHelp")}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CAMPAIGN_VARS.map((v) => (
            <Button
              key={v.token}
              type="button"
              variant="secondary"
              size="sm"
              title={`${v.hint} · ${v.token}`}
              className="h-8 rounded-full text-xs font-semibold"
              onClick={() => insertToken(v.token)}
            >
              {v.label}
            </Button>
          ))}
        </div>
      </div>


      {showError && !messageValid ? <ErrorText>{t("messageRequired")}</ErrorText> : null}

      {value.channelPriority.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-6 text-center text-sm">
          {t("noChannelsHint")}
        </div>
      ) : null}

      {value.channelPriority.includes("push") ? (
        <ChannelBlock label={t("channel.push")}>
          <Input
            value={value.message.push.title}
            onChange={(e) => setMsg("push", "title", e.target.value)}
            onFocus={() => setActiveField({ channel: "push", key: "title" })}
            placeholder={t("pushTitlePlaceholder")}
            className="h-10"
          />
          <RichTextEditor
            plain
            value={value.message.push.body}
            onValueChange={(text) => setMsg("push", "body", text.trim() ? text : "")}
            placeholder={t("pushBodyPlaceholder")}
            variables={[...CAMPAIGN_VARS]}
            entities={ENTITY_KINDS}
            onRequestEntity={onRequestEntity}
          entityNames={entityNames}
          />
        </ChannelBlock>
      ) : null}

      {value.channelPriority.includes("email") ? (
      <ChannelBlock label={t("channel.email")}>
        <Input
          value={value.message.email.subject}
          onChange={(e) => setMsg("email", "subject", e.target.value)}
          onFocus={() => setActiveField({ channel: "email", key: "subject" })}
          placeholder={t("emailSubjectPlaceholder")}
          className="h-10"
        />
        <RichTextEditor
          value={value.message.email.body}
          // Treat an empty editor (`<p></p>`) as no content.
          onValueChange={(html) =>
            setMsg("email", "body", html.replace(/<[^>]*>/g, "").trim() ? html : "")
          }
          placeholder={t("emailBodyPlaceholder")}
          variables={[...CAMPAIGN_VARS]}
          entities={ENTITY_KINDS}
          onRequestEntity={onRequestEntity}
          entityNames={entityNames}
          onUploadImage={uploadImage}
        />
      </ChannelBlock>
      ) : null}

      {value.channelPriority.includes("sms") ? (
        <ChannelBlock label={t("channel.sms")}>
          <RichTextEditor
            plain
            value={value.message.sms.text}
            onValueChange={(text) => setMsg("sms", "text", text.trim() ? text : "")}
            placeholder={t("smsPlaceholder")}
            variables={[...CAMPAIGN_VARS]}
            entities={ENTITY_KINDS}
            onRequestEntity={onRequestEntity}
          entityNames={entityNames}
          />
        </ChannelBlock>
      ) : null}

      {value.channelPriority.includes("whatsapp") ? (
        <ChannelBlock label={t("channel.whatsapp")}>
          <RichTextEditor
            whatsapp
            value={value.message.whatsapp.text}
            onValueChange={(text) => setMsg("whatsapp", "text", text.trim() ? text : "")}
            placeholder={t("whatsappPlaceholder")}
            variables={[...CAMPAIGN_VARS]}
            entities={ENTITY_KINDS}
            onRequestEntity={onRequestEntity}
          entityNames={entityNames}
          />
        </ChannelBlock>
      ) : null}

      <CampaignEntityModal
        scope={entityReq?.scope ?? null}
        onResolve={(v) => {
          entityReq?.resolve(v);
          setEntityReq(null);
        }}
      />
      <CampaignVariablesHelp open={helpOpen} onOpenChange={setHelpOpen} />
      <CampaignPresetsGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onPick={applyPreset}
      />
    </div>
  );
}

function ChannelBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border space-y-2 rounded-2xl border p-3">
      <p className="text-muted-foreground text-xs font-bold">{label}</p>
      {children}
    </div>
  );
}
