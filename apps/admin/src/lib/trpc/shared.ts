import { getAppUrl } from "../app-url";

/**
 * tRPC client base URL. Empty in the browser so fetch goes
 * relative (same origin); otherwise delegate to {@link getAppUrl}.
 */
export const getBaseUrl = (): string => {
  if (typeof window !== "undefined") return "";
  return getAppUrl();
};
