"use client";

import { authClient } from "@loyalty/auth/client";
import { Button } from "@loyalty/ui";
import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";

export function SignOutButton() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={onClick}
      disabled={loading}
    >
      <LogOutIcon className="size-4" />
      {loading ? t("signingOut") : t("signOut")}
    </Button>
  );
}
