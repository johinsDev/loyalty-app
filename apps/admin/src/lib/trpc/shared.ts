import { getAppUrl } from "../app-url";

/**
 * tRPC client base URL. Empty in the browser so fetch goes
 * relative (same origin); otherwise delegate to {@link getAppUrl}.
 */
export const getBaseUrl = (): string => {
  if (typeof window !== "undefined") return "";
  return getAppUrl();
};

/**
 * tRPC endpoint. `NEXT_PUBLIC_API_URL` (the standalone Worker) wins when set —
 * cross-origin, so the client sends credentials. Otherwise the same-origin Next
 * route (current behaviour). Additive Phase-2 switch. See the `api-worker` plan.
 */
export const getTrpcUrl = (): string => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  return apiUrl ? `${apiUrl}/trpc` : `${getBaseUrl()}/api/trpc`;
};
