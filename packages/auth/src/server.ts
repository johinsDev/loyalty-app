import { db, schema } from "@loyalty/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { organization, phoneNumber } from "better-auth/plugins";
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

export function createAuth(
  deps: AuthDeps = {},
  options: CreateAuthOptions = {},
) {
  const googleConfigured =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  const baseURL = options.baseURL ?? defaultBaseURL;

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
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
    ],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/phone-number/send-otp": { window: 60, max: 3 },
        "/phone-number/verify": { window: 60, max: 5 },
        "/sign-in/social": { window: 60, max: 10 },
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
    plugins: [
      organization(),
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
            }),
          ]
        : []),
    ],
  });
}

// Hard cap per phone number across IPs/clients. Better Auth's rate limit
// is keyed on IP, so a bot rotating proxies could still burn through OTPs
// for one number. This caps to N requests / window per phoneNumber by
// counting rows in the verification table.
async function enforcePhoneOtpCap(phoneNumber: string): Promise<void> {
  const since = new Date(Date.now() - PHONE_OTP_WINDOW_SECONDS * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
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

export const auth = createAuth();

export type Auth = ReturnType<typeof createAuth>;
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
