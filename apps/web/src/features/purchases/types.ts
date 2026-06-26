import type { AppRouter } from "@loyalty/api";
import type { inferRouterOutputs } from "@trpc/server";

// Type-only derivations from the live purchases router. Importing `AppRouter` as
// a type from `@loyalty/api` is erased at build time, so this never drags
// `@trpc/server` into the client bundle (the import-VALUES gotcha).
type PurchasesOutputs = inferRouterOutputs<AppRouter>["purchases"];

export type PurchaseListItem = PurchasesOutputs["myPurchases"]["items"][number];
export type PurchaseDetail = PurchasesOutputs["purchaseDetail"];
export type PurchaseDetailItem = PurchaseDetail["items"][number];
