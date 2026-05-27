// Mask PII in a preview database (a clone of prod) before it's wired to a
// Vercel preview. Turso/libSQL has no native anonymizer (unlike Neon's
// PostgreSQL Anonymizer), so we mask in-place with UPDATEs over @libsql/client.
//
// Usage:
//   DATABASE_URL=… TURSO_AUTH_TOKEN=… bun run scripts/db/mask-preview-db.ts
//   (local: DATABASE_URL=http://localhost:8080 — no token needed)
//
// Strategy, mirroring the prod loyalty graph but stripping PII:
//   - REALISTIC fakes where shape matters (emails, names, phones) so the
//     preview looks real. Values are derived from each row's `rowid` so they
//     stay UNIQUE — masking a UNIQUE column (user.phone_number, session.token,
//     push_token (customer,org,token)) to a constant would violate the index.
//   - HARD SCRUB ('redacted') for credentials/tokens/private paths — realism
//     is not wanted; the value must be destroyed.
//   - FK columns + PKs are never touched, so referential integrity and the
//     cards/stamps/rewards graph stay intact.
//   - organization.name/slug are NOT masked (the franchise name is not PII and
//     previews need it).
//
// After masking, the owner's email is RESTORED to a real address so Google
// login works in the preview (matched via member.role='owner' → user_id).

import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const ownerEmail = process.env.PREVIEW_OWNER_EMAIL ?? "johinsdev@gmail.com";

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

// Each rule masks one column for the rows where it's non-null. `value` is a
// SQLite expression evaluated per row; use `rowid` to stay unique.
type Rule = { table: string; column: string; value: string };

const rules: Rule[] = [
  // user — realistic fakes (email/name/phone), placeholder image
  { table: "user", column: "email", value: "'user' || rowid || '@preview.local'" },
  { table: "user", column: "name", value: "'User ' || rowid" },
  { table: "user", column: "phone_number", value: "'+1555' || printf('%07d', rowid)" },
  { table: "user", column: "image", value: "'https://placehold.co/256x256?text=user'" },

  // customer — realistic fakes
  { table: "customer", column: "email", value: "'customer' || rowid || '@preview.local'" },
  { table: "customer", column: "name", value: "'Customer ' || rowid" },
  { table: "customer", column: "phone", value: "'+1556' || printf('%07d', rowid)" },

  // session — scrub (token is UNIQUE → keep distinct via rowid)
  { table: "session", column: "token", value: "'redacted-' || rowid" },
  { table: "session", column: "ip_address", value: "'0.0.0.0'" },
  { table: "session", column: "user_agent", value: "'redacted'" },

  // account — scrub credentials
  { table: "account", column: "access_token", value: "'redacted'" },
  { table: "account", column: "refresh_token", value: "'redacted'" },
  { table: "account", column: "id_token", value: "'redacted'" },
  { table: "account", column: "password", value: "'redacted'" },

  // verification — scrub (OTP codes / identifiers)
  { table: "verification", column: "identifier", value: "'redacted-' || rowid" },
  { table: "verification", column: "value", value: "'redacted'" },

  // organization — placeholder logo (name/slug intentionally kept)
  { table: "organization", column: "logo", value: "'https://placehold.co/128x128?text=logo'" },

  // invitation — realistic fake email
  { table: "invitation", column: "email", value: "'invite' || rowid || '@preview.local'" },

  // push_token — scrub (subscription is UNIQUE per (customer,org,token))
  { table: "push_token", column: "token", value: "'redacted-' || rowid" },
  { table: "push_token", column: "device_label", value: "'redacted'" },

  // outbox tables (empty in prod, but mask defensively)
  { table: "sms_outbox", column: "to", value: "'+1557' || printf('%07d', rowid)" },
  { table: "email_outbox", column: "to", value: "'to' || rowid || '@preview.local'" },
  { table: "email_outbox", column: "cc", value: "'cc' || rowid || '@preview.local'" },
  { table: "email_outbox", column: "bcc", value: "'bcc' || rowid || '@preview.local'" },
  { table: "whatsapp_outbox", column: "to", value: "'+1558' || printf('%07d', rowid)" },
  { table: "whatsapp_outbox", column: "media_url", value: "'redacted'" },
  { table: "push_outbox", column: "device_token", value: "'redacted-' || rowid" },
];

const statements = rules.map(
  (r) =>
    `UPDATE "${r.table}" SET "${r.column}" = ${r.value} WHERE "${r.column}" IS NOT NULL`,
);

await client.batch(statements, "write");

// Restore the owner's real email so Google login works in the preview.
const restored = await client.execute({
  sql: `UPDATE "user" SET email = ? WHERE id IN (SELECT user_id FROM member WHERE role = 'owner')`,
  args: [ownerEmail],
});

console.info(
  `✓ Masked ${rules.length} PII columns · restored owner email on ${restored.rowsAffected} row(s) → ${ownerEmail}`,
);
