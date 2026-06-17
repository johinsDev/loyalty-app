import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AuthLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="bg-background min-h-[100dvh] overflow-x-hidden">
      {children}
    </main>
  );
}
