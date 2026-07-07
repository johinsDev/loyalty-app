"use client";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ScrollArea,
} from "@loyalty/ui";

import {
  CAMPAIGN_PRESETS,
  PRESET_CATEGORIES,
  type CampaignPreset,
} from "../presets";

/** A one-line preview of a preset's copy (first channel with content). */
function previewOf(p: CampaignPreset): string {
  const m = p.message;
  return (
    m.whatsapp?.text ?? m.push?.body ?? m.email?.body ?? m.sms?.text ?? ""
  );
}

/**
 * Gallery of starter presets, grouped by category, each showing a preview. A
 * calmer way to browse the templates than a long chip row — pick one to seed
 * the message step.
 */
export function CampaignPresetsGallery({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (preset: CampaignPreset) => void;
}) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-xl">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Plantillas rápidas</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <ScrollArea className="max-h-[70dvh]">
          <div className="space-y-5 p-4">
            {PRESET_CATEGORIES.map((cat) => {
              const items = CAMPAIGN_PRESETS.filter((p) => p.category === cat.key);
              if (items.length === 0) return null;
              return (
                <div key={cat.key} className="space-y-2">
                  <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                    {cat.label}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onPick(p);
                          onOpenChange(false);
                        }}
                        className="border-border hover:border-primary/50 hover:bg-muted/40 flex flex-col gap-1 rounded-2xl border p-3 text-left transition-colors"
                      >
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          <span>{p.emoji}</span>
                          {p.label}
                        </span>
                        <span className="text-muted-foreground line-clamp-2 text-xs">
                          {previewOf(p)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
