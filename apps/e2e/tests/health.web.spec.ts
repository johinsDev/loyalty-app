import { expect, test } from "@playwright/test";

test("web /api/health returns ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ status: "ok", service: "web" });
  expect(typeof body.time).toBe("string");
});
