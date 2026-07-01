import { auth } from "@loyalty/auth/server";
import { recordAudit } from "@loyalty/db";
import { TRPCError } from "@trpc/server";
import { tasks } from "@trigger.dev/sdk/v3";

import { type ListResult, pageCountOf, pageOffset } from "../_shared/list";
import type { EmployeesRepository } from "./repository";
import {
  type ActivityEntry,
  type EmployeeActivityInput,
  type EmployeeDetail,
  type EmployeeListItem,
  type EmployeesListInput,
  type EmployeeSessionInfo,
  type EmployeeStats,
  type EmployeeStatus,
  type ImpersonateResult,
  type InviteEmployeeInput,
  type LeaderboardInput,
  type LeaderboardResult,
  type LeaderboardRow,
  type UpdateEmployeeInput,
} from "./schemas";

/**
 * The admin-plugin server endpoints we call. Better Auth can't infer these off
 * the `auth` proxy because the plugin array uses conditional spreads (which
 * widens the type and drops plugin endpoints), so we pin the exact shapes here
 * — the methods exist at runtime. `headers` carry the owner's session.
 */
interface AdminSession {
  id: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}
interface AdminApi {
  banUser(args: {
    body: { userId: string; banReason?: string };
    headers: Headers;
  }): Promise<unknown>;
  unbanUser(args: { body: { userId: string }; headers: Headers }): Promise<unknown>;
  listUserSessions(args: {
    body: { userId: string };
    headers: Headers;
  }): Promise<{ sessions: AdminSession[] }>;
  revokeUserSession(args: {
    body: { sessionToken: string };
    headers: Headers;
  }): Promise<unknown>;
  revokeUserSessions(args: {
    body: { userId: string };
    headers: Headers;
  }): Promise<unknown>;
}

const adminApi = auth.api as unknown as AdminApi;

/** The signed-in operator performing the action. `headers` carry their session
 *  so the Better Auth admin endpoints authorize the call (owner = user.role
 *  "admin"). */
export interface Actor {
  userId: string;
  headers: Headers;
}

type EmailEnqueue = (
  task: string,
  payload: Record<string, unknown>,
) => Promise<void>;

export interface EmployeesServiceOptions {
  /** Base URL of the admin app, used to build the invite-accept link. */
  adminBaseUrl?: string;
  /** Base URL of the customer web app, for customer-impersonation redirects. */
  webBaseUrl?: string;
  enqueueEmail?: EmailEnqueue;
}

const ROLE_RANK: Record<string, number> = {
  customer: 0,
  staff: 1,
  manager: 2,
  owner: 3,
};

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVITY_CAP = 500;

const defaultEnqueue: EmailEnqueue = async (task, payload) => {
  await tasks.trigger(task, payload);
};

/** Robust "start of local month" → UTC instant for a tz (no DST in Bogota, but
 *  the offset trick keeps it correct anywhere). */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUTC - date.getTime();
}

function zonedDayToUtc(y: number, m: number, d: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offset = tzOffsetMs(new Date(guess), tz);
  return new Date(guess - offset);
}

function monthRange(tz: string): { from: Date; to: Date; month: string } {
  const now = new Date();
  const ym = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  }).format(now);
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const from = zonedDayToUtc(y, m, 1, tz);
  const to = m === 12 ? zonedDayToUtc(y + 1, 1, 1, tz) : zonedDayToUtc(y, m + 1, 1, tz);
  return { from, to, month: `${yStr}-${mStr}` };
}

/** Resolve a leaderboard period to a UTC [from, to) window. */
function periodRange(
  period: LeaderboardInput["period"],
  tz: string,
  inFrom?: Date,
  inTo?: Date,
): { from: Date; to: Date } {
  const month = monthRange(tz);
  if (period === "month") return { from: month.from, to: month.to };
  if (period === "lastMonth") {
    const ym = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
    }).format(new Date());
    const [yStr, mStr] = ym.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const from = m === 1 ? zonedDayToUtc(y - 1, 12, 1, tz) : zonedDayToUtc(y, m - 1, 1, tz);
    return { from, to: month.from };
  }
  // range: inclusive of the `to` day (add a day for the exclusive upper bound).
  const from = inFrom ?? month.from;
  const to = inTo ? new Date(inTo.getTime() + 24 * 60 * 60 * 1000) : new Date();
  return { from, to };
}

function ymd(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Employee-management business logic over Better Auth `member`/`invitation`/
 * `user` + `store_staff`. Owner-only mutations are enforced at the router
 * (`ownerProcedure`); this layer adds the role-hierarchy + self/last-owner
 * guards, calls the admin-plugin endpoints (ban/sessions), writes the audit
 * trail, and enqueues the invite / email-change emails.
 */
export class EmployeesService {
  private readonly enqueue: EmailEnqueue;
  private readonly adminBaseUrl: string;
  private readonly webBaseUrl: string;

  constructor(
    private readonly repo: EmployeesRepository,
    opts: EmployeesServiceOptions = {},
  ) {
    this.enqueue = opts.enqueueEmail ?? defaultEnqueue;
    this.adminBaseUrl =
      opts.adminBaseUrl ??
      process.env.ADMIN_APP_URL ??
      "http://localhost:3003";
    this.webBaseUrl =
      opts.webBaseUrl ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "http://localhost:3002";
  }

  // ── List (members + pending invitations, merged in memory) ──────────────────
  async list(
    orgId: string,
    input: EmployeesListInput,
  ): Promise<ListResult<EmployeeListItem>> {
    const all = await this.buildRoster(orgId);

    let rows = all;
    if (input.q) {
      const q = input.q.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.name?.toLowerCase().includes(q) ?? false) ||
          (r.email?.toLowerCase().includes(q) ?? false),
      );
    }
    if (input.role?.length) rows = rows.filter((r) => input.role!.includes(r.role as never));
    if (input.status?.length) rows = rows.filter((r) => input.status!.includes(r.status));
    if (input.storeId?.length) {
      rows = rows.filter((r) =>
        r.stores.some((s) => input.storeId!.includes(s.id)),
      );
    }

    rows = this.sortRoster(rows, input.sort);

    const total = rows.length;
    const start = pageOffset(input.page, input.perPage);
    return {
      rows: rows.slice(start, start + input.perPage),
      total,
      pageCount: pageCountOf(total, input.perPage),
    };
  }

  /** The stores a cashier can operate the register for. Their assignments, or —
   *  when unassigned — every store so they can still work. */
  async myStores(orgId: string, userId: string) {
    const assigned = await this.repo.assignedStoresFor(orgId, userId);
    if (assigned.length > 0) return assigned;
    return this.repo.allStores(orgId);
  }

  async listByIds(orgId: string, ids: string[]): Promise<EmployeeListItem[]> {
    const all = await this.buildRoster(orgId);
    const set = new Set(ids);
    return all.filter((r) => set.has(r.id));
  }

  private async buildRoster(orgId: string): Promise<EmployeeListItem[]> {
    const [members, invites, assignments] = await Promise.all([
      this.repo.listMembers(orgId),
      this.repo.listPendingInvitations(orgId),
      this.repo.assignmentsByUser(orgId),
    ]);

    const memberRows: EmployeeListItem[] = members.map(({ member: m, user: u }) => ({
      kind: "member",
      id: m.id,
      userId: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: m.role,
      status: u.banned ? "disabled" : "active",
      stores: assignments.get(u.id) ?? [],
      rating: m.rating ?? null,
      createdAt: m.createdAt,
    }));

    // Resolve invitation store refs (names) up front.
    const inviteRows: EmployeeListItem[] = [];
    for (const inv of invites) {
      const storeIds = inv.assignedStoreIds ?? [];
      const stores = await this.repo.storesByIds(orgId, storeIds);
      inviteRows.push({
        kind: "invitation",
        id: inv.id,
        userId: null,
        name: null,
        email: inv.email,
        image: null,
        role: inv.role ?? "staff",
        status: "invited",
        stores,
        rating: null,
        createdAt: inv.expiresAt,
      });
    }

    return [...memberRows, ...inviteRows];
  }

  private sortRoster(
    rows: EmployeeListItem[],
    sort: EmployeesListInput["sort"],
  ): EmployeeListItem[] {
    const primary = sort[0];
    const dir = primary?.desc ? -1 : 1;
    const key = primary?.id ?? "role";
    const cmp = (a: EmployeeListItem, b: EmployeeListItem): number => {
      if (key === "name") return (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "") * dir;
      if (key === "createdAt") return (a.createdAt.getTime() - b.createdAt.getTime()) * dir;
      if (key === "rating") return ((a.rating ?? 0) - (b.rating ?? 0)) * dir;
      // role: owner → manager → staff
      return ((ROLE_RANK[b.role] ?? 0) - (ROLE_RANK[a.role] ?? 0)) * dir;
    };
    return [...rows].sort(cmp);
  }

  // ── Detail + stats + activity ───────────────────────────────────────────────
  async get(orgId: string, memberId: string): Promise<EmployeeDetail> {
    const row = await this.repo.getMemberDetail(orgId, memberId);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    const stores = await this.repo.storesByIds(
      orgId,
      await this.repo.assignedStoreIds(orgId, row.user.id),
    );
    const status: EmployeeStatus = row.user.banned ? "disabled" : "active";
    return {
      memberId: row.member.id,
      userId: row.user.id,
      name: row.user.name,
      email: row.user.email,
      phone: row.user.phoneNumber,
      image: row.user.image,
      role: row.member.role,
      status,
      rating: row.member.rating ?? null,
      notes: row.member.notes ?? null,
      stores,
      createdAt: row.member.createdAt,
      banReason: row.user.banReason ?? null,
    };
  }

  async stats(orgId: string, memberId: string, tz: string): Promise<EmployeeStats> {
    const row = await this.repo.getMemberDetail(orgId, memberId);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    const { from, to, month } = monthRange(tz);
    const agg = await this.repo.monthlyAgg(orgId, row.user.id, from, to);
    const stores = await this.repo.storesByIds(orgId, [...agg.keys()].filter((k) => k !== "—"));
    const nameById = new Map(stores.map((s) => [s.id, s.name]));

    const perStore = [...agg.entries()].map(([storeId, a]) => ({
      storeId,
      storeName: nameById.get(storeId) ?? "—",
      ...a,
    }));
    const total = perStore.reduce(
      (t, s) => ({
        sales: t.sales + s.sales,
        salesAmountCents: t.salesAmountCents + s.salesAmountCents,
        stamps: t.stamps + s.stamps,
        redemptions: t.redemptions + s.redemptions,
        pointsAwarded: t.pointsAwarded + s.pointsAwarded,
      }),
      { sales: 0, salesAmountCents: 0, stamps: 0, redemptions: 0, pointsAwarded: 0 },
    );
    return { month, perStore, total };
  }

  /** Cross-employee performance leaderboard for a period, ranked by revenue. */
  async leaderboard(
    orgId: string,
    input: LeaderboardInput,
    tz: string,
  ): Promise<LeaderboardResult> {
    const { from, to } = periodRange(input.period, tz, input.from, input.to);
    const [members, agg] = await Promise.all([
      this.repo.listMembers(orgId),
      this.repo.leaderboardAgg(orgId, from, to, input.storeId),
    ]);
    const rows: LeaderboardRow[] = members.map(({ member: m, user: u }) => {
      const a = agg.get(u.id);
      const sales = a?.sales ?? 0;
      const revenueCents = a?.revenueCents ?? 0;
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        role: m.role,
        sales,
        revenueCents,
        avgTicketCents: sales > 0 ? Math.round(revenueCents / sales) : 0,
        maxTicketCents: a?.maxTicketCents ?? 0,
        uniqueCustomers: a?.uniqueCustomers ?? 0,
        stamps: a?.stamps ?? 0,
        redemptions: a?.redemptions ?? 0,
        points: a?.points ?? 0,
      };
    });
    rows.sort((x, y) => y.revenueCents - x.revenueCents);
    return {
      from: ymd(from, tz),
      to: ymd(new Date(to.getTime() - 1), tz),
      rows: input.limit ? rows.slice(0, input.limit) : rows,
    };
  }

  async activity(
    orgId: string,
    input: EmployeeActivityInput,
  ): Promise<ListResult<ActivityEntry>> {
    const row = await this.repo.getMemberDetail(orgId, input.memberId);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    const [audit, loyalty] = await Promise.all([
      this.repo.auditEvents(orgId, row.user.id, ACTIVITY_CAP),
      this.repo.loyaltyEvents(orgId, row.user.id, ACTIVITY_CAP),
    ]);
    let merged = [...audit, ...loyalty];
    if (input.types?.length) {
      const set = new Set(input.types);
      merged = merged.filter((e) => set.has(e.type));
    }
    if (input.storeId?.length) {
      // Store filter keeps only store-attributed (loyalty) events at those stores.
      const set = new Set(input.storeId);
      merged = merged.filter((e) => {
        const storeId = (e.metadata as Record<string, unknown> | null)?.storeId;
        return typeof storeId === "string" && set.has(storeId);
      });
    }
    if (input.from) merged = merged.filter((e) => e.createdAt >= input.from!);
    if (input.to) merged = merged.filter((e) => e.createdAt <= input.to!);
    merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = merged.length;
    const start = pageOffset(input.page, input.perPage);
    return {
      rows: merged.slice(start, start + input.perPage),
      total,
      pageCount: pageCountOf(total, input.perPage),
    };
  }

  // ── Mutations ───────────────────────────────────────────────────────────────
  async invite(
    orgId: string,
    actor: Actor,
    input: InviteEmployeeInput,
  ): Promise<{ invitationId: string }> {
    const existing = await this.repo.findPendingInvitationByEmail(orgId, input.email);
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: "Ya hay una invitación pendiente para ese correo." });
    }
    const existingUser = await this.repo.findUserByEmail(input.email);
    if (existingUser) {
      const member = await this.repo.getMemberByUserId(orgId, existingUser.id);
      if (member && !member.deletedAt) {
        throw new TRPCError({ code: "CONFLICT", message: "Esa persona ya es parte del equipo." });
      }
    } else {
      // Eager-create a bare user so the invitee can sign in via magic-link
      // (the passwordless admin disables signup for unknown emails).
      await this.repo.createUser(input.email);
    }
    const inv = await this.repo.createInvitation({
      organizationId: orgId,
      email: input.email,
      role: input.role,
      inviterId: actor.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      assignedStoreIds: input.storeIds,
    });
    const acceptUrl = `${this.adminBaseUrl}/aceptar-invitacion?invitationId=${inv.id}`;
    await this.enqueue("send-employee-invite", {
      email: input.email,
      role: input.role,
      acceptUrl,
      organizationId: orgId,
    });
    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      type: "invite_sent",
      metadata: { email: input.email, role: input.role, storeIds: input.storeIds },
    });
    return { invitationId: inv.id };
  }

  /** Public: the email + role of a pending invitation, so the accept page can
   *  send the sign-in magic-link and show who was invited. */
  async pendingInvitation(
    invitationId: string,
  ): Promise<{ email: string; role: string } | null> {
    const inv = await this.repo.getInvitation(invitationId);
    if (!inv || inv.status !== "pending" || inv.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return { email: inv.email, role: inv.role ?? "staff" };
  }

  /** Accept a pending invitation as the signed-in user (creates the member +
   *  store assignments). Orchestrated here so we apply stores + audit. The
   *  signed-in email must match the invited email. */
  async acceptInvitation(actor: Actor, invitationId: string): Promise<{ memberId: string }> {
    const inv = await this.repo.getInvitation(invitationId);
    if (!inv || inv.status !== "pending") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invitación no válida." });
    }
    if (inv.expiresAt.getTime() < Date.now()) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La invitación expiró." });
    }
    const actorUser = await this.repo.findUserById(actor.userId);
    if (!actorUser || actorUser.email?.toLowerCase() !== inv.email.toLowerCase()) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Esta invitación es para otro correo.",
      });
    }
    const existing = await this.repo.getMemberByUserId(inv.organizationId, actor.userId);
    const member =
      existing && !existing.deletedAt
        ? existing
        : await this.repo.createMember({
            organizationId: inv.organizationId,
            userId: actor.userId,
            role: inv.role ?? "staff",
          });
    if (existing?.deletedAt) {
      await this.repo.patchMember(existing.id, { deletedAt: null, role: inv.role ?? "staff" });
    }
    await this.repo.setAssignments(
      inv.organizationId,
      actor.userId,
      inv.assignedStoreIds ?? [],
    );
    await this.repo.setInvitationStatus(inv.id, "accepted");
    await recordAudit({
      organizationId: inv.organizationId,
      actorUserId: actor.userId,
      targetUserId: actor.userId,
      type: "invite_accepted",
      metadata: { role: inv.role },
    });
    return { memberId: member.id };
  }

  async update(orgId: string, actor: Actor, input: UpdateEmployeeInput): Promise<void> {
    const row = await this.requireTarget(orgId, input.memberId, actor);
    const memberPatch: Record<string, unknown> = {};
    const userPatch: Record<string, unknown> = {};
    if (input.name !== undefined) userPatch.name = input.name;
    if (input.phone !== undefined) userPatch.phoneNumber = input.phone;
    if (input.notes !== undefined) memberPatch.notes = input.notes;
    if (input.rating !== undefined) memberPatch.rating = input.rating;
    if (input.role && input.role !== row.member.role) {
      memberPatch.role = input.role;
      await recordAudit({
        organizationId: orgId,
        actorUserId: actor.userId,
        targetUserId: row.user.id,
        type: "role_change",
        metadata: { from: row.member.role, to: input.role },
      });
    }
    if (Object.keys(userPatch).length) await this.repo.patchUser(row.user.id, userPatch);
    if (Object.keys(memberPatch).length) await this.repo.patchMember(row.member.id, memberPatch);
    if (input.storeIds) {
      await this.repo.setAssignments(orgId, row.user.id, input.storeIds);
      await recordAudit({
        organizationId: orgId,
        actorUserId: actor.userId,
        targetUserId: row.user.id,
        type: "stores_change",
        metadata: { storeIds: input.storeIds },
      });
    }
  }

  async setRating(orgId: string, actor: Actor, memberId: string, rating: number | null): Promise<void> {
    const row = await this.requireTarget(orgId, memberId, actor);
    await this.repo.patchMember(row.member.id, { rating });
    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      targetUserId: row.user.id,
      type: "rating_change",
      metadata: { rating },
    });
  }

  async changeEmail(orgId: string, actor: Actor, memberId: string, email: string): Promise<void> {
    const row = await this.requireTarget(orgId, memberId, actor);
    const oldEmail = row.user.email;
    await this.repo.patchUser(row.user.id, { email, emailVerified: false });
    await this.enqueue("send-employee-email-change", {
      oldEmail,
      newEmail: email,
      organizationId: orgId,
    });
    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      targetUserId: row.user.id,
      type: "email_change",
      metadata: { from: oldEmail, to: email },
    });
  }

  async disable(orgId: string, actor: Actor, memberId: string, reason?: string): Promise<void> {
    const row = await this.requireTarget(orgId, memberId, actor);
    await adminApi.banUser({
      body: { userId: row.user.id, banReason: reason },
      headers: actor.headers,
    });
    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      targetUserId: row.user.id,
      type: "disable",
      metadata: { reason: reason ?? null },
    });
  }

  async enable(orgId: string, actor: Actor, memberId: string): Promise<void> {
    const row = await this.requireTarget(orgId, memberId, actor);
    await adminApi.unbanUser({ body: { userId: row.user.id }, headers: actor.headers });
    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      targetUserId: row.user.id,
      type: "enable",
    });
  }

  async remove(orgId: string, actor: Actor, memberId: string): Promise<void> {
    const row = await this.requireTarget(orgId, memberId, actor);
    if (row.member.role === "owner") {
      throw new TRPCError({ code: "FORBIDDEN", message: "No se puede eliminar al dueño." });
    }
    // Revoke sessions + ban so a deleted employee can't keep working.
    await adminApi.banUser({
      body: { userId: row.user.id, banReason: "deleted" },
      headers: actor.headers,
    });
    await this.repo.softDeleteMember(row.member.id);
    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      targetUserId: row.user.id,
      type: "delete",
    });
  }

  /** Best-effort bulk delete over selected roster ids (member ids; invitation
   *  ids and guarded rows — owner/self — are skipped). */
  async bulkRemove(orgId: string, actor: Actor, ids: string[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.remove(orgId, actor, id);
      } catch {
        // skip non-members / owner / self
      }
    }
  }

  async bulkSetDisabled(
    orgId: string,
    actor: Actor,
    ids: string[],
    disabled: boolean,
  ): Promise<void> {
    for (const id of ids) {
      try {
        if (disabled) await this.disable(orgId, actor, id);
        else await this.enable(orgId, actor, id);
      } catch {
        // skip non-members / owner / self
      }
    }
  }

  async listSessions(
    orgId: string,
    actor: Actor,
    memberId: string,
  ): Promise<EmployeeSessionInfo[]> {
    const row = await this.requireTarget(orgId, memberId, actor);
    const { sessions } = await adminApi.listUserSessions({
      body: { userId: row.user.id },
      headers: actor.headers,
    });
    return sessions
      .map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        ipAddress: s.ipAddress ?? null,
        userAgent: s.userAgent ?? null,
        current: false,
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async revokeSessions(
    orgId: string,
    actor: Actor,
    memberId: string,
    sessionToken?: string,
  ): Promise<void> {
    const row = await this.requireTarget(orgId, memberId, actor);
    if (sessionToken) {
      await adminApi.revokeUserSession({
        body: { sessionToken },
        headers: actor.headers,
      });
    } else {
      await adminApi.revokeUserSessions({
        body: { userId: row.user.id },
        headers: actor.headers,
      });
    }
    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      targetUserId: row.user.id,
      type: "session_revoke",
      metadata: { sessionToken: sessionToken ?? "all" },
    });
  }

  /** Validate an impersonation target + write the start audit. The browser mints
   *  the session via `authClient.admin.impersonateUser`. Customers redirect into
   *  the web app. */
  async impersonate(orgId: string, actor: Actor, userId: string): Promise<ImpersonateResult> {
    if (userId === actor.userId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes impersonarte a ti mismo." });
    }
    const member = await this.repo.getMemberByUserId(orgId, userId);
    const isCustomer = !member || member.role === "customer";
    if (member && member.role === "owner") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      targetUserId: userId,
      type: "impersonation_start",
      metadata: { isCustomer },
    });
    return { userId, isCustomer };
  }

  async logImpersonationStop(orgId: string, actor: Actor): Promise<void> {
    await recordAudit({
      organizationId: orgId,
      actorUserId: actor.userId,
      type: "impersonation_stop",
    });
  }

  /** Resolve the target member, refusing self-destructive ops on the owner. */
  private async requireTarget(
    orgId: string,
    memberId: string,
    actor: Actor,
  ): Promise<NonNullable<Awaited<ReturnType<EmployeesRepository["getMemberDetail"]>>>> {
    const row = await this.repo.getMemberDetail(orgId, memberId);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    if (row.user.id === actor.userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "No puedes modificarte a ti mismo aquí." });
    }
    return row;
  }
}
