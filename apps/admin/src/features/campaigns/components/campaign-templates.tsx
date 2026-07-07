"use client";

import {
  Button,
  Input,
  Label,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

/** A loaded template's payload the wizard applies to its message step. */
export type LoadedTemplate = {
  message: Record<string, unknown> | null;
  channelPriority: string[] | null;
};

/**
 * Saved-templates strip for the message step: load an org template into the
 * editors, save the current message as a new one, or delete one. Complements
 * the built-in code presets. Persisted per-org via `campaigns.templateList`.
 */
export function CampaignTemplates({
  getMessage,
  getChannelPriority,
  canSave,
  onLoad,
}: {
  getMessage: () => Record<string, unknown>;
  getChannelPriority: () => string[];
  canSave: boolean;
  onLoad: (tpl: LoadedTemplate) => void;
}) {
  const t = useTranslations("Campaigns");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);

  const templates = useQuery(trpc.campaigns.templateList.queryOptions());
  const invalidate = () =>
    queryClient.invalidateQueries(trpc.campaigns.templateList.queryFilter());
  const save = useMutation(trpc.campaigns.saveTemplate.mutationOptions());
  const remove = useMutation(trpc.campaigns.deleteTemplate.mutationOptions());

  const onSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    save.mutate(
      {
        name: trimmed,
        message: getMessage() as never,
        channelPriority: getChannelPriority() as never,
      },
      {
        onSuccess: () => {
          toast.success(t("templateSaved", { name: trimmed }));
          setSaveOpen(false);
          setName("");
          void invalidate();
        },
        onError: () => toast.error(t("saveError")),
      },
    );
  };

  const onDelete = (id: string, tplName: string) =>
    remove.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success(t("templateDeleted", { name: tplName }));
          void invalidate();
        },
        onError: () => toast.error(t("saveError")),
      },
    );

  const rows = templates.data ?? [];

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{t("templatesLabel")}</Label>
      <p className="text-muted-foreground text-xs">{t("templatesHint")}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {rows.map((tpl) => (
          <span
            key={tpl.id}
            className="border-border bg-card group flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs font-semibold"
          >
            <button
              type="button"
              className="hover:text-primary max-w-40 truncate"
              onClick={() =>
                onLoad({ message: tpl.message, channelPriority: tpl.channelPriority })
              }
              title={t("templateLoad")}
            >
              {tpl.name}
            </button>
            <button
              type="button"
              aria-label={t("delete")}
              className="text-muted-foreground/60 hover:bg-muted hover:text-destructive grid size-5 place-items-center rounded-full"
              onClick={() => setConfirmDel({ id: tpl.id, name: tpl.name })}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-full border-dashed"
          disabled={!canSave}
          onClick={() => setSaveOpen(true)}
        >
          <BookmarkPlus className="size-3.5" />
          {t("templateSave")}
        </Button>
      </div>

      <ResponsiveModal open={saveOpen} onOpenChange={setSaveOpen}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("templateSaveTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="p-4">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSave()}
              placeholder={t("templateNamePlaceholder")}
              className="h-10"
              autoFocus
            />
          </div>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setSaveOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full px-6 font-semibold"
              onClick={onSave}
              disabled={!name.trim() || save.isPending}
            >
              {t("templateSave")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal
        open={confirmDel !== null}
        onOpenChange={(o) => !o && setConfirmDel(null)}
      >
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>
              {confirmDel ? t("templateDeleteTitle", { name: confirmDel.name }) : ""}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground px-4 pb-2 text-sm">
            {t("templateDeleteBody")}
          </p>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setConfirmDel(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 rounded-full px-6 font-semibold"
              onClick={() => {
                if (confirmDel) onDelete(confirmDel.id, confirmDel.name);
                setConfirmDel(null);
              }}
            >
              {t("delete")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}
