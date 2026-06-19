"use client";

import { DrawerHeader, DrawerTitle } from "@loyalty/ui";
import { useTranslations } from "next-intl";

import { CountUp } from "@/lib/count-up";
import { useReducedMotion } from "@/lib/use-reduced-motion";

import type { Order } from "../data";

/**
 * Itemized receipt for one order, rendered inside the history bottom Drawer:
 * store + date header, the line items (staggered in), subtotal/total, the
 * points + stamps earned (count up), and the payment method.
 */
export function ReceiptSheet({ order }: { order: Order }) {
  const t = useTranslations("History");
  const reduced = useReducedMotion();

  return (
    <div className="px-2 pb-6">
      <DrawerHeader className="items-center text-center">
        <DrawerTitle className="font-display text-2xl font-semibold tracking-tight">
          {order.store}
        </DrawerTitle>
        <p className="text-muted-foreground text-sm">
          {order.date} · {order.time}
        </p>
        <p className="text-muted-foreground/70 text-xs">
          {t("orderNo", { orderNo: order.orderNo })}
        </p>
      </DrawerHeader>

      <div className="flex flex-col gap-3 px-4">
        {order.items.map((li, i) => (
          <div
            key={`${li.name}-${i}`}
            style={
              reduced
                ? undefined
                : {
                    animation: "tw-fade-up 0.4s ease-out backwards",
                    animationDelay: `${i * 60}ms`,
                  }
            }
            className="flex items-start gap-3"
          >
            <span className="bg-muted text-muted-foreground grid h-7 min-w-7 flex-none place-items-center rounded-lg px-1.5 text-sm font-extrabold">
              {li.qty}×
            </span>
            <span className="text-foreground flex-1 text-[0.95rem] font-semibold">
              {li.name}
            </span>
            <span className="text-foreground text-[0.95rem] font-bold">
              {li.price}
            </span>
          </div>
        ))}
      </div>

      <div className="border-border my-4 border-t border-dashed" />

      <div className="px-4">
        <div className="text-muted-foreground mb-2 flex items-center justify-between text-sm">
          <span>{t("subtotal")}</span>
          <span className="text-foreground font-semibold">{order.subtotal}</span>
        </div>
        <div className="mb-4 flex items-center justify-between">
          <span className="text-foreground text-base font-extrabold">
            {t("total")}
          </span>
          <span className="font-display text-foreground text-2xl font-semibold">
            {order.total}
          </span>
        </div>

        <div className="mb-4 flex gap-3">
          <div className="bg-primary/10 flex-1 rounded-2xl p-3.5 text-center">
            <CountUp
              value={order.points}
              plus
              className="font-display text-primary text-2xl font-semibold"
            />
            <div className="text-primary/80 mt-1 text-xs font-bold">
              {t("pointsEarned")}
            </div>
          </div>
          <div className="bg-primary/10 flex-1 rounded-2xl p-3.5 text-center">
            <div className="font-display text-primary text-2xl font-semibold">
              🧋{" "}
              <CountUp value={order.sellos} plus className="text-primary" />
            </div>
            <div className="text-primary/80 mt-1 text-xs font-bold">
              {t("sellosEarned")}
            </div>
          </div>
        </div>

        <div className="bg-muted/60 flex items-center gap-3 rounded-2xl p-3.5">
          <span className="text-lg">{order.payIcon}</span>
          <span className="text-foreground flex-1 text-sm font-semibold">
            {order.pay}
          </span>
        </div>
      </div>
    </div>
  );
}
