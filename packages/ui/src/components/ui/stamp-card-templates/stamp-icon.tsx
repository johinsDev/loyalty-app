"use client";

import {
  Beer,
  Cake,
  Coffee,
  CroissantIcon,
  CupSoda,
  Flower2,
  Heart,
  IceCreamCone,
  Pizza,
  Sandwich,
  Sparkles,
  Star,
} from "lucide-react";
import * as React from "react";

/** The curated stamp glyphs the admin editor offers. Keys persist in
 *  `organization_settings.stampStyle` — never rename one, only add. */
export const STAMP_ICONS = [
  { key: "cup-soda", Icon: CupSoda },
  { key: "coffee", Icon: Coffee },
  { key: "pizza", Icon: Pizza },
  { key: "ice-cream", Icon: IceCreamCone },
  { key: "croissant", Icon: CroissantIcon },
  { key: "cake", Icon: Cake },
  { key: "sandwich", Icon: Sandwich },
  { key: "beer", Icon: Beer },
  { key: "star", Icon: Star },
  { key: "heart", Icon: Heart },
  { key: "flower", Icon: Flower2 },
  { key: "sparkles", Icon: Sparkles },
] as const;

export type StampIconKey = (typeof STAMP_ICONS)[number]["key"];

const BY_KEY = new Map(STAMP_ICONS.map((i) => [i.key, i.Icon]));

/**
 * The stamp glyph, always tintable via `currentColor`: curated keys render the
 * lucide icon; an uploaded image renders as a CSS-mask silhouette (any SVG/PNG
 * with transparency takes any color — and never executes as markup, so there's
 * no SVG-sanitization concern). Unknown keys fall back to the cup.
 */
export function StampIcon({
  icon,
  className,
  style,
}: {
  icon: { kind: "lucide" | "image"; value: string };
  className?: string;
  style?: React.CSSProperties;
}) {
  if (icon.kind === "image") {
    return (
      <span
        aria-hidden
        className={className}
        style={{
          display: "inline-block",
          backgroundColor: "currentColor",
          maskImage: `url("${icon.value}")`,
          maskSize: "contain",
          maskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskImage: `url("${icon.value}")`,
          WebkitMaskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          ...style,
        }}
      />
    );
  }
  const Icon = BY_KEY.get(icon.value as StampIconKey) ?? CupSoda;
  return <Icon className={className} style={style} />;
}
