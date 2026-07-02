import type { CampaignRow } from "@loyalty/db/schema";
import { describe, expect, it } from "vitest";

import {
  countRedeemed,
  hasChannelContent,
  minutesUntilQuietEnd,
  parseHhMm,
  renderVars,
  resolveChannel,
  toNotificationChannel,
  type CampaignChannel,
} from "../message";
import { displayState } from "../repository";
import {
  entityRefs,
  extractTokens,
  renderTemplate,
  renderTemplateSync,
} from "../templating";
import { campaignWizard } from "../wizard";

const now = new Date("2026-06-15T12:00:00Z");

const base: CampaignRow = {
  id: "c1",
  organizationId: "o1",
  createdByUserId: "u1",
  type: "promotional",
  status: "draft",
  sendState: null,
  name: null,
  objective: null,
  message: null,
  offer: null,
  linkUrl: null,
  channelPriority: null,
  audienceFilter: null,
  scheduledAt: null,
  special: false,
  mode: "once",
  cooldownDays: null,
  endsAt: null,
  activatedAt: null,
  lastPulseAt: null,
  dripIntervalDays: null,
  dripMaxAttempts: null,
  runId: null,
  pausedAt: null,
  sentAt: null,
  createdAt: now,
  updatedAt: now,
  publishedAt: null,
};

describe("resolveChannel", () => {
  const priority: CampaignChannel[] = ["push", "email", "whatsapp"];

  it("picks the first reachable, non-opted-out channel", () => {
    expect(
      resolveChannel(priority, new Set(["email", "whatsapp"]), new Set()),
    ).toBe("email");
  });

  it("skips opted-out channels", () => {
    expect(
      resolveChannel(priority, new Set(["push", "email"]), new Set(["push"])),
    ).toBe("email");
  });

  it("skips channels the recipient can't receive", () => {
    expect(
      resolveChannel(priority, new Set(["whatsapp"]), new Set()),
    ).toBe("whatsapp");
  });

  it("returns null when nothing qualifies", () => {
    expect(
      resolveChannel(priority, new Set(["push"]), new Set(["push"])),
    ).toBeNull();
  });
});

describe("renderVars", () => {
  it("substitutes known tokens and blanks unknown/missing ones", () => {
    expect(renderVars("Hola {{nombre}}, nivel {{nivel}}", { nombre: "Ana", nivel: "oro" })).toBe(
      "Hola Ana, nivel oro",
    );
    expect(renderVars("Hola {{nombre}}", {})).toBe("Hola ");
    expect(renderVars("{{ sucursal }}", { sucursal: "T4 Colina" })).toBe("T4 Colina");
    expect(renderVars("sin tokens", {})).toBe("sin tokens");
  });
});

describe("countRedeemed", () => {
  const WINDOW = 14 * 86_400_000;
  const day = (n: number) => new Date(2026, 0, n);
  const sent = new Map([
    ["a", day(1)],
    ["b", day(1)],
    ["c", day(1)],
  ]);

  it("counts recipients who redeemed within the window, after their send", () => {
    const n = countRedeemed(
      sent,
      [
        { customerId: "a", at: day(5) }, // in window
        { customerId: "b", at: day(20) }, // after window (>14d)
        { customerId: "c", at: day(1) }, // same day, in window
      ],
      WINDOW,
    );
    expect(n).toBe(2); // a + c
  });

  it("ignores redemptions before the send and non-recipients", () => {
    const n = countRedeemed(
      sent,
      [
        { customerId: "a", at: new Date(2025, 11, 20) }, // before send
        { customerId: "z", at: day(2) }, // never sent
      ],
      WINDOW,
    );
    expect(n).toBe(0);
  });

  it("dedupes multiple redemptions by the same recipient", () => {
    const n = countRedeemed(
      sent,
      [
        { customerId: "a", at: day(3) },
        { customerId: "a", at: day(6) },
      ],
      WINDOW,
    );
    expect(n).toBe(1);
  });
});

describe("parseHhMm", () => {
  it("parses valid HH:mm to minutes", () => {
    expect(parseHhMm("00:00")).toBe(0);
    expect(parseHhMm("09:30")).toBe(570);
    expect(parseHhMm("23:59")).toBe(1439);
  });
  it("rejects malformed values", () => {
    expect(parseHhMm(null)).toBeNull();
    expect(parseHhMm("")).toBeNull();
    expect(parseHhMm("24:00")).toBeNull();
    expect(parseHhMm("9-30")).toBeNull();
  });
});

describe("minutesUntilQuietEnd", () => {
  it("daytime window: defers to the end when inside", () => {
    // window 09:00–21:00, now 12:00 → 9h to 21:00
    expect(minutesUntilQuietEnd(720, 540, 1260)).toBe(540);
    // now 08:00 → outside
    expect(minutesUntilQuietEnd(480, 540, 1260)).toBeNull();
  });
  it("overnight window: handles both legs", () => {
    // window 21:00–09:00. now 23:00 (pre-midnight leg) → 10h to 09:00
    expect(minutesUntilQuietEnd(1380, 1260, 540)).toBe(600);
    // now 03:00 (post-midnight leg) → 6h to 09:00
    expect(minutesUntilQuietEnd(180, 1260, 540)).toBe(360);
    // now 12:00 → outside the quiet window
    expect(minutesUntilQuietEnd(720, 1260, 540)).toBeNull();
  });
});

describe("templating tokens", () => {
  it("extracts dynamic, entity, and legacy tokens", () => {
    const tokens = extractTokens(
      "Hola {{user.name}}, mirá {{promo#p1.name}} — {{promo#p1.href}} y {{nombre}}",
    );
    expect(tokens.map((t) => `${t.scope}${t.id ? "#" + t.id : ""}.${t.field}`)).toEqual([
      "user.name",
      "promo#p1.name",
      "promo#p1.href",
      "user.name", // legacy {{nombre}} → user.name
    ]);
  });

  it("ignores unrecognized tokens", () => {
    expect(extractTokens("{{bogus}} {{weird#x}} plain")).toEqual([]);
  });

  it("collects distinct entity refs across texts", () => {
    const refs = entityRefs(
      "{{promo#p1.name}} {{promo#p1.href}}",
      "{{reward#r1.name}} {{promo#p1.name}}",
    );
    expect(refs).toEqual([
      { scope: "promo", id: "p1" },
      { scope: "reward", id: "r1" },
    ]);
  });

  it("renders via a resolver, blanking unknowns", async () => {
    const out = await renderTemplate(
      "Hola {{user.name}}, {{promo#p1.name}} en {{store.name}}",
      (t) => {
        if (t.scope === "user" && t.field === "name") return "Ana";
        if (t.scope === "promo" && t.field === "name") return "2x1";
        return ""; // store.name unresolved
      },
    );
    expect(out).toBe("Hola Ana, 2x1 en ");
  });

  it("renderTemplateSync uses a value map by raw token", () => {
    const values = new Map([["{{user.name}}", "Ana"]]);
    expect(renderTemplateSync("Hola {{user.name}}!", values)).toBe("Hola Ana!");
  });
});

describe("hasChannelContent", () => {
  it("detects per-channel content", () => {
    const message = { push: { title: "t", body: "b" }, sms: { text: "hola" } };
    expect(hasChannelContent(message, "push")).toBe(true);
    expect(hasChannelContent(message, "sms")).toBe(true);
    expect(hasChannelContent(message, "email")).toBe(false);
    expect(hasChannelContent(null, "push")).toBe(false);
  });
});

describe("toNotificationChannel", () => {
  it("maps email → mail, others unchanged", () => {
    expect(toNotificationChannel("email")).toBe("mail");
    expect(toNotificationChannel("push")).toBe("push");
    expect(toNotificationChannel("whatsapp")).toBe("whatsapp");
  });
});

describe("displayState", () => {
  it("draft until published", () => {
    expect(displayState(base, now)).toBe("draft");
  });

  it("scheduled when published with a future schedule", () => {
    expect(
      displayState(
        { ...base, status: "published", scheduledAt: new Date("2026-06-20") },
        now,
      ),
    ).toBe("scheduled");
  });

  it("sending when published and due", () => {
    expect(displayState({ ...base, status: "published" }, now)).toBe("sending");
  });

  it("sent once dispatched", () => {
    expect(
      displayState({ ...base, status: "published", sentAt: now, sendState: "sent" }, now),
    ).toBe("sent");
  });

  it("paused takes precedence over schedule", () => {
    expect(
      displayState({ ...base, status: "published", pausedAt: now }, now),
    ).toBe("paused");
  });
});

describe("campaignWizard", () => {
  it("requires definition + message (with channels) to publish (audience/schedule optional)", () => {
    expect(campaignWizard.state(base).canPublish).toBe(false);
    // Message content without a channel priority is not enough.
    expect(
      campaignWizard.state({
        ...base,
        name: "2x1 lunes",
        message: { whatsapp: { text: "Traé un amigo" } },
      }).canPublish,
    ).toBe(false);
    const filled: CampaignRow = {
      ...base,
      name: "2x1 lunes",
      message: { whatsapp: { text: "Traé un amigo" } },
      channelPriority: ["whatsapp"],
    };
    const state = campaignWizard.state(filled);
    expect(state.canPublish).toBe(true);
    expect(state.current).toBe("review");
    expect(state.order).toEqual(["definition", "message", "audience", "schedule"]);
  });

  it("points at the first incomplete step", () => {
    expect(campaignWizard.state(base).current).toBe("definition");
    expect(
      campaignWizard.state({ ...base, name: "X" }).current,
    ).toBe("message");
  });
});

describe("displayState — evergreen", () => {
  const ever: CampaignRow = { ...base, status: "published", mode: "evergreen" };

  it("is active when published and not paused/ended", () => {
    expect(displayState(ever, now)).toBe("active");
  });
  it("is paused when pausedAt is set", () => {
    expect(displayState({ ...ever, pausedAt: now }, now)).toBe("paused");
  });
  it("is ended when sendState is ended", () => {
    expect(displayState({ ...ever, sendState: "ended" }, now)).toBe("ended");
  });
  it("is ended once past endsAt", () => {
    expect(
      displayState({ ...ever, endsAt: new Date("2026-06-14T00:00:00Z") }, now),
    ).toBe("ended");
  });
  it("still one-shot 'sent' when mode is once", () => {
    expect(displayState({ ...base, status: "published", sentAt: now }, now)).toBe(
      "sent",
    );
  });
  it("drip is active while running (not 'sent')", () => {
    expect(
      displayState({ ...base, status: "published", mode: "drip", sentAt: now }, now),
    ).toBe("active");
  });
});
