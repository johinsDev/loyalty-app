import { createAuth } from "@loyalty/auth/server";
import { toNextJsHandler } from "better-auth/next-js";

import { getAppUrl } from "@/lib/app-url";
import { isPasswordAuthEnabled } from "@/lib/auth-flags";

// Admin = staff only. No phone OTP. Sign-in providers:
//   - prod:        Google OAuth only (Google-only by policy)
//   - preview/dev: Google + email/password — the latter lets the
//                  deterministic preview admin (seeded per PR) log in
//                  without OAuth, which is painful on hashed preview
//                  subdomains. See `apps/admin/src/lib/auth-flags.ts`.
// The user table is shared with apps/web so an employee can also be a
// customer of the loyalty program.
const auth = createAuth(
  {},
  {
    emailAndPasswordEnabled: isPasswordAuthEnabled(),
    baseURL: getAppUrl(),
  },
);

export const { GET, POST } = toNextJsHandler(auth.handler);
