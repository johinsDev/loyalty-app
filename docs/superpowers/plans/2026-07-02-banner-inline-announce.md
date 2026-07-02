# Banner Inline Announce (Difusión) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin launch a real omnichannel announcement campaign for a banner from inside the banner wizard — a "Difusión" step that, on Finish, publishes a once-mode campaign linked back to that banner.

**Architecture:** The banner is the source of truth and always commits first; the announcement is an additive, best-effort follow-on. A new nullable `campaign.source = {scope,id}` column traces a campaign back to the entity that spawned it (reused by later phases: promo/product/category/reward). A single server endpoint `campaigns.createFromEntity` does `createDraft → patch(all fields incl. source) → publish` in one call, reusing the existing publish/dispatch machinery. The frontend adds a client-only "Difusión" step to the banner wizard rendering a shared `AnnounceComposer`, seeded from the banner's own fields, guarded so it only sends when the banner ends up published.

**Tech Stack:** Drizzle + libSQL, tRPC v11 (`managerProcedure`), Zod, Trigger.dev v4 (`send-campaign`), Next 16 App Router, React Query, shadcn (Base UI), next-intl (es/en), Vitest.

**Phase scope:** Banner only. Promo/product/category/reward reuse `source` + `createFromEntity` + `AnnounceComposer` in later phases and are **out of scope** here.

**Key facts (verified in code):**
- Banner has a wizard (`packages/api/src/features/banners`), steps `["content","design","schedule"]`; the client wizard finishes by calling `banners.publish`.
- Banner is **not** canjeable and **not** a `{{…}}` token scope → its campaign is an announcement (no `offer`, funnel = Enviados → Clic).
- Banner fields for the seed: `name`, `shortDescription`, `mainImageUrl`, and CTA `ctaLabel`/`ctaHref`/`ctaKind` (`internal|external`), plus `displayFrom`/`displayUntil`, `slug`, `status`.
- Web banner detail route is `/banner/<slug>` (singular).
- `campaign.linkUrl` is a plain `text` column (relative paths OK; the seed uses `/promos`). `{{short_link}}` shortens `linkUrl` per recipient → the "Clic" stage.
- `campaign.message` is `{ push?, email?, sms?, whatsapp? }`; `linkUrl` is a **separate** column.
- `repo.patch(orgId, id, CampaignPatch)` updates arbitrary campaign columns; `publish` derives `offer` from message tokens (none for banners → stays null), marks published, and enqueues `send-campaign`.
- `campaigns.countReach` already exists for the live recipient count.
- The campaigns unit test builds a `base: CampaignRow` literal — **adding a column breaks it until `source: null` is added**.

---

## File Structure

**Backend — `packages/db`**
- Modify `packages/db/src/schema/campaigns.ts` — add `source` column + `CampaignSource` type.
- Create `packages/db/migrations/00NN_*.sql` — generated (never hand-written).

**Backend — `packages/api/src/features/campaigns`**
- Modify `schemas.ts` — `campaignSourceSchema`, `createFromEntityInputSchema`, `campaignsBySourceInputSchema`.
- Modify `repository.ts` — add `"source"` to `CampaignPatch` pick; add `campaignsForSource()`.
- Create `announce.ts` — pure `bannerAnnounceDefaults()` seed helper (title/body/linkUrl/channels from a banner).
- Modify `service.ts` — `createFromEntity()` + `campaignsBySource()`.
- Modify `router.ts` — wire `createFromEntity` (mutation) + `campaignsBySource` (query).
- Modify `__tests__/campaigns.test.ts` — add `source: null` to `base`; test `bannerAnnounceDefaults`.

**Frontend — `apps/admin/src/features`**
- Create `campaigns/components/announce-composer.tsx` — shared controlled composer (toggle, message, channel chips, audience preset, live count, when).
- Create `campaigns/lib/banner-announce.ts` — client seed helper: banner row → composer initial value + `linkUrl`.
- Modify `banners/components/banner-wizard.tsx` — insert client-only "Difusión" step + best-effort finish hook.
- Modify `banners/components/banner-detail-view.tsx` — "Campañas de este banner" list.
- Modify `apps/admin/messages/es.json` + `apps/admin/messages/en.json` — new keys.

---

### Task 1: DB — `source` column on `campaign`

**Files:**
- Modify: `packages/db/src/schema/campaigns.ts:44-86`
- Migration: generated via `bun run db:generate`

- [ ] **Step 1: Add the type + column**

In `packages/db/src/schema/campaigns.ts`, directly below the `CampaignOffer` type (line ~45) add:

```ts
/** Traceability: the entity whose creation spawned this campaign (P-hub). */
export type CampaignSource = {
  scope: "banner" | "promo" | "product" | "category" | "reward";
  id: string;
};
```

Then inside the `campaign` table, immediately after the `offer` column (line ~86) add:

```ts
    // Entity that spawned this campaign (e.g. a banner's inline "Difusión").
    // Nullable; reused by promo/product/category/reward in later phases.
    source: text("source", { mode: "json" }).$type<CampaignSource>(),
```

- [ ] **Step 2: Generate the migration**

Run: `bun run db:generate`
Expected: a new `packages/db/migrations/00NN_*.sql` adding `source` to `campaign`, and `meta/_journal.json` updated. Do NOT hand-edit the SQL.

- [ ] **Step 3: Apply it to the local dev DB**

Run: `bun run db:migrate:docker`
Expected: migration applies cleanly against `http://localhost:8080` (libSQL up via `bun run dev:services`).

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/campaigns.ts packages/db/migrations
git commit -m "feat(db): add campaign.source for entity→campaign traceability"
```

---

### Task 2: Schemas — source, createFromEntity, campaignsBySource

**Files:**
- Modify: `packages/api/src/features/campaigns/schemas.ts`

- [ ] **Step 1: Add the schemas**

At the end of `packages/api/src/features/campaigns/schemas.ts` add:

```ts
export const campaignSourceSchema = z.object({
  scope: z.enum(["banner", "promo", "product", "category", "reward"]),
  id: z.string().min(1),
});
export type CampaignSourceInput = z.infer<typeof campaignSourceSchema>;

/**
 * One-shot "create + publish a once-mode announcement for an entity". Bypasses
 * the step wizard: the caller supplies the fully-seeded content. `linkUrl` is a
 * plain string (relative paths allowed, mirroring stored campaign links).
 */
export const createFromEntityInputSchema = z.object({
  source: campaignSourceSchema,
  name: z.string().min(1).max(120),
  push: z.object({
    title: z.string().min(1).max(80),
    body: z.string().min(1).max(180),
  }),
  channelPriority: z.array(campaignChannelSchema).min(1),
  linkUrl: z.string().max(2000).optional(),
  audienceFilter: audienceFilterSchema.optional(),
  scheduledAt: z.coerce.date().optional(),
});
export type CreateFromEntityInput = z.infer<typeof createFromEntityInputSchema>;

export const campaignsBySourceInputSchema = campaignSourceSchema;
```

Note: Phase 1 only seeds `push`. Email/WhatsApp bodies are added when those channels are toggled on client-side; extend this schema (add optional `email`/`whatsapp` objects) when Phase 1 ships multi-channel content. For now `push` is required because push is always the default-on channel.

- [ ] **Step 2: Typecheck the package**

Run: `bun --cwd packages/api run typecheck`
Expected: PASS (schemas are self-contained; `campaignChannelSchema`, `audienceFilterSchema` already exist above).

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/features/campaigns/schemas.ts
git commit -m "feat(api): campaign source + createFromEntity schemas"
```

---

### Task 3: Pure seed helper `bannerAnnounceDefaults` (TDD)

Derives the announcement's title/body/linkUrl/channels from a banner. Pure + unit-tested.

**Files:**
- Create: `packages/api/src/features/campaigns/announce.ts`
- Test: `packages/api/src/features/campaigns/__tests__/campaigns.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/api/src/features/campaigns/__tests__/campaigns.test.ts`:

```ts
import { bannerAnnounceDefaults } from "../announce";

describe("bannerAnnounceDefaults", () => {
  const banner = {
    slug: "verano",
    name: "Promo de verano",
    shortDescription: "2x1 toda la semana",
    mainImageUrl: "https://cdn/x.jpg",
    ctaHref: "/promos/2x1",
    ctaKind: "internal" as const,
  };

  it("links to the CTA when present", () => {
    const d = bannerAnnounceDefaults(banner);
    expect(d.linkUrl).toBe("/promos/2x1");
    expect(d.push.title).toBe("Promo de verano");
    expect(d.push.body).toContain("2x1 toda la semana");
    expect(d.channelPriority).toEqual(["push"]);
  });

  it("falls back to the banner detail when there is no CTA", () => {
    const d = bannerAnnounceDefaults({ ...banner, ctaHref: null });
    expect(d.linkUrl).toBe("/banner/verano");
  });

  it("uses a generic body when shortDescription is empty", () => {
    const d = bannerAnnounceDefaults({ ...banner, shortDescription: null });
    expect(d.push.body.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun --cwd packages/api run test -- announce`
Expected: FAIL — cannot find module `../announce`.

- [ ] **Step 3: Implement the helper**

Create `packages/api/src/features/campaigns/announce.ts`:

```ts
/**
 * Seed an announcement campaign from a banner. Pure — no DB. Title = banner
 * name, body = short description (or a generic nudge), link = the banner's CTA
 * if present else its detail page. Push-only by default (free, zero friction);
 * the admin adds email/WhatsApp in the composer.
 */
export type BannerSeedInput = {
  slug: string;
  name: string;
  shortDescription?: string | null;
  mainImageUrl?: string | null;
  ctaHref?: string | null;
  ctaKind?: "internal" | "external" | null;
};

export type AnnounceDefaults = {
  push: { title: string; body: string };
  channelPriority: string[];
  linkUrl: string;
  imageUrl?: string;
};

const GENERIC_BODY = "¡No te lo pierdas! Toca para ver más.";

export function bannerAnnounceDefaults(banner: BannerSeedInput): AnnounceDefaults {
  const body = (banner.shortDescription ?? "").trim() || GENERIC_BODY;
  const linkUrl = (banner.ctaHref ?? "").trim() || `/banner/${banner.slug}`;
  return {
    push: { title: banner.name.slice(0, 80), body: body.slice(0, 180) },
    channelPriority: ["push"],
    linkUrl,
    ...(banner.mainImageUrl ? { imageUrl: banner.mainImageUrl } : {}),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --cwd packages/api run test -- announce`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/features/campaigns/announce.ts packages/api/src/features/campaigns/__tests__/campaigns.test.ts
git commit -m "feat(api): bannerAnnounceDefaults seed helper"
```

---

### Task 4: Repository — `source` in patch + `campaignsForSource`

**Files:**
- Modify: `packages/api/src/features/campaigns/repository.ts:101-120` and add a method near `adminList`.

- [ ] **Step 1: Allow patching `source`**

In `packages/api/src/features/campaigns/repository.ts`, add `"source"` to the `CampaignPatch` pick (after `"offer"`):

```ts
export type CampaignPatch = Partial<
  Pick<
    CampaignInsert,
    | "name"
    | "objective"
    | "message"
    | "offer"
    | "source"
    | "linkUrl"
    | "channelPriority"
    | "audienceFilter"
    | "scheduledAt"
    | "special"
    | "mode"
    | "cooldownDays"
    | "endsAt"
    // …keep the rest unchanged
```

- [ ] **Step 2: Add `campaignsForSource`**

Add this method to the `CampaignsRepository` class (near `adminList`). It returns lightweight rows for the entity's detail page:

```ts
  /** Campaigns spawned by a given entity (banner detail "Campañas"). */
  async campaignsForSource(
    orgId: string,
    source: { scope: string; id: string },
  ): Promise<{ id: string; name: string | null; status: string; publishedAt: Date | null }[]> {
    const rows = await this.db
      .select({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        publishedAt: campaign.publishedAt,
        source: campaign.source,
      })
      .from(campaign)
      .where(eq(campaign.organizationId, orgId))
      .orderBy(desc(campaign.createdAt));
    return rows
      .filter((r) => r.source?.scope === source.scope && r.source?.id === source.id)
      .map(({ source: _drop, ...r }) => r);
  }
```

(`desc`/`eq` are already imported in this file; `campaign` too. The `source` JSON is filtered in JS — pilot-scale, mirrors the existing `analytics`/`resolveDripDue` in-memory filtering.)

- [ ] **Step 3: Typecheck**

Run: `bun --cwd packages/api run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/features/campaigns/repository.ts
git commit -m "feat(api): patch source + campaignsForSource query"
```

---

### Task 5: Service — `createFromEntity` + `campaignsBySource`

Reuses `createDraft` → `patch` (all fields incl. source) → `publish` (which derives offer=null for banners, marks published, enqueues `send-campaign`).

**Files:**
- Modify: `packages/api/src/features/campaigns/service.ts` (after `create`, near `publish`).

- [ ] **Step 1: Add the methods**

Add to `CampaignsService`:

```ts
  /**
   * Create + publish a once-mode announcement for an entity in one call. The
   * caller (e.g. the banner wizard's Difusión step) supplies seeded content;
   * we patch the draft directly then reuse `publish` for dispatch. Trusts the
   * client's "entity is published" guard (no cross-feature status check).
   */
  async createFromEntity(
    orgId: string,
    userId: string,
    input: CreateFromEntityInput,
  ): Promise<CampaignStateResult> {
    const draft = await this.repo.createDraft(orgId, userId);
    await this.repo.patch(orgId, draft.id, {
      name: input.name,
      message: { push: input.push },
      channelPriority: input.channelPriority,
      linkUrl: input.linkUrl ?? null,
      audienceFilter: input.audienceFilter ?? null,
      scheduledAt: input.scheduledAt ?? null,
      mode: "once",
      source: input.source,
    });
    return this.publish(orgId, draft.id);
  }

  campaignsBySource(
    orgId: string,
    source: CampaignSourceInput,
  ): ReturnType<CampaignsRepository["campaignsForSource"]> {
    return this.repo.campaignsForSource(orgId, source);
  }
```

- [ ] **Step 2: Add imports**

Ensure `service.ts` imports the new types from `./schemas`:

```ts
import type { CreateFromEntityInput, CampaignSourceInput } from "./schemas";
```

(Add to the existing `./schemas` import group; do not duplicate the import line.)

- [ ] **Step 3: Typecheck**

Run: `bun --cwd packages/api run typecheck`
Expected: PASS. If `publish`'s `canPublish` rejects, verify the patch set `name` + `message.push` + `channelPriority` (the three fields `campaignWizard.state` needs).

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/features/campaigns/service.ts
git commit -m "feat(api): campaigns.createFromEntity + campaignsBySource service"
```

---

### Task 6: Router — wire the two procedures

**Files:**
- Modify: `packages/api/src/features/campaigns/router.ts`

- [ ] **Step 1: Import the new schemas**

Add to the `./schemas` import block:

```ts
  createFromEntityInputSchema,
  campaignsBySourceInputSchema,
```

- [ ] **Step 2: Add the procedures**

Inside `campaignsRouter`, after `publish`:

```ts
  createFromEntity: managerProcedure
    .input(createFromEntityInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).createFromEntity(await requireOrg(), ctx.session.user.id, input),
    ),
  campaignsBySource: managerProcedure
    .input(campaignsBySourceInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).campaignsBySource(await requireOrg(), input),
    ),
```

- [ ] **Step 3: Typecheck + test the whole package**

Run: `bun --cwd packages/api run typecheck && bun --cwd packages/api run test`
Expected: PASS. (If `campaigns.test.ts` fails to compile on the `base` literal, that's Task 7 — but you added `source` to the type in Task 1, so add `source: null` to `base` now if the failure appears here.)

- [ ] **Step 4: Restart the API Worker** (bundle does not hot-reload on `@loyalty/api` src changes)

```bash
rm -rf apps/api/.wrangler apps/api/.turbo
# then in the Worker terminal: bun --cwd apps/api run dev
```

Probe: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/trpc/campaigns.createFromEntity` → `401` (procedure exists, unauthorized) not `404` (stale bundle).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/features/campaigns/router.ts
git commit -m "feat(api): wire createFromEntity + campaignsBySource routes"
```

---

### Task 7: Fix the campaigns unit-test fixture

Adding a column widens `CampaignRow`; the `base` literal must set it.

**Files:**
- Modify: `packages/api/src/features/campaigns/__tests__/campaigns.test.ts`

- [ ] **Step 1: Add `source: null` to `base`**

In the `base: CampaignRow` literal, next to `offer: null,` add:

```ts
  source: null,
```

- [ ] **Step 2: Run the full campaigns test**

Run: `bun --cwd packages/api run test`
Expected: PASS (all existing + the 3 `bannerAnnounceDefaults` tests).

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/features/campaigns/__tests__/campaigns.test.ts
git commit -m "test(api): source field in campaign fixture"
```

---

### Task 8: Shared `AnnounceComposer` component

A controlled composer reused by every entity. Phase 1 wires it into the banner wizard; later phases reuse it verbatim.

**Files:**
- Create: `apps/admin/src/features/campaigns/components/announce-composer.tsx`

- [ ] **Step 1: Define the value type + component**

Create the file. It is **controlled** (`value` + `onChange`) and shows a live recipient count via `campaigns.countReach`. Match admin control sizing (`h-10`) and the existing campaign wizard's channel chips / audience preset.

```tsx
"use client";

import { Input, Label, Switch, Textarea } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

export type AnnounceValue = {
  enabled: boolean;
  title: string;
  body: string;
  channels: string[]; // ordered priority; push default-on
  audience: "all" | "tier"; // Phase 1 presets
  when: "now" | "schedule";
  scheduledAt?: Date;
};

const CHANNELS = ["push", "email", "whatsapp"] as const;

export function announceInitial(seed: { title: string; body: string }): AnnounceValue {
  return {
    enabled: false,
    title: seed.title,
    body: seed.body,
    channels: ["push"],
    audience: "all",
    when: "now",
  };
}

export function AnnounceComposer({
  value,
  onChange,
  disabled,
  disabledReason,
}: {
  value: AnnounceValue;
  onChange: (v: AnnounceValue) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const t = useTranslations("Campaigns.announce");
  const trpc = useTRPC();
  const set = (patch: Partial<AnnounceValue>) => onChange({ ...value, ...patch });

  const reach = useQuery({
    ...trpc.campaigns.countReach.queryOptions({
      audienceFilter: value.audience === "all" ? undefined : { tiers: ["oro"] },
      channelPriority: value.channels,
    }),
    enabled: value.enabled && !disabled,
  });

  if (disabled) {
    return <p className="text-muted-foreground text-sm">{disabledReason}</p>;
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3">
        <Switch checked={value.enabled} onCheckedChange={(c) => set({ enabled: c })} />
        <span className="text-sm font-medium">{t("toggle")}</span>
      </label>

      {value.enabled && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("title")}</Label>
            <Input
              className="h-10"
              maxLength={80}
              value={value.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("body")}</Label>
            <Textarea
              className="min-h-20"
              maxLength={180}
              value={value.body}
              onChange={(e) => set({ body: e.target.value })}
            />
            <p className="text-muted-foreground text-xs">{t("linkHint")}</p>
          </div>

          <div className="space-y-1.5">
            <Label>{t("channels")}</Label>
            <div className="flex gap-2">
              {CHANNELS.map((ch) => {
                const on = value.channels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() =>
                      set({
                        channels: on
                          ? value.channels.filter((c) => c !== ch)
                          : [...value.channels, ch],
                      })
                    }
                    className={`h-10 rounded-full border px-4 text-sm font-medium ${
                      on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    {t(`channel.${ch}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("audience")}</Label>
            <div className="flex gap-2">
              {(["all", "tier"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => set({ audience: a })}
                  className={`h-10 rounded-full border px-4 text-sm ${
                    value.audience === a ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  {t(`aud.${a}`)}
                </button>
              ))}
            </div>
            {reach.data ? (
              <p className="text-muted-foreground text-xs">
                {t("reach", { n: reach.data.audience })}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: the `tier` preset uses `{ tiers: ["oro"] }` as a Phase-1 stand-in; when the composer graduates to full segmentation, swap in the campaign wizard's audience UI. `Switch` is a `@loyalty/ui` primitive — if it is not exported, use the existing `checkbox`/toggle used in the campaign wizard (grep `apps/admin/src/features/campaigns` for the current toggle) rather than inventing one.

- [ ] **Step 2: Typecheck the admin app**

Run: `bun --cwd apps/admin run typecheck`
Expected: PASS. Fix any `@loyalty/ui` import that isn't exported (check `packages/ui/src/index.ts`).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/features/campaigns/components/announce-composer.tsx
git commit -m "feat(admin): shared AnnounceComposer for entity announcements"
```

---

### Task 9: Banner wizard "Difusión" step + best-effort finish

The step is **client-only** (it does not persist to the banner draft). It sits after `schedule`, before the final review/publish. On Finish: publish the banner first (existing behavior), then — if the announce toggle is on and the banner is published — call `campaigns.createFromEntity`, surfacing failures without blocking.

**Files:**
- Create: `apps/admin/src/features/campaigns/lib/banner-announce.ts`
- Modify: `apps/admin/src/features/banners/components/banner-wizard.tsx`

- [ ] **Step 1: Client seed helper**

Create `apps/admin/src/features/campaigns/lib/banner-announce.ts`:

```ts
import { announceInitial, type AnnounceValue } from "../components/announce-composer";

type BannerLike = {
  slug: string;
  name: string;
  shortDescription?: string | null;
  ctaHref?: string | null;
  displayFrom?: Date | string | null;
};

const GENERIC_BODY = "¡No te lo pierdas! Toca para ver más.";

/** Compute the link the announcement's short link points at. */
export function bannerLinkUrl(b: BannerLike): string {
  return (b.ctaHref ?? "").trim() || `/banner/${b.slug}`;
}

/** Seed the composer's initial value from a banner. */
export function bannerAnnounceInitial(b: BannerLike): AnnounceValue {
  const base = announceInitial({
    title: b.name.slice(0, 80),
    body: ((b.shortDescription ?? "").trim() || GENERIC_BODY).slice(0, 180),
  });
  const from = b.displayFrom ? new Date(b.displayFrom) : null;
  const future = from != null && from.getTime() > Date.now();
  return future ? { ...base, when: "schedule", scheduledAt: from! } : base;
}
```

(Mirrors the server-side `bannerAnnounceDefaults`; kept client-side so the wizard can seed before saving. DRY note: both derive the same title/body/link rules — if they drift, treat the server helper as canonical.)

- [ ] **Step 2: Add the step to `STEPS` and render it**

In `banner-wizard.tsx`:

1. Add `"difusion"` to the `STEPS` array immediately before the final review/publish step (grep the file for the `STEPS` definition near line 40).
2. Add local state near the other `useState` hooks:

```tsx
const [announce, setAnnounce] = useState<AnnounceValue | null>(null);
// seed once the banner row is loaded/created:
useEffect(() => {
  if (banner && announce === null) setAnnounce(bannerAnnounceInitial(banner));
}, [banner, announce]);
```

3. In `valid`, mark `difusion: true` (always satisfiable — the toggle is optional).
4. In the step-render switch, render for `difusion`:

```tsx
{step === "difusion" && announce && (
  <AnnounceComposer
    value={announce}
    onChange={setAnnounce}
    disabled={willBeDraft}
    disabledReason={t("announce.needsPublish")}
  />
)}
```

where `willBeDraft` is `true` only if the wizard has an explicit "save as draft" exit that leaves `status !== "published"`. In the standard flow Finish publishes the banner, so `willBeDraft = false`. If no draft-exit exists, hardcode `const willBeDraft = false;`.

5. `persistStep()` for `difusion` is a **no-op** (return `true`) — nothing to save to the banner draft.

- [ ] **Step 3: Fire the announcement on Finish**

In the Finish handler (where `publishMut.mutateAsync({ id: bannerId })` runs), after the banner publish succeeds add:

```tsx
if (announce?.enabled) {
  try {
    await createFromEntityMut.mutateAsync({
      source: { scope: "banner", id: bannerId },
      name: `${banner!.name}`,
      push: { title: announce.title, body: announce.body },
      channelPriority: announce.channels.length ? announce.channels : ["push"],
      linkUrl: bannerLinkUrl(banner!),
      audienceFilter: announce.audience === "all" ? undefined : { tiers: ["oro"] },
      scheduledAt: announce.when === "schedule" ? announce.scheduledAt : undefined,
    });
    toast.success(t("announce.launched"));
  } catch {
    // Banner is already saved — announcement is additive, never blocks.
    toast.error(t("announce.failed"));
  }
}
```

Wire the mutation near the other mutations:

```tsx
const createFromEntityMut = useMutation(trpc.campaigns.createFromEntity.mutationOptions());
```

Add imports at the top: `AnnounceComposer`, `type AnnounceValue` from `@/features/campaigns/components/announce-composer`; `bannerAnnounceInitial`, `bannerLinkUrl` from `@/features/campaigns/lib/banner-announce`; and `useEffect` if not already imported.

- [ ] **Step 4: Typecheck**

Run: `bun --cwd apps/admin run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/features/banners/components/banner-wizard.tsx apps/admin/src/features/campaigns/lib/banner-announce.ts
git commit -m "feat(admin): banner wizard Difusión step + best-effort announce"
```

---

### Task 10: Banner detail — "Campañas de este banner"

**Files:**
- Modify: `apps/admin/src/features/banners/components/banner-detail-view.tsx`

- [ ] **Step 1: Add the list block**

In `banner-detail-view.tsx`, add a section that queries campaigns spawned by this banner and links each to its campaign detail. It is a client component (reflects mutations); use `useQuery`.

```tsx
const campaigns = useQuery(
  trpc.campaigns.campaignsBySource.queryOptions({ scope: "banner", id: banner.id }),
);
```

Render below the existing detail content:

```tsx
<section className="bg-card border-border rounded-3xl border p-5">
  <h3 className="font-display mb-3 text-sm font-semibold">
    {t("campaigns.title", { n: campaigns.data?.length ?? 0 })}
  </h3>
  {campaigns.data && campaigns.data.length > 0 ? (
    <ul className="divide-border divide-y">
      {campaigns.data.map((c) => (
        <li key={c.id} className="flex items-center justify-between py-2">
          <Link href={`/campaigns/${c.id}`} className="text-sm hover:underline">
            {c.name ?? t("campaigns.untitled")}
          </Link>
          <span className="text-muted-foreground text-xs">{t(`campaigns.status.${c.status}`)}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-muted-foreground text-sm">{t("campaigns.empty")}</p>
  )}
</section>
```

Use `Link` from `@/i18n/navigation` (never `next/link`). Confirm the campaign detail route key is `/campaigns/[id]` (grep `apps/admin/app/[locale]` for the campaigns detail folder); adjust the href to the real route key.

- [ ] **Step 2: Typecheck**

Run: `bun --cwd apps/admin run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/features/banners/components/banner-detail-view.tsx
git commit -m "feat(admin): list a banner's announcement campaigns on its detail"
```

---

### Task 11: i18n keys (es + en)

next-intl **throws** on missing keys — every key used above must exist in both files.

**Files:**
- Modify: `apps/admin/messages/es.json`
- Modify: `apps/admin/messages/en.json`

- [ ] **Step 1: Add the `Campaigns.announce` + banner keys (es)**

Under `Campaigns` add an `announce` object, and under the banner namespace add the `campaigns` list keys. `apps/admin/messages/es.json`:

```json
"announce": {
  "toggle": "Anunciar este banner",
  "title": "Título",
  "body": "Mensaje",
  "linkHint": "Se agrega un enlace corto al final que lleva al destino del banner.",
  "channels": "Canales",
  "channel": { "push": "Push", "email": "Email", "whatsapp": "WhatsApp" },
  "audience": "Audiencia",
  "aud": { "all": "Todos", "tier": "Por nivel" },
  "reach": "≈ {n} personas",
  "needsPublish": "Publicá el banner para poder anunciarlo.",
  "launched": "Anuncio lanzado 🎉",
  "failed": "Banner guardado ✓ — no pudimos lanzar el anuncio. Reintentá desde el banner."
}
```

And in the banner namespace (find where banner detail strings live, e.g. `Banners`):

```json
"campaigns": {
  "title": "Campañas de este banner ({n})",
  "empty": "Todavía no anunciaste este banner.",
  "untitled": "Sin nombre",
  "status": { "draft": "Borrador", "published": "Publicada" }
}
```

- [ ] **Step 2: Add the English mirror (en)**

`apps/admin/messages/en.json`, same structure:

```json
"announce": {
  "toggle": "Announce this banner",
  "title": "Title",
  "body": "Message",
  "linkHint": "A short link to the banner's destination is appended automatically.",
  "channels": "Channels",
  "channel": { "push": "Push", "email": "Email", "whatsapp": "WhatsApp" },
  "audience": "Audience",
  "aud": { "all": "Everyone", "tier": "By tier" },
  "reach": "≈ {n} people",
  "needsPublish": "Publish the banner to announce it.",
  "launched": "Announcement sent 🎉",
  "failed": "Banner saved ✓ — we couldn't launch the announcement. Retry from the banner."
}
```
```json
"campaigns": {
  "title": "Campaigns for this banner ({n})",
  "empty": "You haven't announced this banner yet.",
  "untitled": "Untitled",
  "status": { "draft": "Draft", "published": "Published" }
}
```

Also add a banner wizard step label `step.difusion` → `"Difusión"` (es) / `"Announce"` (en) wherever the other `step.*` banner labels live.

- [ ] **Step 3: Verify both files parse**

Run: `bun --cwd apps/admin run typecheck` and open the wizard/detail in the running admin to confirm no `IntlError`.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/messages/es.json apps/admin/messages/en.json
git commit -m "feat(admin): i18n for banner announce + campaigns list"
```

---

### Task 12: Manual verification + full validate

- [ ] **Step 1: Bring the stack up**

```bash
bun run dev:services            # libSQL + redis
bun --cwd apps/api run dev       # Worker :8787 (fresh bundle — see Task 6 Step 4)
bun --cwd apps/admin run dev     # admin :3003
bun run jobs:dev                 # Trigger.dev dev — REQUIRED or nothing sends
```

- [ ] **Step 2: Exercise the happy path**

1. Admin → Banners → create a banner with a `ctaHref` (e.g. `/promos/2x1`), a short description, and an image. Reach the **Difusión** step.
2. Toggle **Anunciar** on → confirm push is on, title/body seeded, live reach count shows, "Ahora" selected.
3. Finish → banner publishes → toast "Anuncio lanzado". In the `jobs:dev` console see one `push` log line per recipient (all providers are `log` in dev). `campaign_send` rows exist.
4. Open the banner's detail → "Campañas de este banner (1)" links to the campaign; its funnel shows **Enviados** (and **Clic** after you `curl` the minted short link, no **Canjeados** — banners aren't canjeable).
5. Create a **draft** banner (if a draft-exit exists) → the Difusión step shows the disabled "Publicá el banner…" note.
6. Edit the published banner → the Difusión step reappears with the toggle **off** and shows the existing campaign count; re-announcing creates a second campaign.

- [ ] **Step 3: Force a failure (best-effort proof)**

Temporarily stop the Worker mid-finish (or point the admin at a dead API URL), finish with announce on → confirm the **banner still saved** and the toast reads "Banner guardado ✓ — no pudimos lanzar el anuncio". Restore the Worker.

- [ ] **Step 4: Full validate suite**

Run: `bun run lint && bun run typecheck && bun run test`
Expected: all PASS. Fix knip/lint fallout (unused exports, etc.) before finishing.

- [ ] **Step 5: Final commit (if any fixes)**

```bash
git add -A
git commit -m "chore: lint/typecheck fixes for banner announce"
```

**Do NOT push or open the PR** — everything stays local until Johan explicitly asks (each Vercel push burns deploys). This feature rides the existing `feat/unified-communication-hub` branch.

---

## Self-Review

**Spec coverage:**
- Embedded "Difusión" step in the banner wizard → Task 9. ✅
- Composer minimal → publishes/schedules on Finish → Task 5 (`createFromEntity` calls `publish`), Task 9 (finish hook). ✅
- Push default-on, email/wa off; seed title/body/image/`{{short_link}}`; audience Todos → Tasks 3, 8, 9. ✅
- Link = `ctaHref` ?? `/banner/<slug>` → Task 3 (`bannerAnnounceDefaults`) + Task 9 (`bannerLinkUrl`). ✅
- Guard: only when banner published; schedule follows display window → Task 9 (`willBeDraft` disable + `bannerAnnounceInitial` future `displayFrom` → schedule). ✅
- Funnel Enviados → Clic, no Canjeados → inherent (offer stays null; `deriveOffer` finds no token). ✅
- Traceability `campaign.source {scope,id}` reused by later phases → Tasks 1, 2, 4, 5. ✅
- Failure: banner commits first, announce best-effort + retry via toast; step also on edit, off by default, shows prior count → Task 9 (try/catch after publish) + Task 10 (count). ✅
- Consolidated endpoint, reuse-not-duplicate composer, live count via existing `countReach`, "Avanzado = abrir/duplicar" (published once is read-only) → Tasks 5, 8; the read-only nuance is respected (no in-place edit offered). ✅

**Placeholder scan:** No TBD/TODO; every code step has concrete code. Two intentional grep-and-confirm points (banner `STEPS` location, campaign detail route key) are explicit verification steps, not placeholders.

**Type consistency:** `CampaignSource` (Task 1) ↔ `campaignSourceSchema` (Task 2) ↔ `source` in `CampaignPatch`/`campaignsForSource` (Task 4) ↔ `input.source` in `createFromEntity` (Task 5). `AnnounceValue` + `announceInitial` (Task 8) ↔ consumed in Task 9. `bannerAnnounceDefaults` (server, Task 3) mirrors `bannerLinkUrl`/`bannerAnnounceInitial` (client, Task 9) — flagged as intentional DRY-with-canonical-server note.

**Risk to watch during execution:** `publish` requires `canPublish` — the Task 5 patch must set `name`, `message.push`, and `channelPriority` or publish throws; verified those are the three fields `campaignWizard.state` gates on.
