import { TRPCError } from "@trpc/server";

import type { PurchasesRepository } from "./repository";
import type {
  MyPurchasesInput,
  PurchaseDetail,
  PurchaseListItem,
  PurchaseListView,
  RecentPurchasesInput,
  UsualItem,
  UsualsInput,
} from "./schemas";

/**
 * Purchase-history business logic for the customer. Thin over the repository:
 * the heavy batching lives there; the service owns ownership errors + input
 * narrowing (ISO date strings → Date).
 */
export class PurchasesService {
  constructor(private readonly repo: PurchasesRepository) {}

  myPurchases(
    organizationId: string,
    customerId: string,
    input: MyPurchasesInput,
  ): Promise<PurchaseListView> {
    return this.repo.myPurchases(organizationId, customerId, {
      from: input.from ? new Date(input.from) : undefined,
      to: input.to ? new Date(input.to) : undefined,
      cursor: input.cursor,
      limit: input.limit,
    });
  }

  async purchaseDetail(
    organizationId: string,
    customerId: string,
    id: string,
  ): Promise<PurchaseDetail> {
    const detail = await this.repo.purchaseDetail(organizationId, customerId, id);
    if (!detail) {
      throw new TRPCError({ code: "NOT_FOUND", message: "PURCHASE_NOT_FOUND" });
    }
    return detail;
  }

  recentPurchases(
    organizationId: string,
    customerId: string,
    input: RecentPurchasesInput,
  ): Promise<PurchaseListItem[]> {
    return this.repo.recentPurchases(organizationId, customerId, input.limit);
  }

  usuals(
    organizationId: string,
    customerId: string,
    input: UsualsInput,
  ): Promise<UsualItem[]> {
    return this.repo.usuals(organizationId, customerId, input.limit);
  }
}
