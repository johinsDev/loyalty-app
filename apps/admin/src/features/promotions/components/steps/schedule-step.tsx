"use client";

import { Button, Input, Label } from "@loyalty/ui";
import { useState } from "react";

// Adapter step: `<input type="datetime-local">` yields strings while the wire
// shape is `Date`. Map on submit; the server's `scheduleStepSchema` coerces +
// enforces `endsAt > startsAt`.
function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleStep({
  defaults,
  onSubmit,
  pending,
}: {
  defaults: { startsAt: Date | null; endsAt: Date | null };
  onSubmit: (input: { startsAt: Date; endsAt: Date }) => Promise<void>;
  pending: boolean;
}) {
  const [startsAt, setStartsAt] = useState(toLocalInput(defaults.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(defaults.endsAt));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit({ startsAt: new Date(startsAt), endsAt: new Date(endsAt) });
  };

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startsAt">Starts at</Label>
        <Input
          id="startsAt"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="endsAt">Ends at</Label>
        <Input
          id="endsAt"
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        Save &amp; continue
      </Button>
    </form>
  );
}
