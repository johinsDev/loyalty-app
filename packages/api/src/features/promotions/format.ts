import type { PromoRule } from "@loyalty/db/schema";

/**
 * Auto-generated, always-truthful benefit copy per curated type. Lives here
 * (hardcoded es/en maps, like `points/config.ts`) because the api package can't
 * reach the apps' message catalogs. Manual `shortDescription` overrides win at
 * render time; this fills `benefitSummary` as the fallback.
 *
 * `names` (optional) resolves item refs to display names — the detail read
 * passes it; list cards keep the generic phrasing to avoid N lookups.
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

function scopedNames(
  rule: PromoRule,
  names: Names | undefined,
  locale: SummaryLocale,
  side: "buy" | "get" = "buy",
): string | null {
  const reqs = side === "get" ? (rule.get?.requirements ?? []) : rule.buy.requirements;
  const ids = reqs.flatMap((r) => r.refs.map((ref) => ref.id));
  if (ids.length === 0 || ids.length > 2 || !names) return null;
  const resolved = ids.map((id) => names.get(id)).filter((n): n is string => Boolean(n));
  if (resolved.length !== ids.length) return null;
  return resolved.join(AND[locale]);
}

export function benefitSummary(
  type: string | null,
  rule: PromoRule | null,
  locale: SummaryLocale,
  names?: Names,
): string | null {
  if (!type || !rule) return null;
  const e = rule.effect;
  const scoped = scopedNames(rule, names, locale);
  const es = locale === "es";

  switch (type) {
    case "percentOff": {
      if (e.kind !== "percentOff") return null;
      if (rule.buy.requirements.length === 0)
        return es ? `${pct(e.percent)} en toda tu compra` : `${pct(e.percent)} off your order`;
      const what = scoped ?? (es ? "productos seleccionados" : "selected items");
      return es ? `${pct(e.percent)} en ${what}` : `${pct(e.percent)} off ${what}`;
    }
    case "amountOff": {
      if (e.kind !== "amountOff") return null;
      const amount = money(e.amountCents, locale);
      if (rule.buy.requirements.length === 0)
        return es ? `${amount} de descuento` : `${amount} off`;
      const what = scoped ?? (es ? "productos seleccionados" : "selected items");
      return es ? `${amount} de descuento en ${what}` : `${amount} off ${what}`;
    }
    case "nxm": {
      if (e.kind !== "freeUnits") return null;
      const req = rule.buy.requirements[0];
      if (!req) return null;
      const pay = req.qty - e.count;
      const label = `${req.qty}×${pay}`;
      if (scoped) return es ? `${label} en ${scoped}` : `${label} on ${scoped}`;
      return es ? `${label}: el más barato va gratis` : `${label}: cheapest one free`;
    }
    case "secondUnit": {
      if (e.kind !== "percentOff") return null;
      const what = scoped ? (es ? ` en ${scoped}` : ` on ${scoped}`) : "";
      return es
        ? `${pct(e.percent)} en la 2.ª unidad${what}`
        : `${pct(e.percent)} off the 2nd unit${what}`;
    }
    case "bundle": {
      if (e.kind === "percentOff")
        return es ? `${pct(e.percent)} llevando el paquete` : `${pct(e.percent)} off the bundle`;
      if (e.kind === "amountOff")
        return es
          ? `${money(e.amountCents, locale)} off llevando el paquete`
          : `${money(e.amountCents, locale)} off the bundle`;
      return null;
    }
    case "combo": {
      if (e.kind !== "fixedPrice") return null;
      return es
        ? `Combo por ${money(e.priceCents, locale)}`
        : `Combo for ${money(e.priceCents, locale)}`;
    }
    case "crossSell": {
      if (e.kind !== "percentOff") return null;
      const gift = scopedNames(rule, names, locale, "get");
      if (e.percent === 100) {
        if (gift) return es ? `${gift} gratis con tu compra` : `Free ${gift} with your purchase`;
        return es ? "Producto de regalo con tu compra" : "Free item with your purchase";
      }
      const what = gift ?? (es ? "tu adicional" : "your add-on");
      return es ? `${pct(e.percent)} en ${what}` : `${pct(e.percent)} off ${what}`;
    }
    case "cartThreshold": {
      const threshold = rule.buy.minSubtotalCents;
      if (threshold == null) return null;
      const from = money(threshold, locale);
      if (e.kind === "amountOff")
        return es
          ? `Desde ${from}: ${money(e.amountCents, locale)} off`
          : `Spend ${from}, get ${money(e.amountCents, locale)} off`;
      if (e.kind === "percentOff")
        return es
          ? `Desde ${from}: ${pct(e.percent)} off`
          : `Spend ${from}, get ${pct(e.percent)} off`;
      return null;
    }
    case "volumeTiered": {
      if (e.kind !== "tieredPercent") return null;
      const top = Math.max(...e.tiers.map((t) => t.percent));
      const what = scoped ? (es ? ` en ${scoped}` : ` on ${scoped}`) : "";
      return es
        ? `Hasta ${pct(top)} off por cantidad${what}`
        : `Up to ${pct(top)} off by quantity${what}`;
    }
    case "pointsMultiplier": {
      if (e.kind !== "pointsMultiplier") return null;
      const x = e.multiplier % 1 === 0 ? String(e.multiplier) : e.multiplier.toFixed(1);
      return es ? `x${x} puntos en tu compra` : `${x}x points on your purchase`;
    }
    default:
      return null;
  }
}
