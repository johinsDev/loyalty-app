/**
 * Campaign message templating — the token grammar + renderer for merge
 * variables and entity references. Pure + resolver-injected so the DB/shortlink
 * work lives in the send job and this stays unit-testable.
 *
 * Grammar (`{{ ... }}`):
 *   - dynamic (per-recipient / per-org):   {{user.name}} {{user.tier}}
 *                                          {{user.points}} {{store.name}}
 *   - entity-bound (fixed selection):      {{promo#<id>.name}} {{promo#<id>.href}}
 *                                          {{product#<id>.name}} {{reward#<id>.href}}
 *                                          {{category#<id>.name}}
 *   - legacy (still supported):            {{nombre}} {{nivel}} {{puntos}}
 *                                          {{sucursal}} {{short_link}}
 *
 * A `.href` field is turned into a per-recipient tracked shortlink by the job.
 */

export const ENTITY_SCOPES = ["promo", "product", "reward", "category"] as const;
export type EntityScope = (typeof ENTITY_SCOPES)[number];
export type TokenScope = "user" | "store" | EntityScope;

export interface Token {
  /** The full matched token incl. braces, e.g. `{{promo#abc.href}}`. */
  raw: string;
  scope: TokenScope;
  /** Entity id for entity scopes; undefined for user/store. */
  id?: string;
  /** Field, e.g. `name` | `href` | `tier` | `points`. */
  field: string;
}

/** Legacy simple tokens → their (scope, field) equivalent. */
const LEGACY: Record<string, { scope: TokenScope; field: string }> = {
  nombre: { scope: "user", field: "name" },
  nivel: { scope: "user", field: "tier" },
  puntos: { scope: "user", field: "points" },
  sucursal: { scope: "store", field: "name" },
};

const ENTITY_SET = new Set<string>(ENTITY_SCOPES);
// {{ scope (#id)? . field }}  OR  {{ legacy }}
const TOKEN_RE =
  /\{\{\s*([a-z]+)(?:#([a-zA-Z0-9:_-]+))?(?:\.([a-z_]+))?\s*\}\}/gi;

/** Parse a token match into a normalized `Token` (or null if unrecognized). */
function toToken(
  raw: string,
  scopeRaw: string,
  id: string | undefined,
  field: string | undefined,
): Token | null {
  const scope = scopeRaw.toLowerCase();
  // Legacy single-word token (no dot): {{nombre}} …
  if (!field) {
    const legacy = LEGACY[scope];
    return legacy ? { raw, scope: legacy.scope, field: legacy.field } : null;
  }
  if (scope === "user" || scope === "store") {
    return { raw, scope, field };
  }
  if (ENTITY_SET.has(scope) && id) {
    return { raw, scope: scope as EntityScope, id, field };
  }
  return null;
}

/** Extract every recognized token from `text` (in order, may repeat). */
export function extractTokens(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const t = toToken(m[0], m[1] ?? "", m[2], m[3]);
    if (t) out.push(t);
  }
  return out;
}

/** Distinct entity references used across one or more texts. */
export function entityRefs(...texts: string[]): { scope: EntityScope; id: string }[] {
  const seen = new Set<string>();
  const refs: { scope: EntityScope; id: string }[] = [];
  for (const text of texts) {
    for (const t of extractTokens(text)) {
      if (t.id && ENTITY_SET.has(t.scope)) {
        const key = `${t.scope}#${t.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          refs.push({ scope: t.scope as EntityScope, id: t.id });
        }
      }
    }
  }
  return refs;
}

/**
 * Replace every token with the resolver's value. Unknown/blank resolutions
 * collapse to an empty string (never leak a raw token to a recipient). The
 * resolver may be async (entity lookups, shortlink minting).
 */
export async function renderTemplate(
  text: string,
  resolve: (token: Token) => string | Promise<string>,
): Promise<string> {
  const tokens = extractTokens(text);
  if (tokens.length === 0) return text;
  // Resolve unique tokens once, then substitute.
  const cache = new Map<string, string>();
  for (const t of tokens) {
    if (!cache.has(t.raw)) cache.set(t.raw, (await resolve(t)) ?? "");
  }
  return text.replace(TOKEN_RE, (m) => cache.get(m) ?? m);
}

/** Sync variant for previews with an already-resolved value map. */
export function renderTemplateSync(
  text: string,
  values: ReadonlyMap<string, string>,
): string {
  return text.replace(TOKEN_RE, (m) => values.get(m) ?? m);
}
