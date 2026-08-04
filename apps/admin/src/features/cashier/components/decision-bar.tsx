"use client";

import { Button } from "@loyalty/ui";
import { AlertTriangle, HelpCircle } from "lucide-react";

/**
 * One thing the register needs from the cashier, stated as a sentence plus the
 * ways out — never as a status they have to interpret.
 *
 * `blocking` stops the sale (the register can't price it, or the server would
 * reject it); `choice` is a real fork where either answer is valid.
 */
export type Decision = {
  id: string;
  tone: "blocking" | "choice";
  message: string;
  actions: { label: string; onClick: () => void }[];
};

/**
 * The single place the register asks something.
 *
 * These warnings used to be scattered — the reward conflict lived inside the
 * dark cart, the stale-pricing one was drawn twice (cart and promos panel), and
 * a promo tie only ever printed a sentence nobody could act on. The cashier had
 * to sweep the screen to find what was missing. Now there is one strip: empty
 * whenever there's nothing to decide, which is most of the time.
 *
 * It renders `null` when idle rather than an empty box, so it costs no vertical
 * space on a tablet.
 */
export function DecisionBar({ decisions }: { decisions: Decision[] }) {
  if (decisions.length === 0) return null;

  return (
    <div className="space-y-2">
      {decisions.map((d) => {
        const blocking = d.tone === "blocking";
        return (
          <div
            key={d.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border-2 p-3 ${
              blocking
                ? "border-destructive/40 bg-destructive/[0.07]"
                : "border-primary/40 bg-primary/[0.06]"
            }`}
          >
            <span className={blocking ? "text-destructive" : "text-primary"}>
              {blocking ? (
                <AlertTriangle className="size-5 flex-none" />
              ) : (
                <HelpCircle className="size-5 flex-none" />
              )}
            </span>
            <p
              className={`min-w-0 flex-1 text-sm leading-snug font-bold ${
                blocking ? "text-destructive" : "text-foreground"
              }`}
            >
              {d.message}
            </p>
            <div className="flex flex-wrap gap-2">
              {d.actions.map((a) => (
                <Button
                  key={a.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={a.onClick}
                  className="bg-card h-10 rounded-xl font-bold"
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
