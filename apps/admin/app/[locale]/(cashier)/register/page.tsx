import { setRequestLocale } from "next-intl/server";

import { IdentifyView } from "@/features/cashier/components/identify-view";

type Props = { params: Promise<{ locale: string }> };

/** `/caja` — identify a socio, then navigate to their register. Role guard lives
 *  in the (cashier) layout. */
export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <IdentifyView />;
}
