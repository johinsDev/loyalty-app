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
    case "variantUpgrade": {
      // Name the SOURCE too. The reward now moves a line up, so the customer's
      // job is to bring a Mediano — "Sube a Grande gratis" read as if the Grande
      // itself were free, and never said what to order.
      // `benefit` is JSON from the DB with no runtime validation, so a legacy
      // or hand-edited row can lack `refs` entirely.
      const refs = benefit.refs ?? [];
      const what = refNames(refs, names, locale);
      const scope =
        refs.length === 0 ? null : (what ?? (es ? "productos seleccionados" : "selected items"));
      const base = es
        ? `Sube de ${benefit.fromValueLabel} a ${benefit.toValueLabel} gratis`
        : `Free ${benefit.fromValueLabel} → ${benefit.toValueLabel} upgrade`;
      if (!scope) return base;
      return es ? `${base} en ${scope}` : `${base} on ${scope}`;
    }
    case "experience":
      return es ? "Experiencia" : "Experience";
    default:
      return null;
  }
}
