# T4 Loyalty — System Design

> Technical blueprint derived from [`product-scope.md`](./product-scope.md). Grounded in the
> current codebase (schema, tRPC procedures, auth roles, feature wiring, notifications/realtime).
> Drives the feature-by-feature build (phases A→D) and the UI design step (Claude Design over `@loyalty/ui`).
>
> **Hard rules in play**: never hand-edit migrations (change Drizzle schema → `bun run db:generate`);
> PR-only on `main`; feature folders are `router → service → repository`; Drizzle only in repositories.

---

## 1. What changes vs. today

The loyalty domain is barely implemented — `sellos.add` only fires a realtime event (DB insert is a TODO), the customer card is a listener with no visual UI, and `clientes`/`premios` are empty stubs. So we **replace** the stamp-specific core with a generic **wallet/ledger**, rather than migrate live data.

| Today (`packages/db/src/schema/loyalty.ts`) | New |
| --- | --- |
| `loyaltyCard` (`currentStamps` cache) | `loyalty_account` (`balance` cache + `tierId`) |
| `stamp` (append-only, earn only) | `loyalty_transaction` (append-only: earn / redeem / adjust) |
| `redemption` | folded into `loyalty_transaction` (type `redeem`) + `redeem_intent` |
| `reward.stampsRequired` | `reward.cost` (balance units) |
| — | `loyalty_program` (per-org `loyaltyMode`), `product`, `tier`, `badge`, `customer_badge`, `redeem_intent`, `campaign`, `onboarding_slide` |
| `customer` (no user link) | `customer.userId` FK → `user` (binds the phone-OTP Better Auth user to the loyalty customer) |
| roles: customer/staff/manager/owner | **+ `cashier`** |

Kept as-is: `notification` + `notification_preference` (feed + opt-out), `push_token`, all outboxes, `shortlink*`, `organization`/`member`/`user`/`session`/`account`.

---

## 2. Architecture principles (existing, keep)

- **Provider-agnostic packages** (Manager/Strategy/Fake) — analytics, flags, notifications, push, sms, whatsapp, email, realtime, cache, rate-limit, storage, shortlinks. The ledger consumes them via `ctx`, never directly.
- **Feature folders**: `packages/api/src/features/<name>/{router,service,repository,schemas,index}.ts`. Drizzle lives only in `repository.ts`. Mounted in `packages/api/src/routers/_app.ts`.
- **tRPC context** (`packages/api/src/trpc.ts`): `{ db, session, headers, rateLimiter?, realtime?, storage?, analytics?, flags?, log?, captureError?, shortlinkBaseUrl?, shortlinks? }`. Optional bindings = unbound in tests/CLI, bound at app/Worker bootstrap.
- **Procedures**: `publicProcedure`, `protectedProcedure`, `staffProcedure` (STAFF_OR_ABOVE), `managerProcedure` (MANAGER_OR_ABOVE), `ownerProcedure` (OWNER_ONLY), `rateLimit({name,limit,window,by})` middleware. Roles in `member.role` via `getUserRole(userId)`.
- **Realtime** best-effort: `ctx.realtime.publish("customer:<id>", { event, data })` never blocks/rolls back the write.

### New procedures to add
In `packages/auth/src/roles.ts`: add `cashier` to `ROLES`, define `CASHIER_OR_ABOVE = [cashier, staff, manager, owner]`. In `packages/api/src/trpc.ts`:
- **`cashierProcedure`** = `enforceRole(CASHIER_OR_ABOVE)` — earn/redeem/lookup.
- **`customerProcedure`** = `protectedProcedure` + resolve `ctx.session.user.id` → `customer` row (via `customer.userId`); throws if no customer; binds `ctx.customer`. Every customer-facing read/write scopes by `ctx.customer.id` (never from input — closes the stub routers' scoping TODOs).

---

## 3. Data model (Drizzle — `packages/db/src/schema/`)

> All tables: `sqliteTable`, `id` text PK `default randomUUID()`, timestamps `integer mode:"timestamp"`. After editing, `bun run db:generate` (never hand-edit the SQL).

### Program config
**`loyalty_program`** (per-org settings) — `organizationId` (FK org, **unique**), `loyaltyMode` (`"stamps" | "points"`, default `"stamps"`), `currency` (text, default `"COP"`), `createdAt`, `updatedAt`. T4 row seeded with `stamps`.

### Wallet / ledger (core)
**`loyalty_account`** — `id`, `customerId` (FK customer, cascade), `organizationId` (FK org, cascade), `balance` (int, default 0 — denormalized cache of the ledger), `tierId` (FK tier, nullable — current tier), `status` (text, default `active`), `createdAt`, `updatedAt`. **Unique** `(customerId, organizationId)`.

**`loyalty_transaction`** (append-only — source of truth) — `id`, `accountId` (FK loyalty_account, cascade), `organizationId`, `customerId` (denormalized for queries), `type` (`"earn" | "redeem" | "adjust"`), `amount` (int — signed: +earn, −redeem, ±adjust), `balanceAfter` (int — snapshot), `rewardId` (FK reward, nullable — set on redeem), `createdByUserId` (FK user, nullable — the cashier/staff; null = system), `idempotencyKey` (text, **unique**), `reason` (text, nullable), `metadata` (text/JSON — earn product lines, promo applied, etc.), `createdAt`. Indexes: `(accountId, createdAt)`, unique `(idempotencyKey)`.

> **Never UPDATE/DELETE** a transaction. Corrections are new `adjust` rows. `balance` is recomputed in the same DB transaction as each insert.

### Catalog / menu
**`product`** — `id`, `organizationId` (FK), `name`, `description` (nullable), `category` (text, nullable), `photoUrl` (text, nullable), `price` (int, nullable — minor units), `earnsStamp` (int, default 0 — balance units granted per unit), `available` (bool, default true), `active` (bool, default true), `createdAt`, `updatedAt`. Index `(organizationId, category)`.

### Rewards
**`reward`** (modify) — keep `id`, `organizationId`, `name`, `description`, `active`; **rename `stampsRequired` → `cost`** (int, balance units); add `imageUrl` (nullable), `kind` (text, default `free_item`). Migrate existing `stampsRequired` → `cost`.

### Tiers & badges
**`tier`** — `id`, `organizationId`, `name`, `metric` (`"stamps" | "visits" | "amount"`), `threshold` (int), `windowDays` (int, nullable — null = lifetime), `benefitType` (text — `percent_off | free_item | none`), `benefitValue` (text/JSON), `rank` (int — ordering), `badgeIcon` (nullable), `active`, `createdAt`, `updatedAt`.
**`badge`** — `id`, `organizationId`, `name`, `icon`, `criteria` (text/JSON — milestone: `first_redemption | visits:N | birthday | tier:<id>`), `createdAt`.
**`customer_badge`** — `id`, `customerId` (FK cascade), `badgeId` (FK cascade), `earnedAt`. Unique `(customerId, badgeId)`.

### Identity / redemption
**`redeem_intent`** (single-use, replay-proof) — `id`, `accountId` (FK cascade), `rewardId` (FK), `nonce` (text, **unique**), `status` (`"pending" | "consumed" | "expired"`, default pending), `expiresAt` (timestamp), `consumedByUserId` (FK user, nullable), `consumedAt` (nullable), `createdAt`. The customer-side QR encodes a signed token referencing this nonce; the cashier scan consumes it atomically.

> The **identify** QR (earn) is **stateless** — a signed HMAC token `{ sub: customerId, intent: "identify", exp }`, TTL ~60s, no table. Only **redeem** needs `redeem_intent` (single-use).

### Notifications composer
**`campaign`** — `id`, `organizationId`, `segmentKey` (text), `channel` (`mail|sms|push|whatsapp`), `title`, `body`, `status` (`draft|scheduled|sent`), `scheduledAt` (nullable), `sentAt` (nullable), `stats` (text/JSON — targeted/sent/opened/redeemed), `createdByUserId` (FK), `createdAt`, `updatedAt`. Delivery reuses the `Notifier` (§7).

### Onboarding
**`onboarding_slide`** — `id`, `organizationId`, `icon`, `title`, `body`, `order` (int), `active`, `createdAt`, `updatedAt`. Index `(organizationId, order)`.

### Promos (extend existing `promo`)
Add to `promo`: `type` (`"double_stamp" | "multiplier" | "price_2x1" | "percent_off" | "free_item" | "banner"`), `effectScope` (`"stamp" | "price" | "banner"` — derived from type), `config` (text/JSON — `{ multiplier, percent, code, bannerImageUrl }`), `minimum` (int, nullable). The wizard gains a **TypeStep** before BrandingStep. `segmentId` stays a string key (§6).

### Customer profile (extend `customer`)
Add: `userId` (FK user, nullable, **unique**), `nickname` (nullable), `avatarUrl` (nullable), `birthday` (timestamp, nullable), `birthdayLockedAt` (timestamp, nullable — set-once lock), `marketingConsentAt` (timestamp, nullable). Keep `phone`/`email`/`name`/`(organizationId, phone)` unique.

---

## 4. Core flows

### Earn (cashier-driven, idempotent)
1. Cashier opens POS-lite → identifies customer: **scan QR** (`identity.resolveToken`) or **phone lookup** (`customers.findByPhone`).
2. Cashier marks purchased `product`s (+ optional `amount` for amount-based tiers).
3. `loyalty.earn` (`cashierProcedure`, `rateLimit` + **daily cap** check): computes balance from `Σ product.earnsStamp`, applies any active `double_stamp`/`multiplier` promo in-window, inserts one `loyalty_transaction(type:"earn")` **with the client `idempotencyKey`** + product lines in metadata, bumps `loyalty_account.balance`, re-evaluates `tierId`/badges — all in one DB transaction.
4. Best-effort: `ctx.realtime.publish("customer:<id>", { event: "stamp.earned", data: { balance, amount } })` + `ctx.analytics.capture("stamp.earned")` + fire the `StampEarnedNotification` (push/realtime/database).

### Redeem (customer initiates, cashier validates)
1. Customer taps a reward they can afford → `redemption.createIntent` (`customerProcedure`): creates `redeem_intent` (nonce, `expiresAt ~120s`) → app shows a signed QR.
2. Cashier scans → `redemption.confirm` (`cashierProcedure`): atomically checks intent `pending` + not expired + `balance ≥ reward.cost`, marks intent `consumed`, inserts `loyalty_transaction(type:"redeem", amount:−cost, rewardId)`, decrements balance. Replay-proof (nonce single-use).
3. Realtime `reward.redeemed` + `RewardRedeemedNotification`.

### Identify token (earn) & anti-fraud
- `identity.issueToken` (`customerProcedure`) → HMAC `{sub, intent, exp~60s}`; `identity.resolveToken` (`cashierProcedure`) verifies + returns the customer (phone **masked** in the response). Cashier **cannot** resolve to themselves / grant to own account (service guard).
- **Idempotency** (`loyalty_transaction.idempotencyKey`), **append-only ledger**, **per-cashier daily cap** (count today's `earn` by `createdByUserId`), **manager override** for redemptions (`managerProcedure` path) — all per scope §7.

---

## 5. tRPC API surface (feature folders)

Replace the `clientes`/`sellos`/`premios` stubs; extend `promociones`. Each is a `features/<name>/` folder mounted in `_app.ts`.

| Router (mount key) | Procedures (auth) |
| --- | --- |
| `customers` (replaces `clientes`) | `list`/`get`/`search`/`create`/`update` (staff) · `findByPhone` (cashier) · `merge` (manager — account transfer/recovery) |
| `loyalty` (replaces `sellos`) | `account.get` (customer) · `earn` (cashier, idempotent) · `transactions.list` (customer/staff) · `adjust` (manager) |
| `redemption` | `createIntent` (customer) · `confirm` (cashier) · `list` (staff) |
| `identity` | `issueToken` (customer) · `resolveToken` (cashier) |
| `rewards` (replaces `premios`) | `list`/`eligible` (customer) · `create`/`update`/`deactivate` (staff/owner) |
| `products` | `listMenu` (customer) · CRUD (staff) |
| `tiers` | `list`/`current` (customer) · CRUD (manager) |
| `badges` | `listForCustomer` (customer) |
| `promociones` (extend) | existing wizard `getState`/`advance`/`publish`/`list` + new **TypeStep**; `active` (customer — banners/promos to show) |
| `campaigns` | `create`/`schedule`/`send`/`list` (staff) |
| `segments` | `resolve(segmentKey)` (staff — returns customer ids/count) |
| `onboarding` | `list` (customer) · CRUD (staff) |
| `profile` | `get`/`update`/`setBirthday`/`uploadAvatar`/`setConsent`/`linkGoogle` (customer) |
| `dashboard` | `kpis`/`funnel` (staff — over the ledger) |

Services orchestrate; repositories hold Drizzle. `earn`/`redeem`/`adjust` run in a single `db.transaction` (insert + balance + tier/badge re-eval).

---

## 6. Cross-cutting engines

- **Promos apply-at-earn**: `PromoEngine.activeStampEffects(orgId, productIds, now)` → multiplier applied in `loyalty.earn`. Price/banner effects are **display-only** (the app emits a code; the POS honors the discount — the app does not control price). `promociones.active` returns what the customer card/banner shows.
- **Segments resolver** (`segments.resolve`): predefined keys → SQL over the ledger: `all` · `new` (account age < Nd) · `lapsed:<d>` (no `earn` tx in d days) · `near_reward` (`balance ≥ minCost − k`) · `tier:<id>` · `birthday_month`. Returns customer ids. Promos + campaigns + funnel consume it. Model leaves room for a future `segment` table (custom).
- **Notifications**: reuse `Notifier.send(target, notification)` + `Notification` subclasses (`category` + `via()` + `to<Channel>()`). Fixed transactional set as classes: `WelcomeNotification`, `StampEarnedNotification`, `RewardReadyNotification`, `RedemptionConfirmedNotification`, `BirthdayNotification`, `WinBackNotification`. `category:"marketing"` respects `notification_preference` opt-out; transactional always sends. Campaign send = resolve segment → `Notifier.send` per customer over the chosen channel. whatsapp/sms gated on Twilio ONLINE.
- **Analytics/flags**: `ctx.analytics.capture("stamp.earned" | "reward.claimed" | …)`, `ctx.flags.isEnabled("new-stamp-flow", …)` to gate new surfaces during rollout. `resolveDistinctId` already unifies server/client persons.

---

## 7. Security implementation map (scope §7)

| Control | Where |
| --- | --- |
| Customer authz scoping | `customerProcedure` binds `ctx.customer` from session; all customer reads filter by `ctx.customer.id` |
| Rotating identify QR / single-use redeem | `identity.*` (HMAC, TTL~60s) + `redeem_intent` nonce (consumed atomically) |
| Idempotency / append-only | `loyalty_transaction.idempotencyKey` unique + no UPDATE/DELETE |
| Anti-fraud | `rateLimit` middleware + per-cashier daily cap (service) + `managerProcedure` override + `createdByUserId` audit |
| Cashier least-privilege | `cashier` role: earn/redeem/lookup only; phone masked in `resolveToken`/`findByPhone` responses; cannot self-grant |
| Shared-tablet | session idle timeout + shift PIN (admin app guard) |
| Multi-tenant isolation | every query filters `organizationId` (active org from session) |
| Avatar upload | `profile.uploadAvatar` via `ctx.storage` — validate type/size, **reject SVG** |
| Birthday farm | `setBirthday` honors `birthdayLockedAt` (set-once) |
| Consent (Law 1581) | `profile.setConsent` + onboarding gate; `marketingConsentAt` + `notification_preference` |
| Webhook signatures | Twilio inbound / PostHog verified at the Worker route |

Parked: self-service data export/delete portal, owner TOTP, ML fraud detection.

---

## 8. Surfaces → `@loyalty/ui` (shadcn/Base UI)

Components available: `card, badge, progress, avatar, table, tabs, dialog, drawer, sheet, stepper, sonner, input-otp, input-phone, combobox, command, select, calendar, dropzone, tooltip, skeleton, popover, switch, separator, …` (`packages/ui/src/components/ui/`).

- **Web PWA** (`apps/web`): **Card** (balance `card`+`progress`, reward catalog with `cost` + nearest-reward bar, history `table`/`tabs`) · **QR** (identity + redeem `dialog`/`drawer`) · **Menu** (`product` grid + favorites, `tabs` by category) · **Profile** (`input-phone`, `calendar` birthday, `dropzone` avatar, `switch` notif prefs) · **Onboarding** (`carousel`/slides) · **Notifications feed** + realtime `StampEarnedListener` (exists, point at `loyalty`).
- **Admin** (`apps/admin`): dashboards (`chart`/`card`), customers/products/rewards/tiers CRUD (`table`+`dialog`+`field`), promos wizard (`stepper` — add TypeStep), campaigns composer (`select` segment+channel, `calendar` schedule), onboarding slides CRUD, segments preview. Routes in `apps/admin/src/i18n/routing.ts` (English canonical folder, translated `pathnames`).
- **Cashier** (role-gated section in `apps/admin`): POS-lite mobile — scan/lookup → mark `product`s (`command`/`combobox`) → confirm earn; scan redeem intent → confirm; today's activity. `cashierProcedure` gates the routes.

UI design step = **Claude Design** (`/design-sync`) over `@loyalty/ui` once this is locked.

---

## 9. Build order (maps to scope §5 phases)

- **Phase A — Core loop**: schema (program/account/transaction/reward.cost/product/customer.userId + cashier role) + `db:generate` · `customers` + `products` + `rewards` routers · `loyalty.earn` (idempotent) · `redemption` + `redeem_intent` · `identity` · cashier surface · web Card. Flag-gate behind `new-stamp-flow`.
- **Phase B — Retention**: transactional `Notification` classes + `Notifier` wiring · `profile` (birthday/avatar/consent/Google) · `onboarding` slides CRUD + carousel.
- **Phase C — Growth**: `promo.type`/`config` + TypeStep + `PromoEngine` · banners · `segments.resolve` · `campaigns` composer · win-back job (Trigger.dev).
- **Phase D — Depth**: `tiers` + `badges` (auto-eval on earn) · menu favorites · `dashboard.kpis`/`funnel` + PostHog funnels.

Each phase = its own PR(s) following the feature-folder + PR-only flow.

---

## 10. Open decisions (resolve as we build)

- **customer↔user binding**: confirm `customer.userId` (one user ↔ one customer per org) vs. resolve-by-phone. Recommended: explicit FK + backfill.
- **Balance integrity**: trust the denormalized `loyalty_account.balance` (recomputed per tx) vs. always `SUM(amount)` — recommend cache + a periodic reconciler job.
- **Points mode rounding** (when `loyaltyMode:"points"` + amount-based) — out of pilot (T4 = stamps), but define units before flipping.
- **Daily cap + manager override UX** — exact thresholds/PIN flow with the operator (the girlfriend) before Phase A ships.
