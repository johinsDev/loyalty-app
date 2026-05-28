import { SignInForm } from "@/features/auth/components/sign-in-form";
import { isPasswordAuthEnabled } from "@/lib/auth-flags";

export default function SignInPage() {
  // Resolve the gate server-side and pass it down — VERCEL_ENV is not
  // exposed to the browser, so the client form can't compute it.
  return <SignInForm passwordEnabled={isPasswordAuthEnabled()} />;
}
