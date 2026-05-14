import { createAuth } from "@loyalty/auth/server";
import { toNextJsHandler } from "better-auth/next-js";

// Admin = staff only. No phone OTP, no email/password — Google OAuth
// is the only sign-in method. The user table is shared with apps/web
// so an employee can also be a customer of the loyalty program.
const auth = createAuth({}, { emailAndPasswordEnabled: false });

export const { GET, POST } = toNextJsHandler(auth.handler);
