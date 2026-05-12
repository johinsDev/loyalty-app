"use client";

import { authClient } from "@loyalty/auth/client";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { useRouter } from "@/i18n/navigation";

export function SignInForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message ?? t("genericError"));
      return;
    }
    router.push("/dashboard");
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("signInTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-md border border-border px-3"
            />
            <input
              type="password"
              required
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-md border border-border px-3"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? t("submitting") : t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
