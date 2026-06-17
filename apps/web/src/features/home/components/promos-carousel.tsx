import { getTranslations } from "next-intl/server";

import { promos } from "../data";

/**
 * Promos / banners as a horizontal snap carousel with a "see all" affordance.
 * Each card's gradient comes from the data so the org can theme campaigns.
 */
export async function PromosCarousel() {
  const t = await getTranslations("Home");
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-bold tracking-wider">
          {t("forYouToday")}
        </p>
        <button type="button" className="text-primary text-xs font-bold">
          {t("seeAll")}
        </button>
      </div>
      <div className="-mx-5 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden">
        {promos.map((p) => {
          const Icon = p.icon;
          return (
            <article
              key={p.id}
              className="flex h-[190px] w-[286px] flex-none snap-center flex-col justify-between overflow-hidden rounded-[28px] p-[22px] text-white shadow-[0_20px_36px_-18px_rgba(27,173,157,.6)]"
              style={{
                backgroundImage: `linear-gradient(150deg, ${p.gradient[0]}, ${p.gradient[1]})`,
              }}
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex rounded-full bg-white/25 px-3 py-1 text-[11px] font-extrabold tracking-wider">
                  {p.badge}
                </span>
                <Icon className="size-10" />
              </div>
              <div>
                <h3 className="font-display text-[27px] font-semibold tracking-tight">
                  {p.title}
                </h3>
                <p className="text-sm text-white/90">{p.sub}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
