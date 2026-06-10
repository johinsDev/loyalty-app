// Maximize Cloudflare CDN caching for images served from images.t4diverclub.app
// (the R2 custom domain + Cloudflare Image Transformations). Two idempotent
// rules on the t4diverclub.app zone, matched by `http.host`:
//
//   1. Cache Rule (http_request_cache_settings): force edge caching with a
//      1-year edge TTL — R2 objects don't send Cache-Control, so without this
//      the edge may not cache them.
//   2. Response Header Transform Rule (http_response_headers_transform): set
//      `Cache-Control: public, max-age=31536000, immutable` so the BROWSER
//      caches for a year. Runs in the response phase (after Image
//      Transformations), so it owns the final header. Upload keys are unique
//      (per-PR prefix / random), so `immutable` is safe.
//
// Idempotent: finds our rule by description and replaces it (else appends),
// preserving any other rules on the phase.
//
//   infisical run --env=prod --path=/ci -- bun run scripts/cloudflare/set-image-cache-rules.ts
import process from "node:process";

const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID ?? "63a8ab4d4c9a79b9f41399532097efd8";
const IMAGE_HOST = process.env.IMAGE_CDN_HOST ?? "images.t4diverclub.app";
const ONE_YEAR = 31_536_000;

// Prefer the dedicated cache/transform-rules token (Cache Settings + Zone
// Transform Rules: Edit); fall back to the general deploy token if it ever
// gains those scopes. Both come from Infisical prod /ci.
const token = process.env.CLOUDFLARE_CACHE_RULES_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.error("✗ no CF token set (run via `infisical run --env=prod --path=/ci -- ...`).");
  process.exit(1);
}

const EXPRESSION = `(http.host eq "${IMAGE_HOST}")`;

type Rule = {
  id?: string;
  description?: string;
  expression: string;
  action: string;
  action_parameters?: Record<string, unknown>;
  enabled?: boolean;
};

const RULES: Record<string, Rule> = {
  http_request_cache_settings: {
    description: "loyalty: cache images long (edge)",
    expression: EXPRESSION,
    action: "set_cache_settings",
    action_parameters: {
      cache: true,
      edge_ttl: { mode: "override_origin", default: ONE_YEAR },
    },
    enabled: true,
  },
  http_response_headers_transform: {
    description: "loyalty: immutable Cache-Control on images",
    expression: EXPRESSION,
    action: "rewrite",
    action_parameters: {
      headers: {
        "Cache-Control": {
          operation: "set",
          value: `public, max-age=${ONE_YEAR}, immutable`,
        },
      },
    },
    enabled: true,
  },
};

const cf = async (path: string, init?: RequestInit) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  const json = (await res.json()) as { success: boolean; result?: unknown; errors?: unknown };
  if (!res.ok || !json.success) {
    throw new Error(`CF ${init?.method ?? "GET"} ${path} → ${res.status}: ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.result as { rules?: Rule[] };
};

// strip server-managed fields so PUT echoes a clean rule set
const clean = (r: Rule): Rule => ({
  expression: r.expression,
  action: r.action,
  ...(r.description && { description: r.description }),
  ...(r.action_parameters && { action_parameters: r.action_parameters }),
  enabled: r.enabled ?? true,
});

for (const [phase, rule] of Object.entries(RULES)) {
  const entrypoint = await cf(`/zones/${ZONE_ID}/rulesets/phases/${phase}/entrypoint`).catch(
    () => ({ rules: [] as Rule[] }),
  );
  const existing = (entrypoint.rules ?? []).map(clean);
  const idx = existing.findIndex((r) => r.description === rule.description);
  if (idx >= 0) existing[idx] = clean(rule);
  else existing.push(clean(rule));

  await cf(`/zones/${ZONE_ID}/rulesets/phases/${phase}/entrypoint`, {
    method: "PUT",
    body: JSON.stringify({ rules: existing }),
  });
  console.info(`✓ ${phase}: "${rule.description}" set (${existing.length} rule(s) on phase)`);
}

console.info(`✓ image cache rules applied for ${IMAGE_HOST} on zone ${ZONE_ID}.`);
