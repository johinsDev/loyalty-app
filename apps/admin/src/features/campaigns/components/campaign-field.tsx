import { Label } from "@loyalty/ui";
import type { ReactNode } from "react";

/** Labelled field wrapper shared by the campaign wizard steps + the extracted
 *  message/audience editors. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {hint ? (
          <span className="text-muted-foreground/70 text-xs font-semibold">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <p className="text-destructive text-xs font-semibold">{children}</p>;
}
