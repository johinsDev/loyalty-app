import { TRPCError } from "@trpc/server";
import { tasks } from "@trigger.dev/sdk/v3";

import type { ProfileRepository } from "./repository";
import {
  type CheckNicknameResult,
  NICKNAME_RE,
  type ProfileMe,
  type UpdateAvatarInput,
} from "./schemas";

const TEMP_EMAIL_SUFFIX = "@phone.local";

/** Real (not the synthetic `<phone>@phone.local` phone-first placeholder). */
function isRealEmail(email: string | null): boolean {
  return !!email && !email.endsWith(TEMP_EMAIL_SUFFIX);
}

/** Mask all but the last 4 digits: `+573001234567` → `••••4567`. */
function maskPhone(phone: string): string {
  const tail = phone.slice(-4);
  return `••••${tail}`;
}

/** Explicit recipient override so the alert reaches the OLD number/email even
 *  though the async job runs after the row is updated (the engine skips the
 *  customer-row lookup when a fully-resolved notifiable is passed). */
interface RecipientOverride {
  phone: string;
  email: string | null;
  name: string | null;
}

type Enqueue = (payload: {
  customerIds: string[];
  organizationId: string;
  notificationKey: "phone-changed";
  payload?: Record<string, unknown>;
  recipient?: RecipientOverride;
}) => Promise<void>;

const defaultEnqueue: Enqueue = async (payload) => {
  await tasks.trigger("send-notification", payload);
};

export interface ProfileServiceOptions {
  /** Reuses the points feature for the stats header (balance + current tier). */
  pointsSummary: (
    orgId: string,
    customerId: string,
  ) => Promise<{ balance: number; tierName: string }>;
  enqueue?: Enqueue;
}

/**
 * Customer profile business logic. Reads/writes the org-scoped `customer` row
 * (name / nickname / avatar / phone / email), composes the stats header from
 * the points feature + visit count, and — on a phone change — mirrors the new
 * number onto `customer` and alerts the OLD number. The actual `user.phoneNumber`
 * swap and Google linking happen client-side via Better Auth; this service only
 * owns the org-scoped mirror + notifications.
 */
export class ProfileService {
  constructor(
    private readonly repo: ProfileRepository,
    private readonly opts: ProfileServiceOptions,
  ) {}

  async me(orgId: string, customerId: string): Promise<ProfileMe> {
    const row = await this.repo.get(orgId, customerId);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    const [visits, googleLinked, points] = await Promise.all([
      this.repo.visitCount(orgId, customerId),
      this.repo.googleLinked(customerId),
      this.opts.pointsSummary(orgId, customerId),
    ]);
    const real = isRealEmail(row.email);
    return {
      name: row.name,
      nickname: row.nickname,
      phone: row.phone,
      email: real ? row.email : null,
      avatarPreset: row.avatarPreset,
      avatarUrl: row.avatarUrl,
      avatarThumbhash: row.avatarThumbhash,
      memberSince: row.createdAt,
      stats: { points: points.balance, tierName: points.tierName, visits },
      googleLinked,
      hasRealEmail: real,
    };
  }

  async checkNickname(
    orgId: string,
    customerId: string,
    raw: string,
  ): Promise<CheckNicknameResult> {
    const nickname = raw.trim().toLowerCase();
    if (!NICKNAME_RE.test(nickname)) {
      return { available: false, reason: "invalid" };
    }
    const current = await this.repo.get(orgId, customerId);
    if (current?.nickname === nickname) {
      return { available: true, reason: "self" };
    }
    const taken = await this.repo.nicknameTaken(orgId, nickname, customerId);
    return taken ? { available: false, reason: "taken" } : { available: true };
  }

  async updateName(
    orgId: string,
    customerId: string,
    name: string,
  ): Promise<{ ok: true }> {
    await this.repo.updateName(orgId, customerId, name);
    return { ok: true };
  }

  /** Re-checks availability (TOCTOU) then relies on the unique index as the
   *  hard guard; a constraint hit surfaces as CONFLICT. */
  async updateNickname(
    orgId: string,
    customerId: string,
    nickname: string,
  ): Promise<{ ok: true }> {
    const taken = await this.repo.nicknameTaken(orgId, nickname, customerId);
    if (taken) throw new TRPCError({ code: "CONFLICT", message: "nickname-taken" });
    try {
      await this.repo.updateNickname(orgId, customerId, nickname);
    } catch {
      throw new TRPCError({ code: "CONFLICT", message: "nickname-taken" });
    }
    return { ok: true };
  }

  updateAvatar(
    orgId: string,
    customerId: string,
    input: UpdateAvatarInput,
  ): Promise<void> {
    const patch =
      input.kind === "preset"
        ? { avatarPreset: input.preset, avatarUrl: null, avatarThumbhash: null }
        : input.kind === "custom"
          ? {
              avatarPreset: null,
              avatarUrl: input.avatarUrl,
              avatarThumbhash: input.avatarThumbhash,
            }
          : { avatarPreset: null, avatarUrl: null, avatarThumbhash: null };
    return this.repo.updateAvatar(orgId, customerId, patch);
  }

  /** Called AFTER the web client swapped `user.phoneNumber` (Better Auth
   *  `verify({updatePhoneNumber:true})`). Mirrors the new number onto the
   *  `customer` row and alerts the OLD number/email. Re-reads the swapped
   *  `user.phoneNumber` to guard against a stale/forged call. */
  async confirmPhoneChange(
    orgId: string,
    customerId: string,
    newPhone: string,
  ): Promise<{ ok: true }> {
    // Authoritative guard: the client must have already swapped the login
    // phone (`user.phoneNumber`) via Better Auth before we mirror it.
    const swapped = await this.repo.userPhoneNumber(customerId);
    if (swapped !== newPhone) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "phone-not-swapped",
      });
    }
    const row = await this.repo.get(orgId, customerId);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    if (row.phone === newPhone) return { ok: true }; // idempotent

    const oldPhone = row.phone;
    const oldEmail = isRealEmail(row.email) ? row.email : null;
    await this.enqueue({
      customerIds: [customerId],
      organizationId: orgId,
      notificationKey: "phone-changed",
      payload: { newPhoneMasked: maskPhone(newPhone) },
      recipient: { phone: oldPhone, email: oldEmail, name: row.name },
    });

    try {
      await this.repo.updatePhone(orgId, customerId, newPhone);
    } catch {
      throw new TRPCError({ code: "CONFLICT", message: "phone-taken" });
    }
    return { ok: true };
  }

  /** Mirror the session user's (Google-provided, verified) email onto the
   *  `customer` row after a successful social link. No-op for placeholder
   *  emails. */
  async syncEmail(
    orgId: string,
    customerId: string,
    sessionEmail: string | null | undefined,
  ): Promise<{ ok: boolean }> {
    if (!isRealEmail(sessionEmail ?? null)) return { ok: false };
    await this.repo.updateEmail(orgId, customerId, sessionEmail as string);
    return { ok: true };
  }

  private async enqueue(payload: Parameters<Enqueue>[0]): Promise<void> {
    const fn = this.opts.enqueue ?? defaultEnqueue;
    try {
      await fn(payload);
    } catch {
      // best-effort
    }
  }
}
