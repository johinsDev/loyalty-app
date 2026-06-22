import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Placeholder for admin sections whose rich screens are designed but not built
 * yet (the shell ships first; each section lands in its own PR). Keeps the
 * sidebar fully navigable without 404s.
 */
export function ComingSoon({ titleKey }: { titleKey: string }) {
  const t = useTranslations("Nav");
  const tAdmin = useTranslations("Admin");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <span className="bg-primary/10 text-primary mb-4 grid size-16 place-items-center rounded-3xl">
        <Sparkles className="size-7" />
      </span>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {t(titleKey)}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {tAdmin("comingSoon")}
      </p>
    </div>
  );
}
