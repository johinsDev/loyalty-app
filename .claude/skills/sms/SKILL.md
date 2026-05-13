---
name: sms
description: Send SMS from the loyalty-app monorepo via `@loyalty/sms`. Use when triggering a send (OTP, appointment reminder, order shipped, generic notification), adding a new strategy/transport, debugging delivery, asserting sends in tests, switching provider per environment, or reviewing the SMS outbox. Mirrors `@loyalty/whatsapp` shape with two extras: GSM-7 segment math + the `(dev)/sms-outbox` view.
---

# @loyalty/sms — SMS sender for the loyalty-app monorepo

`@loyalty/sms` is the provider-agnostic SMS package. It mirrors `@loyalty/whatsapp`: same strategy pattern, same 4 transports (`twilio`, `log`, `folder`, `outbox`), same FakeSender API. The two packages are designed to be twins so the same patterns work for either channel.

The differences that matter:

- **Body is text only.** No media URL, no template SID. Twilio template support might land later if we need OTP throughput in regulated regions; not in v1.
- **GSM-7 segment math is built in.** Every message records `encoding` (GSM-7 / UCS-2), `characters`, and `segments` — that's what carriers bill for. Visible in the outbox view + included in the `SmsResponse`.
- **The dev view lives under `(dev)/sms-outbox`**, sharing the `(dev)` route group with the WhatsApp outbox. Same gate (`isDevOnlyEnabled()`), same filtering + pagination shape.

---

## Where things live

| What | Where |
| --- | --- |
| Package | `packages/sms/src/` |
| Public API | `packages/sms/src/index.ts` |
| Strategy transports | `packages/sms/src/transports/{twilio,log,folder,outbox}.ts` |
| `BaseSms` (typed messages) | `packages/sms/src/base-sms.ts` |
| `SmsMessage` (fluent builder) | `packages/sms/src/sms-message.ts` |
| GSM-7 / segment helpers | `packages/sms/src/schemas.ts` |
| `FakeSender` | `packages/sms/src/fake-sender.ts` |
| `SmsManager` | `packages/sms/src/manager.ts` |
| Unit tests | `packages/sms/src/__tests__/` |
| Drizzle table | `packages/db/src/schema/sms-outbox.ts` |
| tRPC feature | `packages/api/src/features/sms-outbox/` |
| Web bootstrap | `apps/web/src/lib/sms.ts` |
| Admin bootstrap | `apps/admin/src/lib/sms.ts` |
| Web dev view | `apps/web/app/[locale]/(dev)/sms-outbox/` |
| Admin panel | `apps/admin/app/[locale]/(dashboard)/sms-outbox/` |
| E2E endpoint | `apps/web/app/api/sms-outbox/{route.ts, [id]/route.ts}` |

---

## Sending an SMS

### Quick (inline)

```ts
import { sms } from "@/lib/sms";

await sms.send((m) =>
  m.to("+5491155555555").content("Tu codigo es 1234. Expira en 5 minutos."),
);
```

### Class style (preferred for anything reused)

```ts
// packages/jobs/.../trigger/notifications/otp-sms.ts
import { BaseSms } from "@loyalty/sms";

export class OtpSms extends BaseSms {
  constructor(
    private readonly phone: string,
    private readonly code: string,
  ) {
    super();
  }

  prepare(): void {
    this.message
      .to(this.phone)
      .content(`Tu codigo es ${this.code}. Expira en 5 minutos.`);
  }
}

// callsite:
await sms.send(new OtpSms(user.phone, code));
```

`BaseSms.shouldSend()` gates the send for queue handlers — return false to short-circuit (opt-out, quiet hours, A/B test).

---

## Provider selection

`apps/{web,admin}/src/lib/sms.ts` picks the default based on the runtime:

| Where | Provider |
| --- | --- |
| Local dev | `log` (lines via `@loyalty/log`) |
| Vercel preview | `outbox` (rows in `sms_outbox`) |
| Vercel production | `twilio` |

Override with `SMS_PROVIDER=<log|folder|outbox|twilio>` in `.env`. The `folder` transport also writes an HTML preview when `SMS_PREVIEW_DIR` is set.

### Required env when `SMS_PROVIDER=twilio`

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM` (E.164 long code, short code, or messaging-service-backed number)

These are validated by `apps/{web,admin}/src/env.ts` via `@t3-oss/env-nextjs`. Boot fails if any is missing when twilio is selected.

If both `WHATSAPP_PROVIDER=twilio` and `SMS_PROVIDER=twilio`, the same `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` are reused — only the `FROM` numbers diverge.

---

## Segment math (cost surface)

SMS is billed per segment. The package emits `{ encoding, characters, count }` on every response.

| Encoding | Single segment | Concatenated |
| --- | --- | --- |
| GSM-7 (plain ASCII + a few extras) | 160 chars | 153 chars each |
| UCS-2 (emoji / non-Latin) | 70 chars | 67 chars each |

Use `import { smsSegmentInfo } from "@loyalty/sms"` to compute it inline. The dev outbox view + the admin panel show `encoding · segments` per row. Anything with `segments > 1` costs N× — flag it in code review.

---

## Testing

```ts
import { sms } from "@/lib/sms";
import { OtpSms } from "@/features/auth/otp-sms";

beforeEach(() => sms.fake());
afterEach(() => sms.restore());

it("sends OTP on sign-in", async () => {
  const fake = sms.fake();
  await runSignInFlow({ phone: "+5491155555555" });
  fake.assertSent(OtpSms, (m) => m.message.toData().to === "+5491155555555");
});
```

The `FakeSender` keeps `sent` (instances of `BaseSms`) and `sentMessages` (compiled `SmsMessageData`) so tests can match by class or by data shape.

---

## Adding a new transport

1. Implement `SmsTransport` in `packages/sms/src/transports/<name>.ts`.
2. Add the config variant to `ProviderConfig` (`packages/sms/src/types.ts`).
3. Wire it into `createTransport()` in `packages/sms/src/manager.ts`.
4. Add a UT under `__tests__/transports/<name>.test.ts`.
5. If it persists, add columns to `sms_outbox` (Drizzle schema) and re-run `bun run db:generate`.
6. Reference it from the bootstrap in `apps/{web,admin}/src/lib/sms.ts`.

---

## Dev view at `/sms-outbox`

URL: `http://localhost:3002/es/sms-outbox` (or `/en/`). Same gate as WhatsApp outbox — `isDevOnlyEnabled()` returns 404 in production. Lives inside `app/[locale]/(dev)/`; the parent layout runs the gate so the leaf pages stay clean.

The view uses the `whatsapp-outbox` blueprint: filters via nuqs (`to` partial match via ILIKE, `search` against body, status pill), pagination, Suspense + skeleton, RSC for fetch.

The detail page shows the full body, segment info, and the provider's message id.

---

## Outbox retention

The `sms_outbox` table is pruned daily by the `prune-outboxes` Trigger.dev task in `packages/jobs/trigger/prune-outboxes.ts` — rows older than `OUTBOX_RETENTION_DAYS` (default 30) get deleted at 04:00 UTC alongside `whatsapp_outbox` + `email_outbox`.

In production this table stays empty (Twilio is the provider), so retention only matters for local dev + preview deploys. Bump `OUTBOX_RETENTION_DAYS=90` in the Trigger.dev project env to keep more history; pause the task to disable cleanup.

---

## API surface

Three tRPC procedures under `smsOutbox`:

```ts
api.smsOutbox.list({ to?, status?, search?, page, pageSize });
api.smsOutbox.get({ id });
api.smsOutbox.latestForRecipient({ to, limit });
```

All `publicProcedure` — gated by env at the page + endpoint layer, not by auth. Backed by `SmsOutboxRepository` (Drizzle) → `SmsOutboxService` (business rules / errors) → router.

For the layering rules see `.claude/skills/api-filters/SKILL.md`.

---

## Why two packages?

WhatsApp templates (Content SIDs), the 24-hour customer-service window, freeform-vs-template gating, and media URLs make WhatsApp a meaningfully different channel from SMS. Trying to model both inside one `@loyalty/messaging` package forces conditional fields everywhere. Twin packages stay sharp:

- `@loyalty/whatsapp` — templates, media, formatting helpers, content-sid path.
- `@loyalty/sms` — segments, plain text only.

The `BaseWhatsApp` and `BaseSms` builders are independent so future features (push notifications, in-app messages, email) can fork off this shape.

---

## Common tasks

| Goal | Where |
| --- | --- |
| Send an OTP from auth | `BaseSms` subclass + `sms.send(new OtpSms(...))` |
| Switch to Twilio in preview | set `SMS_PROVIDER=twilio` + provide the twilio env vars |
| See sent messages locally | run with `SMS_PROVIDER=outbox` then visit `/es/sms-outbox` |
| Assert no SMS sent in a test | `sms.fake().assertNoneSent()` |
| Add a new typed SMS class | extend `BaseSms`, implement `prepare()` |
| Add a new transport | see "Adding a new transport" above |
