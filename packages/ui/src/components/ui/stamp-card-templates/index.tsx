"use client";

import { AuroraStampCard } from "./aurora";
import { BubblesStampCard } from "./bubbles";
import { ClassicStampCard } from "./classic";
import { HoloStampCard } from "./holo";
import { MeshStampCard } from "./mesh";
import { MinimalStampCard } from "./minimal";
import { NeonStampCard } from "./neon";
import { OrbitStampCard } from "./orbit";
import { TicketStampCard } from "./ticket";
import type { StampCardView } from "./types";
import { WaveStampCard } from "./wave";

export type { StampCardView, StampSpot } from "./types";
export { stampGridLayout, type StampGridLayout } from "./layout";
export { STAMP_ICONS, StampIcon, type StampIconKey } from "./stamp-icon";
export { spotsOf } from "./shared";

/**
 * The selectable stamp-card designs (typed constant, mirrors
 * `POINTS_CARD_TEMPLATES`). The chosen key persists on
 * `organization_settings.stampsCardTemplate` and ships to the PWA via the
 * public `settings.loyaltyConfig`. Both the admin gallery preview and the
 * customer home render through `StampCardTemplate`, so what the owner picks IS
 * what the customer sees — at any goal 3–12, with the org's icon/color/off
 * style applied.
 */
export const STAMP_CARD_TEMPLATES = [
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

export type StampCardTemplateKey = (typeof STAMP_CARD_TEMPLATES)[number]["key"];

const RENDERERS: Record<
  StampCardTemplateKey,
  React.ComponentType<{ view: StampCardView }>
> = {
  classic: ClassicStampCard,
  aurora: AuroraStampCard,
  neon: NeonStampCard,
  holo: HoloStampCard,
  bubbles: BubblesStampCard,
  wave: WaveStampCard,
  orbit: OrbitStampCard,
  ticket: TicketStampCard,
  mesh: MeshStampCard,
  minimal: MinimalStampCard,
};

/** Render the stamp card in the given template; unknown keys (an org saved a
 *  template this build doesn't know) fall back to `classic`. */
export function StampCardTemplate({
  template,
  view,
}: {
  template: string;
  view: StampCardView;
}) {
  const Renderer = RENDERERS[template as StampCardTemplateKey] ?? ClassicStampCard;
  return <Renderer view={view} />;
}
