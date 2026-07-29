import type { MiddlewareHandler } from "hono";

interface Flushable {
  flush(): void | Promise<void>;
}

/**
 * Ships buffered log records before the isolate is discarded.
 *
 * The Better Stack transport batches (50 records / 5s timer) to keep the hot
 * path cheap. That never pays off on Workers: an isolate finishes a request in
 * tens of ms, so the timer never fires and the batch never fills — every record
 * was being dropped on eviction. `waitUntil` keeps the isolate alive for the
 * flush without delaying the response.
 */
export function flushLogs(logger: Flushable): MiddlewareHandler {
  return async (c, next) => {
    await next();
    const flushed = Promise.resolve(logger.flush());
    // `executionCtx` throws outside a Workers runtime (tests, some dev paths) —
    // there, awaiting the flush directly is both correct and cheap.
    try {
      c.executionCtx.waitUntil(flushed);
    } catch {
      await flushed;
    }
  };
}
