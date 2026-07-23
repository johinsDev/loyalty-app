import type { RewardBenefitConfig } from "@loyalty/db/schema";

/**
 * Auto-generated, always-truthful reward benefit copy per type (hardcoded es/en
 * maps, like the promos formatter — the api package can't reach app catalogs).
 * A manual `shortDescription`/translation wins at render time; this fills the
 * fallback summary. `names` resolves item refs for detail reads; list cards keep
 * generic phrasing.
 */

export type SummaryLocale = "es" | "en";

const money = (cents: number, locale: SummaryLocale): string =>
  new Intl.NumberFormat(locale === "es" ? "es-CO" : "en-US", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100));

const pct = (n: number): string => `${n % 1 === 0 ? n : n.toFixed(1)}%`;

type Names = ReadonlyMap<string, string>;
const AND = { es: " y ", en: " & " } as const;

/** Resolve up to 2 ref names, else null (generic phrasing). */
function refNames(
  refs: { id: string }[],
  names: Names | undefined,
  locale: SummaryLocale,
): string | null {
  if (refs.length === 0 || refs.length > 2 || !names) return null;
  const resolved = refs.map((r) => names.get(r.id)).filter((n): n is string => Boolean(n));
  return resolved.length === refs.length ? resolved.join(AND[locale]) : null;
}

export function rewardBenefitSummary(
  benefit: RewardBenefitConfig | null,
  locale: SummaryLocale,
  names?: Names,
): string | null {
  if (!benefit) return null;
  const es = locale === "es";

  switch (benefit.type) {
    case "freeProduct": {
      const what = refNames(benefit.refs, names, locale);
      if (what) return es ? `${what} gratis` : `Free ${what}`;
      return es ? "Producto gratis" : "Free item";
    }
    case "amountOff": {
      const amount = money(benefit.amountCents, locale);
      const what = refNames(benefit.refs, names, locale);
      if (benefit.refs.length === 0) return es ? `${amount} de descuento` : `${amount} off`;
      const scope = what ?? (es ? "productos seleccionados" : "selected items");
      return es ? `${amount} en ${scope}` : `${amount} off ${scope}`;
    }
    case "percentOff": {
      const what = refNames(benefit.refs, names, locale);
      if (benefit.refs.length === 0)
        return es ? `${pct(benefit.percent)} en tu compra` : `${pct(benefit.percent)} off`;
      const scope = what ?? (es ? "productos seleccionados" : "selected items");
      return es ? `${pct(benefit.percent)} en ${scope}` : `${pct(benefit.percent)} off ${scope}`;
    }
    case "freeAddon":
      return es ? "Adición gratis" : "Free add-on";
    case "variantUpgrade":
      return es
        ? `Sube a ${benefit.toValueLabel} gratis`
        : `Free upgrade to ${benefit.toValueLabel}`;
    case "experience":
      return es ? "Experiencia" : "Experience";
    default:
      return null;
  }
}
