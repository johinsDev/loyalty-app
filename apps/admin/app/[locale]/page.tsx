import { redirect } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  redirect({
    href: { pathname: "/[storeId]/dashboard", params: { storeId: "all" } },
    locale,
  });
}
