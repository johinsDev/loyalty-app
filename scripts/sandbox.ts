// Validate that ONE real third party works from your machine, without
// standing up the whole prod stack. The Dockerized dev stack keeps every
// channel on log/memory/local; this script lets you flip a single channel
// to its real sandbox credentials and prove connectivity end to end.
//
//   bun run sandbox -- --whatsapp=twilio
//   bun run sandbox -- --sms=twilio
//   bun run sandbox -- --email=resend
//   bun run sandbox -- --cache=upstash
//   bun run sandbox -- --db=turso
//
// Credentials come from the process env. Provide them via Infisical
// (recommended — keep sandbox creds in the `dev` env / a `/sandbox`
// folder and run `infisical run --path=/sandbox -- bun run sandbox ...`)
// or just export them in the shell.
//
// This proves the CREDENTIALS + REACHABILITY are good (an authenticated
// round-trip to the provider's API). It deliberately does NOT exercise
// each @loyalty/* package's send path — that stays the app's job; here
// we only answer "does this third party accept my keys from here".

type Check = {
  env: string[];
  run: () => Promise<string>;
};

function need(...keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const k of keys) {
    const v = process.env[k];
    if (!v) missing.push(k);
    else out[k] = v;
  }
  if (missing.length) {
    throw new Error(`missing env: ${missing.join(", ")}`);
  }
  return out;
}

async function expectOk(res: Response, label: string): Promise<string> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${label}: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return `${label}: HTTP ${res.status} OK`;
}

const checks: Record<string, Record<string, Check>> = {
  // Twilio drives both WhatsApp and SMS. A signed GET of the account
  // resource proves SID + auth token are valid.
  whatsapp: {
    twilio: {
      env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
      run: async () => {
        const e = need("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN");
        const auth = btoa(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`);
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}.json`,
          { headers: { Authorization: `Basic ${auth}` } },
        );
        return expectOk(res, "Twilio account");
      },
    },
  },
  sms: {
    twilio: {
      env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
      run: async () => {
        const e = need("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN");
        const auth = btoa(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`);
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${e.TWILIO_ACCOUNT_SID}.json`,
          { headers: { Authorization: `Basic ${auth}` } },
        );
        return expectOk(res, "Twilio account");
      },
    },
  },
  email: {
    resend: {
      env: ["RESEND_API_KEY"],
      run: async () => {
        const e = need("RESEND_API_KEY");
        const res = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${e.RESEND_API_KEY}` },
        });
        return expectOk(res, "Resend domains");
      },
    },
  },
  cache: {
    upstash: {
      env: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      run: async () => {
        const e = need("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN");
        const res = await fetch(`${e.UPSTASH_REDIS_REST_URL}/ping`, {
          headers: { Authorization: `Bearer ${e.UPSTASH_REDIS_REST_TOKEN}` },
        });
        return expectOk(res, "Upstash ping");
      },
    },
  },
  db: {
    turso: {
      env: ["DATABASE_URL"],
      run: async () => {
        const e = need("DATABASE_URL");
        // Use the same driver the app uses.
        const { createClient } = await import("@libsql/client");
        const client = createClient({
          url: e.DATABASE_URL,
          authToken: process.env.TURSO_AUTH_TOKEN,
        });
        const rs = await client.execute("select 1 as ok");
        if (rs.rows?.[0]?.ok !== 1) throw new Error("unexpected result");
        return "Turso: select 1 OK";
      },
    },
  },
};

const args = process.argv.slice(2);
const target = args
  .map((a) => a.match(/^--([a-z]+)=([a-z0-9]+)$/i))
  .find((m): m is RegExpMatchArray => m !== null);

if (!target) {
  console.error(
    "usage: bun run sandbox -- --<channel>=<provider>\n" +
      "channels: " +
      Object.entries(checks)
        .map(([c, p]) => `${c}=${Object.keys(p).join("|")}`)
        .join("  "),
  );
  process.exit(2);
}

const [, channel, provider] = target;
const check = checks[channel]?.[provider];

if (!check) {
  console.error(`✗ no sandbox check for --${channel}=${provider}`);
  process.exit(2);
}

try {
  console.info(`→ ${channel} via ${provider} (env: ${check.env.join(", ")})`);
  const result = await check.run();
  console.info(`✓ ${result}`);
  process.exit(0);
} catch (err) {
  console.error(`✗ ${channel}/${provider}: ${(err as Error).message}`);
  process.exit(1);
}
