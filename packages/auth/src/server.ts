import { db } from "@loyalty/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

const baseURL =
  process.env.BETTER_AUTH_URL ?? vercelUrl ?? "http://localhost:3003";

const webURL =
  process.env.NEXT_PUBLIC_APP_URL ?? vercelUrl ?? "http://localhost:3002";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: [baseURL, webURL, "http://localhost:3002"],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  plugins: [organization()],
});

export type Auth = typeof auth;
export type Session = Auth["$Infer"]["Session"];
