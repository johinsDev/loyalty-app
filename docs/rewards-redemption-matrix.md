# Reward redemption — behaviour matrix

What each reward type actually does when redeemed at the register, verified
end-to-end against the live evaluator (`stamps.preview` + `stamps.recordPurchase`)
rather than read off the source.

Money is written the way the UI shows it (`$16.500`); the API carries it as
integer cents where `1650000 = $16.500`.

## Where the logic lives

| Concern | File |
| --- | --- |
| Per-type evaluation, unit selection, exclusions | `packages/api/src/features/rewards/pos-evaluate.ts` |
| The variant swap (split line, delta) | `packages/api/src/features/rewards/variant-swap.ts` |
| Single orchestration for preview + record | `packages/api/src/features/rewards/pos-upgrade.ts` |
| Discount layering and the cap | `packages/api/src/features/_shared/checkout-math.ts` |
| Customer-facing copy | `packages/api/src/features/rewards/format.ts` |

## Test catalog

The pilot org (`loyaltyMode: "points"` — **the stamps track is off**, so every
sale earns points and zero stamps).

- Products with `Tamaño` variants (Mediano/Grande): Brown Sugar Boba
  16.500/18.500, Classic Milk Tea 13.500/15.500, Taro 15.500/17.500,
  Matcha Strawberry 17.000/19.000, Iced Matcha Latte 15.000/17.000,
  Spring Drop 18.000/20.000, Studio Showcase 19.000/21.000.
- Products with **no** variants: Peach Oolong 14.500, Mango Tango 15.500,
  Strawberry Cloud 16.000, Dragon Fruit Fizz 16.500.
- Categories: `General` = Brown/Classic/Taro · `Frutales` = Peach/Mango/
  Strawberry Cloud/Matcha Strawberry · `Matcha` = Matcha Strawberry/Iced Matcha.
- Add-ons: Perlas +1.000, Pudding +2.000.
- A standing promo, **"Segunda unidad al 50%"**, fires whenever two units of the
  same drink are in the cart. It shows up in several rows below — that is the
  promo, not the reward.

## Results

Every row was executed; `disc` is the reward's own discount and `net` is what the
customer pays after reward + promo + tier.

| # | Reward | Cart | Result |
| --- | --- | --- | --- |
| 1 | freeProduct (Classic) | Classic + Brown | ✅ disc **13.500**, net 16.500 — the target line goes free |
| 2 | freeProduct (Classic) | Brown only | ✅ blocked, `reward-item-not-in-cart` |
| 3 | freeProduct (Classic) | 3× Classic | ✅ disc 13.500 — **one** unit, not three. Promo then took 6.750 off a remaining unit |
| 4 | freeProduct (category Frutales) | Peach + Brown | ✅ disc 14.500 — the category member |
| 5 | freeProduct (category Frutales) | Peach 14.500 + Mango 15.500 | ⚠️ disc **14.500** — frees the **cheapest** match (see Design notes) |
| 6 | amountOff 5.000, order-wide | Classic | ✅ net 8.500 |
| 7 | amountOff 5.000, order-wide | a 3.000 ticket | ✅ disc clamped to 3.000, net **0** — never negative |
| 8 | amountOff 3.000, scoped to Milk Tea | Classic | ✅ disc 3.000 |
| 9 | amountOff 3.000, scoped to Milk Tea | Peach (outside) | ✅ blocked, `reward-item-not-in-cart` |
| 10 | percentOff 20%, cap 4.000 | Classic 13.500 | ✅ disc 2.700 — under the cap |
| 11 | percentOff 20%, cap 4.000 | 3× Brown = 49.500 | ✅ disc **4.000** — 9.900 clipped to the cap |
| 12 | percentOff 50%, scoped to Matcha | Matcha Straw 17.000 + Brown | ✅ disc **8.500** — half of the member only, Brown untouched |
| 13 | freeAddon (Perlas) | Brown + Perlas | ✅ disc 1.000 |
| 14 | freeAddon (Perlas) | Brown, no add-on | ✅ blocked |
| 15 | freeAddon (any) | Brown + Perlas | ✅ disc 1.000 |
| 16 | variantUpgrade, category General | Brown **Mediano** | ✅ `Mediano→Grande`, disc 2.000, net 16.500 |
| 17 | variantUpgrade, category General | Peach (no variants) | ✅ blocked, `reward-no-upgrade-available` — the specific reason, not "add the product" |
| 18 | experience | any | ✅ disc 0, net unchanged |

### Recorded sales

Two were charged for real, not just previewed:

- **freeProduct** — Classic + Brown → total **16.500**, redemption row
  `points_spent 50 / discount 13.500`, ledger `redeem −50` then `earn +16`.
- **variantUpgrade** — Brown Mediano → total **16.500** (the Mediano price),
  redemption `points_spent 25 / discount 2.000`. The recorded line is
  `qty 1 · 18.500 · variant = Grande · reward_upgraded_from_variant_id = Mediano`.
  The ticket states what the customer *receives* while keeping the provenance.

## Stacking

**Two rewards cannot stack.** `recordPurchase`/`preview` take a single optional
`inlineReward` object, not an array (`features/stamps/schemas.ts`), so one reward
per sale is enforced at the API boundary — not a UI convention.

What *does* combine, in this order, each on the running remainder:

```
reward → promo → tier %
```

Verified on a 2× Brown cart (33.000):

| Case | reward | promo | net |
| --- | --- | --- | --- |
| promo alone | — | 8.250 | 24.750 |
| promo + order voucher (5.000) | 5.000 | 8.250 | **19.750** |
| reward that doesn't apply | 0 (blocked) | 8.250 | 24.750 |

So a reward and a promo stack by default, and a blocked reward doesn't disturb
the promo.

Three org switches govern the rest (`organization_settings`, currently
`1 / 1 / 100` = everything stacks, no cap):

- `rewardStacksWithPromo = false` → the promo is dropped when a reward is present.
- `tierStacksWithPromo = false` → the tier % is dropped when a promo applies.
- `maxTotalDiscountPct` caps the total; the cap eats the **tier first, then the
  promo, then the reward**, so the layers that wrote a ledger row survive.
- An **exclusive** promo suppresses both reward and tier.

A unit consumed by a reward is excluded from promo matching, so the same drink is
never discounted twice. For the variant swap this is why the upgraded unit shows
"esta unidad no lleva promo" at the register.

## Design notes and gaps

**`freeProduct` frees the cheapest match, deliberately.** `pos-evaluate.ts:32`
documents it: a reward is paid for with points, so it picks the cheapest, unlike
a promo's cross-sell which gives away the most expensive. Case 5 above is that
rule, not a bug — but it is a business decision worth revisiting: a customer
spending 60 points on "a free Frutal" will reasonably expect the 15.500 one.

**The register never names the scope — at all.** Two layers cause this:

1. `availableForCustomer` calls `rewardBenefitSummary(rw.benefit, "es")` with no
   `names` map (`features/rewards/service.ts:664`), so even a single-ref reward
   renders as "Producto gratis" instead of "Classic Milk Tea gratis". Verified in
   the detail sheet for T1, which is scoped to exactly one product.
2. Even given a map, `refNames()` (`features/rewards/format.ts:31`) bails on more
   than two refs, so a category or broad scope degrades to "productos
   seleccionados".

Same shape as the generic ineligibility line on T2 ("Agrega el producto al
carrito"), which never says *which* product. The one-line summary has to stay
short, but the detail sheet has room to list them and
`PromoRepository.refNames(refs)` already resolves ids → names.

**Not covered here:** `limitPerCustomer: "once"`, tier-gated rewards
(`allowedTiers`), store-scoped rewards (`storeIds`), and rewards priced in stamps
(the pilot org has the stamps track off, so stamp costs can't be exercised
against it).

## Re-running this

The 10 rewards are seeded straight into the local DB — far faster than the admin
wizard, and it pins exact benefit JSON:

```
python3 scripts/dev/seed-test-rewards.py     # inserts T1…T10, published
```

Then drive `stamps.preview` from the browser console on an authenticated cashier
page, so the real session cookie is used:

```js
await fetch(`http://localhost:8787/trpc/stamps.preview?input=` +
  encodeURIComponent(JSON.stringify({ json: { customerId, currency: "COP", items, inlineReward } })),
  { credentials: "include" }).then(r => r.json())
```

Rewards named `T%` are disposable; delete them when finished (they will refuse to
delete once a redemption references them — archive instead).
