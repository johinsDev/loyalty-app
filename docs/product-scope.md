# T4 Loyalty — Product Scope & Parking Lot

> Living document. Product source of truth. Flow:
> **grill → this doc → system design → adapt to the stack/shadcn → feature by feature.**
> Updated as we grill.

---

## 1. Locked decisions (pilot MVP)

- **Scope**: tight pilot, **single location (T4)**, **hardcoded** brand. All configurability/SaaS (per-org branding, tiers, multi-location, rules engine) is **parked**, but the repo architecture (multi-tenant org + provider-agnostic packages) already supports it without a rewrite.
- **Loyalty mechanic**: the code supports **STAMPS + POINTS** (per-org toggle, `loyaltyMode`). **T4 starts with STAMPS.** Money / mixed / configurable rules engine = **parked**.
- **Earn rule**: **per-product** — a **minimal product catalog** ships with an `earnsStamp` flag (how many stamps each grants). The cashier **selects the purchased products** and the system sums the ones that earn. Unlocks per-product promos + analytics. **Stamps-by-amount = parked.**
- **Redemption**: **customer initiates, cashier validates** — the customer taps "redeem" in the app → **single-use** code/QR → the cashier scans it to confirm and deduct the stamps. Nobody gives away a product without the register confirming.
- **QR / identity**: **signed (HMAC) + rotating token, short TTL (~60s)** encoding customerId + intent (identify / redeem reward X) + expiry. Used both to earn (identify) and to redeem (single-use). NOT a bare phone number. Expires on its own, can't be reused or forged.

### Pilot scope (the line)

**IN — T4 pilot** (build order: core loop first, then the rest):

1. **Core loop**: identify (signed QR) → earn (catalog + per-product flag) → redeem (customer initiates, cashier validates).
2. **Customer visual card** (polished, hardcoded brand): balance + eligible rewards (catalog with cost) + history.
   - **Model = WALLET / ledger**: a spendable balance (stamps or points per `loyaltyMode`) + a reward catalog with `cost` in balance units. Redeeming deducts the cost. A **transactions** table (earn / redeem / adjust) is the source of truth → balance, history, tiers and badges are all derived from it. **Replaces the current stamp-specific schema** (`loyalty_card`+`stamp`+`redemption`) with a generic ledger.
3. **Admin CRUDs**: customers · products (with `earnsStamp` flag + menu fields) · rewards (with `cost`) · stats + filters. **Filters on every list** (existing nuqs pattern).
   - **Segments**: **dynamic predefined** (all · new · lapsed Xd · near a reward · by tier · this month's birthdays), computed by the system. The model leaves the door open for **custom/hybrid** later (parked). Used by promos + campaigns + funnel.
4. **Cashier**: surface to identify/scan + mark products + confirm redemptions (magic-link, no POS). Lives as a **role-gated section inside apps/admin** (Better Auth roles/org), a mobile POS-lite screen (scan → mark products → confirm earn/redeem). Reuses auth/deploy/infra; extractable to its own app later.
5. **Notifications**: **fixed automatic transactional set** (welcome · stamp earned · reward ready · redemption confirmed · birthday · win-back 30d) **+ a campaign composer** in admin (send a campaign to a segment: pick channel + schedule). push/realtime/email channels already work; whatsapp/sms flip on once Twilio is ONLINE. NO general rules engine (parked).
6. **Promos + banners**: **configurable rule-builder** by the admin — type (`double/triple stamp`, `2x1`, `% off`, `free item`) + conditions (time window/days, products, segment, minimum). Execution split:
   - **Stamp effects** (double/triple) → **our system auto-applies** them in the earn calc during the window.
   - **Price effects** (2x1, % off, free item) → the app **defines, displays and can emit a code**; the actual discount **is honored at the POS/register** (configured separately in the POS, or by the cashier). **Boundary: the app does NOT control prices — it isn't integrated with the POS.**
   - **Banners**: content (a promo or just a banner "try the new drinks") + schedule + segment + view/click tracking.
7. **Profile (lite)**: name · birthday · avatar · nickname · notification prefs (per-channel opt-in/out) · connect/disconnect Google. (All IN.)
8. **Configurable onboarding**: slides (icons + text) on first launch, **admin-editable from day 1** (CRUD: icon + title + text + order).
9. **Tiers + badges**: levels → benefit (e.g. % off) + badges. **Rule configurable by the admin**: metric (`stamps` | `visits` | `amount`) + threshold + window (e.g. /month) + benefit. This means the cashier checkout stores an **optional `amount`** per transaction (only used/asked if the org picks amount-based tiers). It's bounded config, NOT a general rules engine. **Badges** = cosmetic, auto-earned from tiers + milestones (first redemption, X visits, birthday), shareable (NOT admin-configurable in the pilot).
10. **Menu (with favorites)**: the customer browses the menu (reuses the product catalog) and marks favorites. Menu fields: **category + photo + description + price** (price maintained by hand, no POS). NO community / most-voted / customize-and-share (parked).
11. **Admin analytics**: **core dashboards over the ledger** (active customers · stamps given · redemptions · top products · return rate · campaign→open→redeem funnel) **+ PostHog** (already wired) for product events/clicks/funnels. No configurable BI (parked).
12. **Anti-fraud (full in the pilot)**: audit log of who granted each stamp/redemption (`addedByUserId`) + realtime confirmation to the customer + **rate-limit on earn** + **per-cashier daily cap** + **manager override for redemptions**.
13. **`loyaltyMode`**: T4 = `stamps`, per-org (seed/admin). **Reward catalog UX**: balance + each reward with its `cost` + a "X to go until [nearest affordable reward]" progress bar.

**PARKED — post-pilot**: gamification (spin wheel, scratch-and-win) · mood AI + AI for content · menu **community** (most-voted, customize+share, item reviews) · social (IG/TikTok/Maps, reviews) · multi-location · per-org configurable branding · wallet pass · referrals · streaks · stamp expiry · employee ranking + quizzes · impersonation · RFM.

---

## 2. Current repo state (audit)

**Exists (real):** auth (customer phone-OTP+Google / admin magic-link) · multi-channel notifications + feed + preferences · push · shortlinks · outboxes · promo wizard (segment→products→branding→schedule, **no type**) · realtime (stamp.earned).
**Half-done:** add stamp (only fires realtime, **DB insert = TODO**) · customer card (listener only, no visual UI) · profile (push only).
**Placeholder:** admin customers, rewards CRUD.
**Absent:** **reward redemption** · products/catalog · locations · tiers · real segments · cashier · configurable branding · customer onboarding · gamification · AI · events/analytics table.

---

## 3. Parking lot (ideas — founder's + mine)

### Customer (PWA)
- Key = phone. Show a QR (= masked phone) or give the phone at the register.
- A "my stamps/points" section, polished, modern, on-brand (hardcoded now; configurable later).
- Purchase history + what they've won.
- Profile: birthday, connect/disconnect Google, email, notifs, avatar, name, nickname.
- Configurable stamp card (bg, stamp, gift-stamp) + the customer adds a nickname/personalization to their card/wallet.
- Promos: view promos (2x1 by time, every Monday, double points, free topping).
- Banners (promos or just a banner: "try the new drinks").
- Menu + menu favorites + customize and share with the community + "most voted" + "most ordered".
- Reviews/comments on menu items.
- Configurable onboarding (icons, per-slide text).
- View locations (multi-location).
- Leave a Google review from the app.

### Admin
- CRUDs: customers, products, rewards, store basics (hours, location, multiple), sales.
- Configurable promos + types (2x1, double-points, free topping, % off).
- Configurable banners (promo or just a banner).
- Configurable notifs: scheduled / by event / by segment / with periodicity.
- Sales funnel: who redeems, who doesn't, notifs, promos that sell.
- Stats + filters for EVERYTHING (fast search over any model).
- Configurable branding (logo, colors, templates).
- Configurable customer onboarding.
- Connect social (IG/TikTok/Maps): publish, ads, see review conversion, automate.
- Impersonate customer or employee (support/debug).

### Cashier
- Managed by admin, auth = **email magic-link** (no direct POS integration).
- Flow: enter phone **or** scan QR → load stamps/product/price by flow/product/price.

### Gamification
- Spin wheel after a large amount → win something.
- Scratch-and-win.
- Configurable tiers (e.g. $500k/month → 10% off always) + badges + shareables.

### AI
- "Mood AI": questions → recommend a drink (local AI).
- AI that helps the admin create banners / promos / in-app notifs.

### Employees
- Employee ranking (who performs well) — uses `addedByUserId`, already recorded.
- Quizzes/tests to memorize recipes + customer-service recall + records/scans.

---

## 4. Ideas + improvements I'm adding

### Loyalty / retention (high value, cheap)
- **Birthday reward** (automatic free drink) — ties the profile's birthday field to a reward.
- **Referrals** ("bring a friend, both +stamps") — cheap viral growth.
- **Lapsed win-back** (no visit in 30d → push with a promo) — reuses segments + notifs.
- **"1 stamp to go" nudge** (push when close to a reward).
- **Stamp/point expiry** (expire after N months) → urgency + caps accounting liability.
- **Streak** (visit N weeks in a row → bonus).
- **Onboarding incentive** (signup → first stamp free).
- **Post-redemption feedback/NPS.**

### Cashier / anti-fraud (IMPORTANT — a stamp = money)
- **Signed/rotating QR, NOT the bare phone**: a bare phone in the QR can be spoofed/screenshotted/reused. Better a short signed (HMAC) token that rotates → can't be reused or forged. _(design improvement over the "QR = masked phone" idea)_
- **Rate-limit + audit of stamp-adds** (`addedByUserId` already exists); per-cashier daily cap; **manager override** for redemptions.
- **Realtime confirmation on the customer's phone** (realtime already wired) = anti-fraud proof the stamp was credited.

### Admin / insights
- **RFM segments** (recency/frequency/monetary) to auto-target promos.
- **Cashier accountability** (who granted stamps/redemptions) → feeds the employee ranking.

### UX (phase 2)
- **Wallet pass** (Apple/Google Wallet) — the card in the native wallet.

### Risks / reality of some ideas (to keep in mind)
- **"Leave a Google review from the app"**: Google does **not** allow posting reviews via API (against policy). The legit path: **deep-link** to the business's review page. ✅ feasible that way.
- **Auto-posting to IG/TikTok**: the APIs are restrictive (IG Graph API only for business accounts + Meta review; TikTok very limited). Feasible but with friction → **late phase**.
- **Mood AI + AI for content**: viable with Claude (the stack is already built for Claude) → **phase 2**.

---

## 5. Build sequence (phases — core loop first)

- **Phase A — Core loop**: ledger model (account + transactions + reward catalog with `cost`) · product catalog + `earnsStamp` · cashier surface (identify by signed QR → mark products → earn) · redemption (customer initiates → single-use signed code → cashier confirms → redeem) · customer visual card (balance + rewards + history) · customers CRUD.
- **Phase B — Retention**: transactional notifs (welcome/stamp/reward ready/redemption/birthday) over push+realtime+email · profile lite · onboarding slides.
- **Phase C — Growth**: promos rule-builder (stamp effects auto + price effects display/POS) + banners · predefined segments · campaign composer · win-back.
- **Phase D — Depth**: tiers + badges · menu (catalog + favorites) · core dashboards + PostHog funnels.

## 6. Resolved knots (round 1 — all closed)

- ✅ **Tier benefit**: informational — the cashier sees the tier on identify and applies the % at the POS.
- ✅ **Onboarding**: admin-editable from day 1 (slides CRUD).
- ✅ **Profile lite**: name · birthday · avatar · nickname · notif prefs · Google (all).
- ✅ **Menu**: category + photo + description + price over the product catalog.
- ✅ **Reward catalog UX**: balance + rewards with `cost` + progress bar to the nearest reward.
- ✅ **`loyaltyMode`**: T4 = `stamps`, per-org.
- ✅ **Anti-fraud**: full (audit + rate-limit + daily cap + manager override).

**For the system design (next step)**: from this doc, generate the technical design — data model (ledger: account/transaction/reward/tier/badge/product/promo/segment/onboarding-slide), tRPC routers per feature, surfaces (web card · admin CRUDs · cashier role · campaigns), and map each thing to shadcn/Base-UI. Then feature by feature following phases A→D in §5.

---

## 7. Security & compliance

> Principle: **the balance is money** and we handle **real personal data** (Colombia, Law 1581/2012 Habeas Data). Security is not optional even for a single location.

### Per actor
- **Customer (PWA, phone-first)**: phone-OTP with **anti SMS-bombing rate-limit** + no account enumeration (don't reveal whether a phone exists). **QR/redeem = rotating HMAC token, TTL~60s, single-use** (already decided). **Strict authz**: a customer never reads another's balance/profile — every query scoped by a `customerId` derived from the session, never from input. Minimal PII (phone, birthday, email) — **close the scoping TODOs** in the stub routers. **Account recovery**: the phone is the key → linking Google serves as recovery if the number changes (see §8).
- **Cashier (staff, shared tablet)**: magic-link + **minimal `cashier` role** (earn/redeem/lookup; does NOT edit catalog/rewards nor see full PII). **Shared tablet = risk** → **auto-logout + shift PIN**. **Masked phone** in the register UI. **Cannot grant stamps to themselves**. Audit + rate-limit + daily cap + manager override (already decided).
- **Admin/owner**: full access but **multi-tenant isolated** (everything by `organizationId`); impersonation (parked) would be **always audited**.

### Cross-cutting (built with the ledger)
- **Idempotency on earn/redeem**: every transaction carries an idempotency key (double-tap / network retry does NOT duplicate balance). It's ledger correctness, not optional.
- **Append-only ledger**: transactions are never edited/deleted; corrections = `adjust` rows. Auditable and immutable.
- **Replay protection** on the QR/code (nonce + single-use).
- **Upload validation** (avatar): type+size, **forbid SVG** (XSS).
- **Birthday lock** (set once / limited edits) so the birthday reward can't be farmed.
- **Webhook signature verification** (Twilio inbound, PostHog).
- **Consent + marketing opt-in** explicit and separate from transactional (Law 1581) + link to a **privacy policy and T&C** at signup.

### Parked (enough for the pilot, scales up with SaaS)
- Self-service **export/delete my data** portal (handled manually in the pilot; still need a policy).
- **Real owner 2FA**: the admin is **passwordless via email (magic-link)** — the factor is inbox possession, so owner security = email security. A TOTP second factor for the owner is **parked** (justified as the highest-privilege account, but not critical for one location). Pilot mitigation: the owner's email should have its own 2FA.
- Anomaly/fraud detection with ML, pen-test / SOC2 / advanced WAF (Cloudflare is already in front).

## 8. Other non-security adds I recommend for the MVP
- **Account recovery / number change**: since the phone is the key, offer (a) **linking Google** as a backup key and (b) **admin account merge/transfer** (with verification) so the wallet isn't orphaned. Cheap, avoids losing customers.
- **Consent + privacy at onboarding** (belongs to §7, but it's first-launch UX).
- **Menu item "out of stock/hidden" state** (availability) — practical day-to-day; left out of the menu fields, reconsider.
