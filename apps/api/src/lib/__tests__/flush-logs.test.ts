import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { flushLogs } from "../flush-logs";

function appWith(logger: { flush: () => void | Promise<void> }) {
  const app = new Hono();
  app.use("*", flushLogs(logger));
  app.get("/", (c) => c.text("ok"));
  return app;
}

describe("flushLogs", () => {
  it("hands the flush to waitUntil so the isolate stays alive for it", async () => {
    // Held open by the test so the in-flight flush can't settle on its own.
    let release!: () => void;
    const inFlight = new Promise<void>((resolve) => {
      release = resolve;
    });
    let settled = false;
    const flush = vi.fn(() => inFlight.then(() => void (settled = true)));
    const waitUntil = vi.fn();

    const res = await appWith({ flush }).fetch(
      new Request("http://api.test/"),
      {},
      {
        waitUntil,
        passThroughOnException: () => {},
        props: {},
      } as ExecutionContext,
    );

    expect(res.status).toBe(200);
    expect(flush).toHaveBeenCalledOnce();
    expect(waitUntil).toHaveBeenCalledOnce();

    // The response came back without waiting on the flush.
    expect(settled).toBe(false);

    release();
    await waitUntil.mock.calls[0]?.[0];
    expect(settled).toBe(true);
  });

  it("awaits the flush directly when there is no ExecutionContext", async () => {
    let settled = false;
    const flush = vi.fn(async () => {
      await Promise.resolve();
      settled = true;
    });

    const res = await appWith({ flush }).request("/");

    expect(res.status).toBe(200);
    expect(flush).toHaveBeenCalledOnce();
    expect(settled).toBe(true);
  });

  it("tolerates a transport with no async flush", async () => {
    const flush = vi.fn(() => undefined);

    const res = await appWith({ flush }).request("/");

    expect(res.status).toBe(200);
    expect(flush).toHaveBeenCalledOnce();
  });

  it("flushes after the handler has run", async () => {
    const order: string[] = [];
    const app = new Hono();
    app.use("*", flushLogs({ flush: () => void order.push("flush") }));
    app.get("/", (c) => {
      order.push("handler");
      return c.text("ok");
    });

    await app.request("/");

    expect(order).toEqual(["handler", "flush"]);
  });
});
