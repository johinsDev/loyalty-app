import { z } from "zod";

/** Personal handle: 3–20 chars, lowercase letters / digits / underscore. */
export const NICKNAME_RE = /^[a-z0-9_]{3,20}$/;

export const checkNicknameInputSchema = z.object({
  nickname: z.string().trim().toLowerCase(),
});

export const updateNameInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export const updateNicknameInputSchema = z.object({
  nickname: z.string().trim().toLowerCase().regex(NICKNAME_RE),
});

/** Avatar is exactly one of: a preset id, a custom upload, or cleared. */
export const updateAvatarInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("preset"), preset: z.string().min(1).max(40) }),
  z.object({
    kind: z.literal("custom"),
    avatarUrl: z.string().url(),
    avatarThumbhash: z.string().min(1).nullable(),
  }),
  z.object({ kind: z.literal("clear") }),
]);

/** Nobody in the loyalty program was born before this. */
const MIN_BIRTHDAY = Date.UTC(1900, 0, 1);
/** The client sends UTC midnight of the day it displayed. A customer in a
 *  timezone ahead of UTC picking "today" therefore lands slightly in the
 *  future, so the upper bound is tomorrow rather than this instant. */
const FUTURE_SLACK_MS = 24 * 60 * 60 * 1000;

export const updateBirthdayInputSchema = z.object({
  birthday: z.coerce
    .date()
    .refine((d) => d.getTime() >= MIN_BIRTHDAY, { message: "birthday_too_old" })
    .refine((d) => d.getTime() <= Date.now() + FUTURE_SLACK_MS, {
      message: "birthday_in_future",
    })
    .nullable(),
});

/** Called AFTER the web client verified the new phone with
 *  `updatePhoneNumber: true` (which already swapped `user.phoneNumber`). This
 *  mirrors the new number onto the `customer` row and alerts the old one. */
export const confirmPhoneChangeInputSchema = z.object({
  newPhone: z.string().min(1),
});

export type CheckNicknameReason = "invalid" | "taken" | "self";

export interface CheckNicknameResult {
  available: boolean;
  reason?: CheckNicknameReason;
}

/** Consolidated profile for the customer's own profile screen. */
export interface ProfileMe {
  name: string | null;
  nickname: string | null;
  phone: string;
  /** Null when the only email is the synthetic `<phone>@phone.local`. */
  email: string | null;
  avatarPreset: string | null;
  avatarUrl: string | null;
  avatarThumbhash: string | null;
  /** Stored as UTC midnight of the picked day. Read it back with `getUTC*`. */
  birthday: Date | null;
  memberSince: Date;
  stats: {
    points: number;
    tierName: string;
    visits: number;
  };
  googleLinked: boolean;
  /** Whether `email` is a real address (not `<phone>@phone.local`). */
  hasRealEmail: boolean;
}

export type UpdateAvatarInput = z.infer<typeof updateAvatarInputSchema>;
