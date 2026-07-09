import { tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import type { ListResult } from "../_shared/list";
import type { PurchasesRepository } from "./repository";
import type {
  MyPurchasesInput,
  PurchaseAdminDetail,
  PurchaseAdminListItem,
  PurchaseDetail,
  PurchaseListItem,
  PurchaseListView,
  PurchasesAdminListInput,
  PurchasesKpis,
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

  // ---- admin ----------------------------------------------------------------

  adminList(
    organizationId: string,
    input: PurchasesAdminListInput,
  ): Promise<ListResult<PurchaseAdminListItem>> {
    return this.repo.adminList(organizationId, input);
  }

  listByIds(organizationId: string, ids: string[]): Promise<PurchaseAdminListItem[]> {
    return this.repo.listByIds(organizationId, ids);
  }

  adminKpis(
    organizationId: string,
    input: PurchasesAdminListInput,
  ): Promise<PurchasesKpis> {
    return this.repo.adminKpis(organizationId, input);
  }

  async adminGet(organizationId: string, id: string): Promise<PurchaseAdminDetail> {
    const detail = await this.repo.adminGet(organizationId, id);
    if (!detail) {
      throw new TRPCError({ code: "NOT_FOUND", message: "PURCHASE_NOT_FOUND" });
    }
    return detail;
  }

  /** Re-send the customer a full WhatsApp + in-app receipt of the purchase.
   *  Reuses the detail assembly for the payload; the notification renders it. */
  async resendReceipt(
    organizationId: string,
    purchaseId: string,
  ): Promise<{ enqueued: number }> {
    const detail = await this.adminGet(organizationId, purchaseId);
    await tasks.trigger("send-notification", {
      customerIds: [detail.customer.id],
      organizationId,
      notificationKey: "purchase-receipt",
      payload: {
        items: detail.items.map((i) => ({
          name: i.name ?? "—",
          qty: i.qty,
          unitAmountCents: i.unitAmountCents,
        })),
        subtotalCents: detail.subtotalCents,
        discountCents: detail.discountCents,
        totalCents: detail.totalCents,
        currency: detail.currency,
        stamps: detail.stampsEarned,
        points: detail.pointsEarned,
      },
    });
    return { enqueued: 1 };
  }
}
