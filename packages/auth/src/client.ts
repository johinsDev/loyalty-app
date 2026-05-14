import {
  organizationClient,
  phoneNumberClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser: empty string so fetch is relative — the auth handler is
 * mounted at `/api/auth/*` on whichever app the user is currently on.
 *
 * SSR: explicit env > Vercel-injected VERCEL_URL > localhost web port.
 */
const baseURL = ((): string => {
  if (typeof window !== "undefined") return "";
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3002";
})();

export const authClient = createAuthClient({
  baseURL,
  plugins: [organizationClient(), phoneNumberClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
