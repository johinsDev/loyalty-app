import type { BannerRow } from "@loyalty/db/schema";
import { describe, expect, it } from "vitest";

import { slugify, slugSuffix } from "../../_shared/slugify";
import { displayState } from "../repository";

describe("slugify", () => {
  it("lowercases, strips accents and collapses to hyphens", () => {
    expect(slugify("¡Llegó el Spring Drop!")).toBe("llego-el-spring-drop");
    expect(slugify("Nuevos   horarios")).toBe("nuevos-horarios");
    expect(slugify("café & té")).toBe("cafe-te");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  --hola--  ")).toBe("hola");
  });

  it("slugSuffix is base36 of the requested length", () => {
    const s = slugSuffix(5);
    expect(s).toHaveLength(5);
    expect(s).toMatch(/^[0-9a-z]+$/);
  });
});

describe("displayState", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const base: BannerRow = {
    id: "b1",
    organizationId: "o1",
    slug: "x",
    name: "X",
    status: "published",
    sortOrder: 0,
    storeIds: null,
    shortDescription: null,
    longDescription: null,
    backgroundCss: null,
    mainImageUrl: null,
    mainImageBlur: null,
    ctaLabel: null,
    ctaHref: null,
    ctaKind: null,
    displayFrom: null,
    displayUntil: null,
    seoTitle: null,
    seoDescription: null,
    ogImageUrl: null,
    createdAt: now,
    updatedAt: now,
  };

  it("draft when not published", () => {
    expect(displayState({ ...base, status: "draft" }, now)).toBe("draft");
  });

  it("active when published and within the window", () => {
    expect(displayState(base, now)).toBe("active");
    expect(
      displayState(
        { ...base, displayFrom: new Date("2026-06-01"), displayUntil: new Date("2026-06-30") },
        now,
      ),
    ).toBe("active");
  });

  it("scheduled when the start is in the future", () => {
    expect(displayState({ ...base, displayFrom: new Date("2026-07-01") }, now)).toBe("scheduled");
  });

  it("expired when the end has passed", () => {
    expect(displayState({ ...base, displayUntil: new Date("2026-06-01") }, now)).toBe("expired");
  });
});
