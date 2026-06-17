"use client";

import { Button } from "@loyalty/ui";
import { Wallet } from "lucide-react";
import { useTranslations } from "next-intl";

import { Confetti } from "@/features/auth/components/confetti";
import { EmojiTile } from "@/features/auth/components/emoji-tile";
import { Link } from "@/i18n/navigation";

// Shown once right after a first sign-up. Hardcoded sample identity + reward
// until the wallet/ledger feature drives it (and fires the welcome notification).
const NAME = "María";

/**
 * First-run welcome — the celebratory confetti screen from the "T4 Lovers"
 * design. Mobile-first, full-bleed; "Ver mi tarjeta" drops the user into the
 * home.
 */
export function WelcomeScreen() {
  const t = useTranslations("Welcome");

  return (
    <main className="bg-background text-foreground relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden">
      <Confetti />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
        <EmojiTile size="lg">🎉</EmojiTile>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight">
            {t("title", { name: NAME })}
          </h1>
          <p className="text-muted-foreground text-base">{t("subtitle")}</p>
        </div>
        <div className="from-primary/5 to-primary/20 inline-flex items-center rounded-full bg-gradient-to-br px-8 py-4 shadow-lg shadow-primary/20">
          <span className="font-display text-primary text-3xl font-semibold tracking-tight">
            {t("pointsPill")}
          </span>
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-2 px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <Button
          variant="gradient"
          className="h-14 w-full rounded-full text-base font-bold"
          render={<Link href="/" />}
        >
          {t("viewCard")}
        </Button>
        <button
          type="button"
          className="text-muted-foreground inline-flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <Wallet className="size-4" />
          {t("addToWallet")}
        </button>
      </div>
    </main>
  );
}
