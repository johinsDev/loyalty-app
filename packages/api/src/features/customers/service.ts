import { TRPCError } from "@trpc/server";

import type { ListResult } from "../_shared/list";
import type { CustomersRepository } from "./repository";
import type {
  CheckAvailabilityInput,
  CustomerDetail,
  CustomerListItem,
  CustomersKpis,
  CustomersListInput,
  CustomerStats,
  LedgerInput,
  LedgerView,
  PointsLedgerRow,
  RedemptionHistoryRow,
  StampsHistoryRow,
} from "./schemas";

/** Read-side business logic for the admin CRM. Thin over the repository; the
 *  heavy joins/aggregates live there. Write actions (create/update/ban) and
 *  the timeline are added by the service extensions. */
export class CustomersReadService {
  constructor(protected readonly repo: CustomersRepository) {}

  adminList(orgId: string, input: CustomersListInput): Promise<ListResult<CustomerListItem>> {
    return this.repo.adminList(orgId, input);
  }

  listByIds(orgId: string, ids: string[]): Promise<CustomerListItem[]> {
    return this.repo.listByIds(orgId, ids);
  }

  adminKpis(orgId: string): Promise<CustomersKpis> {
    return this.repo.adminKpis(orgId);
  }

  async adminGet(orgId: string, id: string): Promise<CustomerDetail> {
    const detail = await this.repo.adminGet(orgId, id);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "CUSTOMER_NOT_FOUND" });
    return detail;
  }

  stats(orgId: string, customerId: string): Promise<CustomerStats> {
    return this.repo.stats(orgId, customerId);
  }

  pointsLedger(orgId: string, input: LedgerInput): Promise<LedgerView<PointsLedgerRow>> {
    return this.repo.pointsLedger(orgId, input);
  }

  stampsHistory(orgId: string, input: LedgerInput): Promise<LedgerView<StampsHistoryRow>> {
    return this.repo.stampsHistory(orgId, input);
  }

  redemptionsHistory(orgId: string, input: LedgerInput): Promise<LedgerView<RedemptionHistoryRow>> {
    return this.repo.redemptionsHistory(orgId, input);
  }

  checkAvailability(orgId: string, input: CheckAvailabilityInput): Promise<boolean> {
    return this.repo.checkAvailability(orgId, input);
  }
}
