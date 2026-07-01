"use client";

import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";

export type BannerCtaData = {
  label: string;
  href: string;
  kind: "internal" | "external";
};

/**
 * Maps an internal CTA href to a typed i18n route so internal targets navigate
 * client-side (Next Link). Known internals: a product (`/product/<slug>`), the
 * promos page (`/promos`) and the rewards page (`/rewards`). Unknown internals
 * fall back to a plain anchor.
 */
function typedHref(href: string) {
  if (href.startsWith("/product/")) {
    const slug = href.slice("/product/".length);
    return { pathname: "/product/[slug]", params: { slug } } as const;
  }
  if (href.startsWith("/promos/")) {
    const slug = href.slice("/promos/".length);
    return { pathname: "/promos/[slug]", params: { slug } } as const;
  }
  if (href === "/promos") return { pathname: "/promos" } as const;
  if (href === "/rewards") return { pathname: "/rewards" } as const;
  return null;
}

/**
 * Renders a CTA wrapper: external opens a new tab, a known internal target uses
 * the typed i18n Link (client navigation), and an unknown internal path falls
 * back to a plain same-tab anchor.
 */
export function CtaLink({
  cta,
  className,
  children,
  onClick,
}: {
  cta: BannerCtaData;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  if (cta.kind === "external") {
    return (
      <a
        href={cta.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }
  const internal = typedHref(cta.href);
  if (internal) {
    return (
      <Link href={internal} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a href={cta.href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
