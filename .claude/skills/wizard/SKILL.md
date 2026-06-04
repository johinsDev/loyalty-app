---
name: wizard
description: Server-driven multi-step "wizard" pattern for the loyalty-app monorepo — the iterator sibling of the `filters` pattern. A `Wizard`/`WizardStep` engine in @loyalty/api drives create/edit flows (segment → products → … → publish) where the backend owns the step sequence, gating and validation, the entity is saved as a draft from step 1 (entity-as-draft), and the FE just renders whatever step the server reports. Use when building any admin multi-step create/edit flow (promos, campaigns, onboarding), adding a step, or wiring the FE stepper. Promociones is the worked reference.
---

# Wizard — server-driven multi-step create/edit

Lots of admin flows are multi-step configuration wizards. The weak way is "a
backend that supports everything + a FE that owns the sequence and posts data" —
the order, gating and per-step validation leak into the FE. This pattern flips
it: a generic **`Wizard`** (the iterator sibling of `_shared/filters.ts`) where
each **`WizardStep`** is a class owning its schema + gate + completeness +
persistence, and the **backend owns the sequence**. The FE reads state and
renders `state.current` — nothing more.

**Reference implementation:** Promociones — DB `promo` table, API
`packages/api/src/features/promotions/`, admin UI
`apps/admin/src/features/promotions/`, primitive `@loyalty/ui` `<Stepper>`.

## The four decisions (and what we chose)

1. **Persistence: entity-as-draft.** The real table (`promo`) carries
   `status: "draft" → "published"` with nullable domain columns; each step fills
   real columns; `publish` validates everything + flips status. No separate draft
   table, no JSON projection. **The current step is derived from completeness, not
   stored.**
2. **Control: server-driven.** API is `create → getState → advance(step,input) →
   publish`. The FE never decides the order.
3. **Per-step validation that connects to services.** Each step has its own Zod
   schema and a `WizardContext` (`db`, `organizationId`, `userId`, `services`) so
   it can validate against sibling services.
4. **Shared Zod.** Step schemas live in the API feature and are re-exported from
   `@loyalty/api`; the FE forms import the *same* schema (zod skill).

## The engine — `packages/api/src/features/_shared/wizard.ts`

```ts
abstract class WizardStep<TDraft, TInput, TServices> {
  abstract readonly key: string;
  abstract readonly schema: ZodType<TInput>;
  canEnter(draft): boolean = true;          // gate / precondition
  abstract isComplete(draft): boolean;       // derived from the row's columns
  abstract persist(ctx, draft, input): Promise<TDraft>; // writes its slice via ctx.services
}

class Wizard<TDraft, TServices> {
  state(draft): { order, completed[], current, canPublish }  // the iterator
  advance(ctx, draft, key, rawInput): { draft, state }        // gate → zod → persist
}
```

`state()` is the iterator: `current` = the first step that `canEnter && !isComplete`,
or `"review"` once all complete. `advance()` runs the gate (`PRECONDITION_FAILED`),
then `schema.safeParse` (`BAD_REQUEST` with the ZodError as `cause` → the existing
tRPC errorFormatter surfaces `zodError`), then `persist`. Covered by
`_shared/__tests__/wizard.test.ts`.

> **`override`**: `canEnter` has a default impl, so a step that overrides it needs
> the `override` keyword (the repo sets `noImplicitOverride`). `isComplete`/`persist`
> are abstract — no `override`.

## A step — `features/promotions/steps.ts`

```ts
export class ProductsStep extends WizardStep<PromoRow, ProductsStepInput, PromoStepServices> {
  readonly key = "products";
  readonly schema = productsStepSchema;
  override canEnter(d) { return d.name != null && d.segmentId != null; } // gated behind segment
  isComplete(d) { return Array.isArray(d.productIds) && d.productIds.length > 0; }
  persist(ctx, d, input) { return ctx.services.repo.patch(ctx.organizationId, d.id, { productIds: input.productIds }); }
}
```

`promoWizard = new Wizard([new SegmentStep(), new ProductsStep(), new BrandingStep(), new ScheduleStep()])`
— the array order **is** the sequence.

## Service + router

`PromoService` (`service.ts`) owns the lifecycle: `create` (insert a `draft` row),
`getState` (load → `promoWizard.state`), `advance` (load → `promoWizard.advance`),
`publish` (load → assert `state.canPublish` else `PRECONDITION_FAILED` → flip
status). Every read/write is `organizationId`-scoped so a draft can't cross
tenants. `router.ts` exposes them on `managerProcedure` and the feature registers
as `promociones` in `_app.ts`. Same `router → service → repository` layering as
`whatsapp-outbox` — the only layer touching Drizzle is the repository.

## Frontend — `apps/admin/src/features/promotions/`

- The draft **id lives in the URL** (`/promotions/[id]`) — no client store needed;
  the server `getState` query is the source of truth (server-driven → nothing to
  duplicate). The **list** page `/promotions` (RSC `list`) has a "New" button that
  `create`s a draft + redirects to its `[id]`; **resume** any draft by opening its
  `[id]`. A nav entry (gated to manager+) points at `/promotions`.
- `components/promo-wizard.tsx` — given an `id`, loop `getState` → `<Stepper>` +
  the step component for `state.current` → `advance` → invalidate `getState`, and
  `publish` when `state.current === "review"`.
- `components/steps/*` — one form per step. **Shared-schema steps** (segment,
  branding) reuse the API Zod via `zodResolver`; import it from the **client-safe
  subpath** `@loyalty/api/features/promotions/schemas` — **never** the main
  `@loyalty/api` barrel, which transitively loads `@trpc/server` and throws
  *"@trpc/server in a non-server environment"* in the browser (the schemas file
  is pure Zod). `import type` from the barrel is fine — types are erased.
  **Adapter steps** (products as CSV, schedule as `datetime-local`) keep a local
  form shape and map on submit — the server still validates with the real step schema.
- `@loyalty/ui` `<Stepper>` is presentational: it renders `current` + `completed`
  from props and never decides order.

## Add a new wizard (the recipe)

1. DB: a table with `status` + nullable domain columns (entity-as-draft), org-scoped. `bun run db:generate`.
2. `features/<name>/`: `schemas.ts` (per-step Zod), `steps.ts` (one `WizardStep` each), `wizard.ts` (`new Wizard([...])`), `repository.ts`, `service.ts`, `router.ts`, `index.ts`; register in `_app.ts`; add a **client-safe subpath export** `"./features/<name>/schemas": "./src/features/<name>/schemas.ts"` in `packages/api/package.json` so the FE can import the step schemas without dragging in `@trpc/server`.
3. Tests: a service test (`create → advance → publish` + gating) — the engine itself is already covered.
4. FE: a `list` page + an `[id]` route mounting a `<name>-wizard.tsx` container (id from the URL; `getState` is the source of truth — no client store) + step forms; add `/<name>` and `/<name>/[id]` to `i18n/routing.ts` `pathnames` and a nav entry.

## Gotchas

- **Derive, don't store, the current step.** `isComplete` reads columns; if you
  add a step, completeness + ordering update for free.
- **Adapter vs shared schema.** Reuse the step schema with `zodResolver` only when
  the form shape == the wire shape; otherwise map on submit and let the server
  validate (don't fork the schema).
- **`getState` is the source of truth.** After `advance`/`publish`, invalidate the
  `getState` query — never mirror step state in zustand.
- **DB is SQLite/Turso**, not Postgres — `text("status")`, `text(...,{mode:"json"})`,
  `crypto.randomUUID()`, integer timestamps. (See the `drizzle` skill.)

Pairs with: `api-filters` (the sibling pattern), `zod` (shared schemas),
`react-hook-form` + `ui` (forms + `<Stepper>`), `zustand` (the thin store),
`architecture-guard` (feature layout), `drizzle` (the migration).
