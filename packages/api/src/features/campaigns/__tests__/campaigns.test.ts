import type { CampaignRow } from "@loyalty/db/schema";
import { describe, expect, it } from "vitest";

import {
  hasChannelContent,
  renderVars,
  resolveChannel,
  toNotificationChannel,
  type CampaignChannel,
} from "../message";
import { displayState } from "../repository";
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
  channelPriority: null,
  audienceFilter: null,
  scheduledAt: null,
  special: false,
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
    expect(renderVars("{{ short_link }}", { short_link: "t4.co/x" })).toBe("t4.co/x");
    expect(renderVars("sin tokens", {})).toBe("sin tokens");
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
  it("requires definition + message + channels to publish (audience/schedule optional)", () => {
    expect(campaignWizard.state(base).canPublish).toBe(false);
    const filled: CampaignRow = {
      ...base,
      name: "2x1 lunes",
      message: { whatsapp: { text: "Traé un amigo" } },
      channelPriority: ["whatsapp"],
    };
    const state = campaignWizard.state(filled);
    expect(state.canPublish).toBe(true);
    expect(state.current).toBe("review");
    expect(state.order).toEqual([
      "definition",
      "message",
      "channels",
      "audience",
      "schedule",
    ]);
  });

  it("points at the first incomplete step", () => {
    expect(campaignWizard.state(base).current).toBe("definition");
    expect(
      campaignWizard.state({ ...base, name: "X" }).current,
    ).toBe("message");
  });
});
