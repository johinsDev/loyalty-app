import { auth } from "@loyalty/auth/server";
import { phoneNumberInUse, recordAudit } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import type { ListResult } from "../_shared/list";
import type { CustomersRepository } from "./repository";
import { MARKETING_CHANNELS } from "./schemas";
import type {
  CheckAvailabilityInput,
  CreateCustomerInput,
  CustomerDetail,
  CustomerListItem,
  CustomersKpis,
  CustomersListInput,
  CustomerStats,
  LedgerInput,
  LedgerView,
  MarketingChannel,
  PointsLedgerRow,
  RedemptionHistoryRow,
  StampsHistoryRow,
  TimelineInput,
  TimelineView,
  UpdateCustomerInput,
} from "./schemas";

/** The Better Auth admin endpoints we call (typed here — the plugin array's
 *  conditional spreads drop them from the inferred `auth.api` type). */
interface AdminApi {
  banUser(args: { body: { userId: string; banReason?: string }; headers: Headers }): Promise<unknown>;
  unbanUser(args: { body: { userId: string }; headers: Headers }): Promise<unknown>;
  revokeUserSessions(args: { body: { userId: string }; headers: Headers }): Promise<unknown>;
}
const adminApi = auth.api as unknown as AdminApi;

/** The signed-in operator; `headers` authorize the Better Auth admin calls.
 *  The optional writers let create/update reach loyalty + notification
 *  preferences without this service importing those heavy graphs — the router
 *  wires them to the real services. */
export interface Actor {
  userId: string;
  headers: Headers;
  applyStamps?: (customerId: string, amount: number, reason: string) => Promise<void>;
  applyPoints?: (customerId: string, amount: number, reason: string) => Promise<void>;
  setMarketing?: (
    customerId: string,
    channel: MarketingChannel,
    enabled: boolean,
  ) => Promise<void>;
}

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

  timeline(orgId: string, input: TimelineInput): Promise<TimelineView> {
    return this.repo.timeline(orgId, input);
  }

  checkAvailability(orgId: string, input: CheckAvailabilityInput): Promise<boolean> {
    return this.repo.checkAvailability(orgId, input);
  }
}

/** Write-side CRM actions. Extends the read service so the router can build one
 *  service for both. Ban/unban operate on `customer.id` (=== Better Auth
 *  `user.id`); every action is audited. */
export class CustomersService extends CustomersReadService {
  private async requireCustomer(orgId: string, id: string): Promise<void> {
    if (!(await this.repo.exists(orgId, id))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "CUSTOMER_NOT_FOUND" });
    }
  }

  async ban(orgId: string, actor: Actor, customerId: string, reason: string): Promise<void> {
    await this.requireCustomer(orgId, customerId);
    await adminApi.banUser({ body: { userId: customerId, banReason: reason }, headers: actor.headers });
    // Revoke active sessions so a banned customer is kicked out immediately.
    await adminApi.revokeUserSessions({ body: { userId: customerId }, headers: actor.headers });
    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      targetUserId: customerId,
      type: "customer_ban",
      metadata: { reason },
    });
  }

  async unban(orgId: string, actor: Actor, customerId: string): Promise<void> {
    await this.requireCustomer(orgId, customerId);
    await adminApi.unbanUser({ body: { userId: customerId }, headers: actor.headers });
    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      targetUserId: customerId,
      type: "customer_unban",
    });
  }

  async update(orgId: string, actor: Actor, input: UpdateCustomerInput): Promise<void> {
    await this.requireCustomer(orgId, input.id);
    const changed: string[] = [];

    if (input.phone !== undefined) {
      // Phone is the login identifier — enforce uniqueness on BOTH the customer
      // (org-scoped) and the Better Auth user (global) before swapping.
      const okCustomer = await this.repo.checkAvailability(orgId, {
        field: "phone",
        value: input.phone,
        excludeId: input.id,
      });
      const takenByUser = await phoneNumberInUse(input.phone, input.id);
      if (!okCustomer || takenByUser) {
        throw new TRPCError({ code: "CONFLICT", message: "PHONE_IN_USE" });
      }
      await this.repo.changePhone(orgId, input.id, input.phone);
      changed.push("phone");
    }

    if (input.nickname !== undefined && input.nickname) {
      const ok = await this.repo.checkAvailability(orgId, {
        field: "nickname",
        value: input.nickname,
        excludeId: input.id,
      });
      if (!ok) throw new TRPCError({ code: "CONFLICT", message: "NICKNAME_IN_USE" });
    }

    const patch: Parameters<CustomersRepository["updateFields"]>[2] = {};
    if (input.name !== undefined) {
      patch.name = input.name || null;
      changed.push("name");
    }
    if (input.email !== undefined) {
      patch.email = input.email;
      changed.push("email");
    }
    if (input.nickname !== undefined) {
      patch.nickname = input.nickname ? input.nickname.toLowerCase() : null;
      changed.push("nickname");
    }
    if (input.birthday !== undefined) {
      patch.birthday = input.birthday;
      changed.push("birthday");
    }
    if (input.notes !== undefined) {
      patch.notes = input.notes || null;
      changed.push("notes");
    }
    if (Object.keys(patch).length > 0) await this.repo.updateFields(orgId, input.id, patch);

    if (input.marketingChannels !== undefined && actor.setMarketing) {
      const opted = new Set(input.marketingChannels);
      await Promise.all(
        MARKETING_CHANNELS.map((ch) => actor.setMarketing!(input.id, ch, opted.has(ch))),
      );
      changed.push("channels");
    }

    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      targetUserId: input.id,
      type: "customer_update",
      metadata: { changed },
    });
  }

  /**
   * Admin create: mint a phone-first Better Auth user, insert the customer row,
   * apply any initial loyalty load, store per-channel marketing opt-outs, and
   * audit. The loyalty + preference writers are injected on the actor so this
   * service stays free of the heavy stamps/points/notifications graphs.
   * Returns the new customer id.
   */
  async create(orgId: string, actor: Actor, input: CreateCustomerInput): Promise<string> {
    const okCustomer = await this.repo.checkAvailability(orgId, {
      field: "phone",
      value: input.phone,
    });
    if (!okCustomer || (await phoneNumberInUse(input.phone))) {
      throw new TRPCError({ code: "CONFLICT", message: "PHONE_IN_USE" });
    }
    if (input.nickname) {
      const ok = await this.repo.checkAvailability(orgId, {
        field: "nickname",
        value: input.nickname,
      });
      if (!ok) throw new TRPCError({ code: "CONFLICT", message: "NICKNAME_IN_USE" });
    }

    const id = await this.repo.mintPhoneUser({
      phone: input.phone,
      name: input.name || null,
      email: input.email ?? null,
    });
    await this.repo.insert({
      id,
      orgId,
      phone: input.phone,
      name: input.name || null,
      email: input.email ?? null,
      nickname: input.nickname ? input.nickname.toLowerCase() : null,
      birthday: input.birthday ?? null,
      notes: input.notes || null,
    });

    if (input.initialStamps && actor.applyStamps) {
      await actor.applyStamps(id, input.initialStamps, "alta inicial");
    }
    if (input.initialPoints && actor.applyPoints) {
      await actor.applyPoints(id, input.initialPoints, "alta inicial");
    }
    if (input.marketingChannels && actor.setMarketing) {
      const opted = new Set(input.marketingChannels);
      await Promise.all(
        MARKETING_CHANNELS.map((ch) => actor.setMarketing!(id, ch, opted.has(ch))),
      );
    }

    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      targetUserId: id,
      type: "customer_create",
    });
    return id;
  }

  /**
   * Cashier quick-register (post-PIN): mint a phone-first user + customer row,
   * tagged with the acquisition channel/store. No initial loyalty or marketing —
   * a lean create for the POS. Phone availability is re-checked (the PIN window
   * could have raced another registration). Returns the new customer id.
   */
  async quickCreate(
    orgId: string,
    actor: Actor,
    input: { phone: string; name: string | null; acquisitionStoreId: string | null },
  ): Promise<string> {
    const ok = await this.repo.checkAvailability(orgId, { field: "phone", value: input.phone });
    if (!ok || (await phoneNumberInUse(input.phone))) {
      throw new TRPCError({ code: "CONFLICT", message: "PHONE_IN_USE" });
    }
    const id = await this.repo.mintPhoneUser({
      phone: input.phone,
      name: input.name,
      email: null,
    });
    await this.repo.insert({
      id,
      orgId,
      phone: input.phone,
      name: input.name,
      email: null,
      nickname: null,
      birthday: null,
      notes: null,
      acquisitionChannel: "staff-register",
      acquisitionStoreId: input.acquisitionStoreId,
    });
    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      targetUserId: id,
      type: "customer_create",
    });
    return id;
  }
}
