---
name: whatsapp
description: Send WhatsApp messages from the loyalty-app monorepo via `@loyalty/whatsapp`. Use when triggering a send (birthday, points-earned, redemption-ready, OTP), adding a new strategy/transport, debugging delivery, asserting sends in tests, switching provider per environment, or reviewing the outbox.
---

# WhatsApp — `@loyalty/whatsapp` + outbox panel + E2E hook

`@loyalty/whatsapp` is the only surface app code should touch to send WhatsApp messages. Provider-agnostic interface, four built-in strategies, swappable per environment. Mirrors `@loyalty/log`'s shape: define once, run anywhere, swap providers via env.

```
packages/whatsapp/
├── src/
│   ├── index.ts                 public API barrel
│   ├── types.ts                 transport interface, message + config types
│   ├── errors.ts                WhatsAppError hierarchy
│   ├── schemas.ts               E.164 + formatting helpers
│   ├── whatsapp-message.ts      fluent builder
│   ├── base-whatsapp.ts         abstract class for typed messages
│   ├── manager.ts               WhatsAppManager (provider switch)
│   ├── sender.ts                WhatsAppSender (transport + logging)
│   ├── fake-sender.ts           FakeSender (test assertions)
│   ├── factories.ts             test fixtures
│   ├── transports/
│   │   ├── twilio.ts            production
│   │   ├── log.ts               local dev — pipes to @loyalty/log
│   │   ├── folder.ts            local dev — JSON + HTML preview
│   │   └── outbox.ts            preview deploys — DB rows
│   └── __tests__/…              vitest unit tests
└── package.json

apps/{web,admin}/lib/whatsapp.ts          bootstrap module per app
packages/jobs/whatsapp.ts                 bootstrap for Trigger.dev tasks

apps/admin/app/[locale]/(dashboard)/whatsapp-outbox/
├── page.tsx                     list view (PM)
└── [id]/page.tsx                detail view

apps/web/app/api/whatsapp-outbox/
├── route.ts                     GET ?to=…&limit=…  (E2E)
├── [id]/route.ts                GET by id
└── gate.ts                      VERCEL_ENV=production → 404
```

---

## Provider matrix

| Provider | Where it sends | Default env | Why |
| --- | --- | --- | --- |
| `twilio` | Real WhatsApp via Twilio API | production | Customer delivery |
| `log` | Stdout via `@loyalty/log` | local dev | Zero setup, zero filesystem, structured |
| `folder` | `.whatsapp-previews/{id}.{json,html}` | opt-in locally | See how it would render in WhatsApp |
| `outbox` | `whatsapp_outbox` Postgres table | preview | PM + Playwright can fetch sent messages |

Provider selection happens in `apps/{web,admin}/lib/whatsapp.ts` and `packages/jobs/whatsapp.ts`. Cascade per env:

1. Explicit `WHATSAPP_PROVIDER=<name>` env var (set in `.env` or Vercel project).
2. `VERCEL_ENV=production` → `twilio`.
3. `VERCEL_ENV=preview` → `outbox`.
4. Otherwise → `log`.

---

## Sending a message — typed class (preferred)

Define a class per use-case. The class encapsulates how the message is composed so call sites stay short.

```ts
// apps/web/lib/whatsapp/messages/birthday.ts
import { BaseWhatsApp } from "@loyalty/whatsapp";

export class BirthdayWhatsApp extends BaseWhatsApp {
  constructor(
    private readonly phone: string,
    private readonly name: string,
  ) {
    super();
  }

  prepare(): void {
    this.message
      .to(this.phone)
      .emoji("tada")
      .content(" ¡Feliz cumpleaños, ")
      .bold(this.name)
      .content("! Tenés 2 sellos de regalo.");
  }
}
```

```ts
// anywhere in a route handler / job / server action
import { whatsapp } from "@/lib/whatsapp";
import { BirthdayWhatsApp } from "@/lib/whatsapp/messages/birthday";

await whatsapp.send(new BirthdayWhatsApp("+5491155555555", "Lucía"));
```

The result is the same regardless of provider — `WhatsAppResponse` with `{ status, providerMessageId, provider, timestamp }`.

## Sending a one-off — inline callback

When you don't need a reusable class:

```ts
await whatsapp.send((m) =>
  m
    .to("+5491155555555")
    .content("Tu pedido está listo en mostrador."),
);
```

## Targeting a specific mailer

Default provider is fine for most flows. Pin a specific mailer when the use-case calls for it:

```ts
// Force outbox even in dev — useful when developing the admin panel.
await whatsapp.use("outbox").send(msg);
```

---

## Templates (Twilio Content SIDs)

WhatsApp requires approved templates for messages sent outside the 24-hour customer-service window. Use `.template()`:

```ts
this.message
  .to(this.phone)
  .template("HX0000...your-content-sid", {
    "1": customerName,
    "2": String(pointsEarned),
  });
```

Templates take precedence over freeform content. `folder` and `outbox` transports record the SID + variables; `twilio` calls Twilio's Content API.

---

## Adding a new strategy

1. Implement `WhatsAppTransport` in `packages/whatsapp/src/transports/<name>.ts`:
   ```ts
   import type { ProviderConfig, WhatsAppMessageData, WhatsAppResponse, WhatsAppTransport } from "../types";

   export interface MyProviderConfig {
     provider: "my-provider";
     apiKey: string;
   }

   export class MyTransport implements WhatsAppTransport {
     readonly name = "my-provider";
     constructor(private readonly config: MyProviderConfig) {}
     async send(message: WhatsAppMessageData): Promise<WhatsAppResponse> {
       // … call your API, map errors to ProviderError / RateLimitError …
       return { status: "sent", providerMessageId: "...", provider: this.name, timestamp: new Date().toISOString() };
     }
   }
   ```
2. Add the config variant to the `ProviderConfig` union in `src/types.ts`.
3. Add a `case` in `createTransport(config)` inside `src/manager.ts`.
4. Wire it up in each bootstrap (`apps/{web,admin}/lib/whatsapp.ts`, `packages/jobs/whatsapp.ts`).
5. Write a UT under `src/__tests__/transports/<name>.test.ts` using the spy / stub pattern from `log.test.ts` and `outbox.test.ts`.

---

## Tests — asserting sends

```ts
import { whatsapp } from "@/lib/whatsapp";
import { BirthdayWhatsApp } from "@/lib/whatsapp/messages/birthday";

beforeEach(() => {
  whatsapp.fake();   // returns FakeSender; subsequent sends are captured
});
afterEach(() => {
  whatsapp.restore();
});

it("sends a birthday whatsapp on customer's birthday", async () => {
  await runBirthdayCron();

  const fake = whatsapp.fake(); // idempotent — same fake instance
  fake.assertSent(BirthdayWhatsApp);
  fake.assertSent(
    BirthdayWhatsApp,
    (m) => m.message.toData().to === "+5491155555555",
  );
  fake.assertSentCount(BirthdayWhatsApp, 1);
});
```

API surface:
- `assertSent(MessageClass[, predicate])` — at least one match.
- `assertNotSent(MessageClass[, predicate])` — zero matches.
- `assertSentCount(n)` / `assertSentCount(MessageClass, n)` — exact count.
- `assertNoneSent()` — nothing went out.
- `clear()` — reset between assertions in the same test.
- `fake.sent` and `fake.sentMessages` — raw arrays if you need bespoke checks.

---

## Outbox panel (admin)

`/<locale>/whatsapp-outbox` lists the latest 100 rows of `whatsapp_outbox`. Click a row → detail page with body, template SID, variables, media. Status badges: `sent` / `failed`.

Visible in every env — empty in production (Twilio is the provider; the table isn't written to). Active in preview deploys and locally when `WHATSAPP_PROVIDER=outbox`.

Columns on the list view: `sentAt`, `to`, `status`, body preview. Filter is by phone on the URL (`?to=+549…`); the tRPC query supports it but the UI hasn't wired a filter input yet — open a separate ticket when needed.

---

## E2E fetch endpoint

```bash
# preview deploy URL or http://localhost:3002
GET /api/whatsapp-outbox?to=+5491155555555&limit=10
GET /api/whatsapp-outbox/<uuid>
```

Returns JSON. Gated by `apps/web/app/api/whatsapp-outbox/gate.ts`:

- `VERCEL_ENV=production` → 404. (Override with `WHATSAPP_OUTBOX_ENDPOINT_ENABLED=true` if you really need it.)
- Anything else → 200.

Playwright pattern:

```ts
test("birthday flow sends a whatsapp", async ({ page, request }) => {
  await triggerBirthdayCron(page);
  const res = await request.get("/api/whatsapp-outbox?to=+5491155555555&limit=1");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.rows[0].content).toContain("Feliz cumpleaños");
});
```

---

## Theme tokens / brand colors? None here

WhatsApp messages are text + media; visual theming is the user's WhatsApp client, not ours. The HTML preview the `folder` transport renders uses a WhatsApp-like green chat layout. To tweak it, edit `renderHtml()` in `packages/whatsapp/src/transports/folder.ts`.

---

## Common gotchas

### "`Recipient (to) is required`" thrown at `toData()`

`prepare()` forgot to call `.to(phone)`. Always set the recipient before any other content.

### Twilio sandbox: messages "sent" but never arrive

You're using a Twilio Sandbox `from` number and the recipient hasn't joined the sandbox. Have the recipient send `join <sandbox-keyword>` to the Twilio sandbox phone first. The transport surfaces error code `63015` from Twilio status checks.

### "Outside 24-hour window — use an approved Content Template"

Twilio error `63016`. Customer hasn't messaged the business in the last 24 hours. Switch the message to a template: `m.template(contentSid, variables)`.

### `WHATSAPP_PROVIDER=outbox` but admin panel is empty

`DATABASE_URL` not set in the runtime, or the outbox config wasn't included in the bootstrap. Check `apps/{web,admin}/lib/whatsapp.ts` — `mailers.outbox` is only registered when `db` is importable (which it is when `@loyalty/db` is in the dep tree). Run `bun run db:migrate` if the table doesn't exist yet.

### "Cannot find module 'twilio'"

The `twilio` SDK is an optional peer-dep. Only install it in apps that actually need to run the Twilio transport (production builds, or local with `WHATSAPP_PROVIDER=twilio`). The package itself ships without it; tests use the `fake`/`log`/`outbox` transports.

### Folder transport opens browser windows

Disable by removing the `openInBrowser: true` flag (it's `false` by default). The transport also skips opening when `NODE_ENV=production` or `CI=true`.

### E2E endpoint returns 404 on a preview

Confirm the preview deploy actually has `VERCEL_ENV=preview` (Vercel sets this; you don't need to). Local dev returns 200 always. Production returns 404 unless `WHATSAPP_OUTBOX_ENDPOINT_ENABLED=true`.

---

## Out of scope (Linear follow-ups)

- **Twilio status callbacks webhook**: `/api/webhooks/twilio/whatsapp` to ingest async delivery state (delivered, read, failed). Idempotency + signature verification.
- **Opt-in / opt-out registry**: per-recipient toggle table; gate `WhatsAppSender.send` on it.
- **Template registry**: centralize Content SIDs + variable schemas in `@loyalty/db` so templates aren't string literals scattered around.
- **Outbox cleanup job**: prune rows older than N days if preview accumulation becomes a problem.
- **Slack mirror**: push every outbox send to a Slack channel too. Declined for now (panel is enough).

---

## References

- Source: `packages/whatsapp/src/**`
- DB table: `packages/db/src/schema/whatsapp-outbox.ts`
- tRPC: `packages/api/src/routers/whatsapp-outbox.ts`
- Admin panel: `apps/admin/app/[locale]/(dashboard)/whatsapp-outbox/`
- E2E endpoint: `apps/web/app/api/whatsapp-outbox/`
- Bootstraps: `apps/{web,admin}/lib/whatsapp.ts`, `packages/jobs/whatsapp.ts`
- Reference repo this was ported from: `/Users/johan/Documents/personal-projects/t4-app/apps/web/lib/whatsapp/`

External docs:
- Twilio WhatsApp API — https://www.twilio.com/docs/whatsapp
- Twilio Content Templates — https://www.twilio.com/docs/content-api
- WhatsApp Business message formatting — https://faq.whatsapp.com/539178204879377
