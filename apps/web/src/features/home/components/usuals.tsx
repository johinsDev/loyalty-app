"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { CupSoda } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

/**
 * "Your usuals" — the products the customer orders most, as a horizontal rail of
 * roomy vertical cards on mobile (names wrap instead of truncating), settling
 * into a 2-up grid on desktop. Each card links to its product detail. Renders
 * nothing until the customer has order history. Client component.
 */
export function Usuals() {
  const t = useTranslations("Home");
  const trpc = useTRPC();
  const { data, isPending } = useQuery(
    trpc.purchases.usuals.queryOptions({ limit: 4 }),
  );

  if (isPending) {
    return (
      <section>
        <p className="text-muted-foreground mb-3 text-xs font-bold tracking-wider">
          {t("yourUsuals")}
        </p>
        <div className="scrollbar-hide -mx-5 flex gap-3 overflow-x-auto px-5 pt-1 pb-6 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 lg:pb-0">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-40 flex-none rounded-2xl lg:w-auto" />
          ))}
        </div>
      </section>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <section>
      <p className="text-muted-foreground mb-3 text-xs font-bold tracking-wider">
        {t("yourUsuals")}
      </p>
      <div className="scrollbar-hide -mx-5 flex gap-3 overflow-x-auto px-5 pt-1 pb-6 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0 lg:pb-0">
        {data.map((u) => (
          <Link
            key={u.productId}
            href={{ pathname: "/product/[slug]", params: { slug: u.slug } }}
            className="bg-card flex w-40 flex-none flex-col gap-2.5 rounded-2xl p-4 shadow-lg shadow-black/5 ring-1 ring-black/5 lg:w-auto dark:ring-white/10"
          >
            <span className="bg-primary/10 text-primary grid size-12 place-items-center overflow-hidden rounded-xl">
              {u.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <CupSoda className="size-6" />
              )}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground text-sm leading-tight font-bold">
                {u.name}
              </span>
              <span className="text-muted-foreground text-xs">
                {t("orderedTimes", { count: u.orders })}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
