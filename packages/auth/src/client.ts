import {
  organizationClient,
  phoneNumberClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * `NEXT_PUBLIC_API_URL` (the standalone Cloudflare Worker) takes precedence when
 * set — auth then lives cross-origin on the Worker, so we send credentials. When
 * unset, behaviour is unchanged: same-origin `/api/auth/*` on the current app
 * (browser: relative; SSR: explicit env > VERCEL_URL > localhost). This is the
 * additive Phase-2 switch — prod is identical until the env var is set. See the
 * `api-worker` plan.
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const baseURL = ((): string => {
  if (apiUrl) return apiUrl;
  if (typeof window !== "undefined") return "";
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3002";
})();

export const authClient = createAuthClient({
  baseURL,
  ...(apiUrl && { fetchOptions: { credentials: "include" } }),
  plugins: [organizationClient(), phoneNumberClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
