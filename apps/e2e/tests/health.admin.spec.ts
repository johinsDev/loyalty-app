import { expect, test } from "@playwright/test";

test("admin /api/health returns ok and reports DB reachable", async ({
  request,
}) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({
    status: "ok",
    service: "admin",
    deps: { db: { reachable: true } },
  });
  expect(typeof body.time).toBe("string");
});
