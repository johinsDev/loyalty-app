import { db, schema } from "@loyalty/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { organization, phoneNumber } from "better-auth/plugins";
import { and, eq, gte, sql } from "drizzle-orm";

export type AuthDeps = {
  sendOtp?: (args: { phoneNumber: string; code: string }) => Promise<void>;
};

export type CreateAuthOptions = {
  /**
   * Disable email/password (admin app uses Google-only). The default
   * keeps email/password enabled so existing admin sessions don't drop.
   */
  emailAndPasswordEnabled?: boolean;
};

const PHONE_OTP_WINDOW_SECONDS = 30 * 60;
const PHONE_OTP_MAX_PER_WINDOW = 5;

const vercelUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : null;

const baseURL =
  process.env.BETTER_AUTH_URL ?? vercelUrl ?? "http://localhost:3003";

const webURL =
  process.env.NEXT_PUBLIC_APP_URL ?? vercelUrl ?? "http://localhost:3002";

export function createAuth(
  deps: AuthDeps = {},
  options: CreateAuthOptions = {},
) {
  const googleConfigured =
    !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg" }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL,
    trustedOrigins: [baseURL, webURL, "http://localhost:3002"],
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
