import {
  db,
  getPrimaryOrganizationId,
  provisionCustomerForUser,
  recordAudit,
  schema,
} from "@loyalty/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
  admin,
  magicLink,
  organization,
  phoneNumber,
} from "better-auth/plugins";
import { and, eq, gte, sql } from "drizzle-orm";

import { coerceRole, ROLES, type Role } from "./roles";

export {
  ROLES,
  type Role,
  STAFF_OR_ABOVE,
  MANAGER_OR_ABOVE,
  OWNER_ONLY,
  coerceRole,
  isStaffRole,
} from "./roles";

export type AuthDeps = {
  sendOtp?: (args: { phoneNumber: string; code: string }) => Promise<void>;
  /**
   * Deliver the admin passwordless magic-link. Better Auth builds the full
   * `url`; we just send it (the Worker enqueues a Trigger.dev email task so the
   * lean Worker never runs the mailer). Omitted → the magicLink plugin is off.
   */
  sendMagicLink?: (args: { email: string; url: string }) => Promise<void>;
};

export type CreateAuthOptions = {
  /**
   * Disable email/password (admin app uses Google-only). The default
   * keeps email/password enabled so existing admin sessions don't drop.
   */
  emailAndPasswordEnabled?: boolean;
  /**
   * Per-app base URL. Better Auth uses this to mint the OAuth redirect
   * URI (`{baseURL}/api/auth/callback/google`) and to set cookie
   * attributes. Web and admin live on different ports / domains, so
   * each app's `/api/auth/[...all]/route.ts` MUST pass its own value
   * (typically `getAppUrl()` from `@/lib/app-url`). Falling back to a
   * global env var here would send Google a redirect URI that points
   * at the wrong app.
   */
  baseURL?: string;
};

const PHONE_OTP_WINDOW_SECONDS = 30 * 60;
const PHONE_OTP_MAX_PER_WINDOW = 5;

// `VERCEL_URL` is the per-deployment URL with a hash
// (loyalty-app-admin-abc123.vercel.app) — it changes every push.
// `VERCEL_PROJECT_PRODUCTION_URL` is the stable production alias
// (loyalty-app-admin.vercel.app) — that's what the browser actually
// hits and what must match Better Auth's origin check + Google's
// redirect_uri. Prefer the stable one; fall back to the deployment
// URL for preview deploys (which have no stable alias).
const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : null;

const vercelDeploymentUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : null;

const vercelUrl = vercelProductionUrl ?? vercelDeploymentUrl;

const defaultBaseURL =
  process.env.BETTER_AUTH_URL ?? vercelUrl ?? "http://localhost:3003";

const webURL =
  process.env.NEXT_PUBLIC_APP_URL ?? vercelUrl ?? "http://localhost:3002";

// Extra trusted origins (CSV) for the standalone Worker issuer: the FE
// subdomains it serves (admin./app.t4diverclub.app, per-PR preview hosts). Empty
// in the current Next per-app setup → no change. See the api-worker plan.
const extraTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// When the Worker is the single issuer on a shared parent domain, set the
// session cookie Domain (e.g. `.t4diverclub.app`) so sibling FE subdomains send
// it. Unset → host-only cookie (current Next per-app behaviour + localhost dev,
// where cookies are already shared across ports).
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;

export function createAuth(
  deps: AuthDeps = {},
  options: CreateAuthOptions = {},
) {
  const googleConfigured =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  const baseURL = options.baseURL ?? defaultBaseURL;
  // Loosen the OTP/auth rate limits for local dev only — `wrangler dev` forces
  // APP_ENV="production", so key off the localhost baseURL instead.
  const isLocalDev = baseURL.includes("localhost");

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL,
    // Better Auth rejects any request whose Origin isn't listed here
    // ("Invalid origin"). We include: the resolved baseURL, the web
    // URL, both localhost ports, the stable prod alias + deployment
    // URL, and a `*.vercel.app` wildcard so every preview deploy
    // (hashed subdomain) also passes. When a custom domain lands,
    // add it via BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL — those flow
    // into baseURL/webURL above.
    trustedOrigins: [
      baseURL,
      webURL,
      "http://localhost:3002",
      "http://localhost:3003",
      ...(vercelProductionUrl ? [vercelProductionUrl] : []),
      ...(vercelDeploymentUrl ? [vercelDeploymentUrl] : []),
      "https://*.vercel.app",
      ...extraTrustedOrigins,
    ],
    // Cross-subdomain session cookie for the standalone-Worker issuer. Omitted
    // (host-only cookie) unless AUTH_COOKIE_DOMAIN is set.
    ...(cookieDomain && {
      advanced: {
        crossSubDomainCookies: { enabled: true, domain: cookieDomain },
      },
    }),
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: isLocalDev
        ? {}
        : {
            "/phone-number/send-otp": { window: 60, max: 3 },
            "/phone-number/verify": { window: 60, max: 5 },
            "/sign-in/social": { window: 60, max: 10 },
            "/sign-in/magic-link": { window: 60, max: 3 },
          },
    },
    emailAndPassword:
      options.emailAndPasswordEnabled === false
        ? undefined
        : { enabled: true, autoSignIn: true },
    socialProviders: googleConfigured
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : undefined,
    // Account linking for the web customer "Connect Google" flow. Linking is
    // EXPLICIT only (no implicit sign-in linking): a phone-first user opts in
    // from their profile via `linkSocial`. `allowDifferentEmails` is required
    // because phone-first accounts carry a synthetic `<phone>@phone.local`
    // email that won't match the Google email. `updateUserInfoOnLink` pulls
    // Google's verified email onto `user.email`/`emailVerified` (the profile
    // then mirrors it to `customer.email`).
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
        allowDifferentEmails: true,
        updateUserInfoOnLink: true,
      },
    },
    // Append-only activity trail for the Empleados feature. Login is captured
    // when a session is created (skipping impersonation sessions, which the
    // employees service logs as `impersonation_start`); logout is captured on
    // the sign-out endpoint. Loyalty events (venta/sello/canje) are NOT stored
    // here — they're derived from the purchase/stamp/redemption tables.
    databaseHooks: {
      session: {
        create: {
          after: async (createdSession) => {
            if (createdSession.impersonatedBy) return;
            const organizationId = await getPrimaryOrganizationId();
            await recordAudit({
              organizationId,
              actorUserId: createdSession.userId,
              targetUserId: createdSession.userId,
              type: "login",
              ip: createdSession.ipAddress ?? null,
              userAgent: createdSession.userAgent ?? null,
            });
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-out") return;
        const sessionUser = ctx.context.session?.user;
        if (!sessionUser) return;
        const organizationId = await getPrimaryOrganizationId();
        await recordAudit({
          organizationId,
          actorUserId: sessionUser.id,
          targetUserId: sessionUser.id,
          type: "logout",
        });
      }),
    },
    plugins: [
      organization(),
      // Impersonation + ban ("Inhabilitado") + session listing/revocation for
      // the Empleados feature. Capability is gated on `user.role === "admin"`
      // (only the owner — see seed-helpers); every endpoint is additionally
      // wrapped behind our own `ownerProcedure` + role-hierarchy guard.
      admin(),
      // Admin passwordless sign-in. `disableSignUp` → a magic-link to an
      // unknown email is refused (staff are seeded/invited, never self-serve),
      // which is what keeps this safe to leave enabled in prod.
      ...(deps.sendMagicLink
        ? [
            magicLink({
              expiresIn: 300,
              disableSignUp: true,
              sendMagicLink: async ({ email, url }) => {
                await deps.sendMagicLink!({ email, url });
              },
            }),
          ]
        : []),
      ...(deps.sendOtp
        ? [
            phoneNumber({
              sendOTP: async ({ phoneNumber, code }) => {
                await enforcePhoneOtpCap(phoneNumber);
                await deps.sendOtp!({ phoneNumber, code });
              },
              otpLength: 6,
              expiresIn: 300,
              signUpOnVerification: {
                getTempEmail: (phone) =>
                  `${phone.replace(/\+/g, "")}@phone.local`,
                getTempName: (phone) => phone,
              },
              // Phone is the loyalty identity, so mirror the verified user into a
              // `customer` row here. This is the single seam covering BOTH the
              // phone-signup verify AND the Google→phone-link verify
              // (`updatePhoneNumber: true`), so a Google customer who completes
              // the phone step also gets provisioned. Idempotent.
              callbackOnVerification: async ({ phoneNumber, user }) => {
                await provisionCustomer(user, phoneNumber);
              },
            }),
          ]
        : []),
    ],
  });
}

// Mirror a phone-verified user into a `customer` row (id = user.id) so push
// tokens + notifications address the person by `session.user.id`. Called from
// the phoneNumber plugin's `callbackOnVerification` — fires for both a fresh
// phone signup and a Google user linking their phone. Best-effort + idempotent
// (provisionCustomerForUser uses onConflictDoNothing) — never blocks verify.
async function provisionCustomer(
  user: { id: string; email?: string | null; name?: string | null },
  phone: string,
): Promise<void> {
  const organizationId = await getPrimaryOrganizationId();
  if (!organizationId) return;
  try {
    await provisionCustomerForUser({
      userId: user.id,
      organizationId,
      phone,
      email: user.email ?? null,
      name: user.name ?? null,
    });
  } catch (error) {
    console.error("[auth] failed to provision customer", {
      userId: user.id,
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Hard cap per phone number across IPs/clients. Better Auth's rate limit
// is keyed on IP, so a bot rotating proxies could still burn through OTPs
// for one number. This caps to N requests / window per phoneNumber by
// counting rows in the verification table.
async function enforcePhoneOtpCap(phoneNumber: string): Promise<void> {
  // Local dev: don't cap, so the onboarding can be tested freely.
  if ((process.env.BETTER_AUTH_URL ?? "").includes("localhost")) return;
  const since = new Date(Date.now() - PHONE_OTP_WINDOW_SECONDS * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.verification)
    .where(
      and(
        eq(schema.verification.identifier, phoneNumber),
        gte(schema.verification.createdAt, since),
      ),
    );
  if (row && row.count >= PHONE_OTP_MAX_PER_WINDOW) {
    throw new APIError("TOO_MANY_REQUESTS", {
      message:
        "Demasiados códigos enviados para este número. Esperá 30 minutos.",
    });
  }
}

export type Auth = ReturnType<typeof createAuth>;

// Lazy so importing this module is side-effect free — `createAuth()` (which
// requires BETTER_AUTH_SECRET + the Google creds) runs on first property
// access, not at import. Mirrors the `db` Proxy in `@loyalty/db`. The FE apps
// import `auth` but only touch it on the in-process (non-Worker) path, so when
// `NEXT_PUBLIC_API_URL` routes auth through the Worker their Vercel projects
// boot without any backend secrets. The Worker calls `createAuth(deps)`
// directly, so it's unaffected.
let authInstance: Auth | undefined;
export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    authInstance ??= createAuth();
    const real = authInstance as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
export type Session = Auth["$Infer"]["Session"];

/**
 * Resolve a user's role from the `member` table. A user with no
 * member row is treated as a `customer` — that's the default for
 * everyone who signs up via apps/web. Staff/manager/owner are
 * explicitly inserted by `bun run db:seed:owner --email=...` or by
 * the future invite-staff flow.
 *
 * Falls back to `customer` for unknown role strings (least privilege).
 *
 * v1 assumes a single operator org, so we don't filter by
 * `organizationId`. When multi-tenancy lands, this reads
 * `session.user.activeOrganizationId` and narrows by it.
 */
export async function getUserRole(userId: string): Promise<Role> {
  const [row] = await db
    .select({ role: schema.member.role })
    .from(schema.member)
    .where(eq(schema.member.userId, userId))
    .limit(1);
  if (!row) return ROLES.customer;
  return coerceRole(row.role);
}
