"use client";

import { AuroraPointsCard } from "./aurora";
import { BubblesPointsCard } from "./bubbles";
import { ClassicPointsCard } from "./classic";
import { HoloPointsCard } from "./holo";
import { MeshPointsCard } from "./mesh";
import { MinimalPointsCard } from "./minimal";
import { NeonPointsCard } from "./neon";
import { OrbitPointsCard } from "./orbit";
import { TicketPointsCard } from "./ticket";
import type { PointsCardView } from "./types";
import { WavePointsCard } from "./wave";

export type { PointsCardView } from "./types";

/**
 * The selectable points-card designs (typed constant, `PROMO_TEMPLATES`
 * pattern). The chosen key persists on `organization_settings.pointsCardTemplate`
 * and ships to the PWA via the public `settings.loyaltyConfig`. Both the admin
 * gallery preview and the customer home render through `PointsCardTemplate`,
 * so what the owner picks IS what the customer sees.
 */
export const POINTS_CARD_TEMPLATES = [
  { key: "classic", name: { es: "Clásico", en: "Classic" } },
  { key: "aurora", name: { es: "Aurora", en: "Aurora" } },
  { key: "neon", name: { es: "Neón", en: "Neon" } },
  { key: "holo", name: { es: "Holográfica", en: "Holographic" } },
  { key: "bubbles", name: { es: "Burbujas", en: "Bubbles" } },
  { key: "wave", name: { es: "Marea", en: "Tide" } },
  { key: "orbit", name: { es: "Órbita", en: "Orbit" } },
  { key: "ticket", name: { es: "Boleto", en: "Ticket" } },
  { key: "mesh", name: { es: "Prisma", en: "Prism" } },
  { key: "minimal", name: { es: "Minimal", en: "Minimal" } },
] as const;

export type PointsCardTemplateKey = (typeof POINTS_CARD_TEMPLATES)[number]["key"];

const RENDERERS: Record<PointsCardTemplateKey, React.ComponentType<{ view: PointsCardView }>> = {
  classic: ClassicPointsCard,
  aurora: AuroraPointsCard,
  neon: NeonPointsCard,
  holo: HoloPointsCard,
  bubbles: BubblesPointsCard,
  wave: WavePointsCard,
  orbit: OrbitPointsCard,
  ticket: TicketPointsCard,
  mesh: MeshPointsCard,
  minimal: MinimalPointsCard,
};

/** Render the points card in the given template; unknown keys (an org saved a
 *  template this build doesn't know) fall back to `classic`. */
export function PointsCardTemplate({
  template,
  view,
}: {
  template: string;
  view: PointsCardView;
}) {
  const Renderer = RENDERERS[template as PointsCardTemplateKey] ?? ClassicPointsCard;
  return <Renderer view={view} />;
}
