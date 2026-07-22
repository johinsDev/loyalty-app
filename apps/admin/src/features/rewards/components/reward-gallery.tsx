"use client";

import { Button, IconGlyph } from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Pre-wizard gallery: pick a curated template (preseeded benefit + cost + bg,
 * ready to publish after a quick review) or start blank. Selecting creates the
 * draft and jumps straight into the wizard.
 */
export function RewardGallery() {
  const t = useTranslations("Rewards.gallery");
  const router = useRouter();
  const trpc = useTRPC();
  const templates = useQuery(trpc.rewards.templates.queryOptions());
  const createMut = useMutation(trpc.rewards.create.mutationOptions());
  const creating = useRef(false);

  async function start(templateKey?: string) {
    if (creating.current) return;
    creating.current = true;
    try {
      const res = await createMut.mutateAsync(templateKey ? { templateKey } : undefined);
      router.push({ pathname: "/rewards/[id]", params: { id: res.reward.id } });
    } catch {
      toast.error(t("createError"));
      creating.current = false;
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8">
      <button
        type="button"
        onClick={() => router.push("/rewards")}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm font-semibold"
      >
        <ChevronLeft className="size-4" />
        {t("backToList")}
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        <Button
          className="h-10 gap-1.5 rounded-xl px-5 font-semibold"
          onClick={() => start()}
          disabled={createMut.isPending}
        >
          <Plus className="size-4" />
          {t("startBlank")}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(templates.data ?? []).map((tpl) => (
          <button
            key={tpl.key}
            type="button"
            onClick={() => start(tpl.key)}
            disabled={createMut.isPending}
            className="group bg-card overflow-hidden rounded-3xl text-left shadow-sm ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
          >
            <div
              className="relative flex h-36 flex-col justify-end p-4 text-white"
              style={{ background: tpl.backgroundCss }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
              <span className="relative z-10 mb-1.5 grid size-11 place-items-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">
                <IconGlyph value={tpl.icon} />
              </span>
              <p className="font-display relative z-10 text-lg leading-tight font-semibold drop-shadow-sm">
                {tpl.name}
              </p>
            </div>
            <div className="p-3.5">
              <p className="text-muted-foreground line-clamp-2 text-xs">{tpl.description}</p>
              <p className="text-primary mt-2 text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100">
                {t("useTemplate")}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
