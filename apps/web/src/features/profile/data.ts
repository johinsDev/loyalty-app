/**
 * Hardcoded profile sample — a faithful port of the "T4 · Perfil" Claude Design
 * template. Local/design-first until a customer-profile API lands; the editable
 * fields below live in component state. Stats mirror the home/rewards demo data.
 */

export const profile = {
  name: "Ari Tanaka",
  nickname: "ari",
  email: "ari.tanaka@gmail.com",
  /** 1-indexed month + day + year. */
  birthday: { month: 7, day: 14, year: 1998 },
  memberSince: "Mar 2024",
  points: 312,
  tier: "Hoja",
  visits: 47,
  emailVerified: true,
  googleLinked: true,
} as const;

export type TeaAvatar = {
  id: string;
  emoji: string;
  /** [from, to] for the avatar's diagonal gradient. */
  gradient: readonly [string, string];
};

/** Predefined tea avatars. The admin will be able to manage these later. */
export const teaAvatars: readonly TeaAvatar[] = [
  { id: "matcha", emoji: "🍵", gradient: ["#b9f3e4", "#4fd1b5"] },
  { id: "boba", emoji: "🧋", gradient: ["#d9c9ff", "#9d7bff"] },
  { id: "strawberry", emoji: "🍓", gradient: ["#ffd6e7", "#ff8fb8"] },
  { id: "peach", emoji: "🍑", gradient: ["#ffe0c2", "#ffb05f"] },
  { id: "leaf", emoji: "🍃", gradient: ["#d6f5c9", "#8fd96f"] },
  { id: "blossom", emoji: "🌸", gradient: ["#ffd0ad", "#ff9d6e"] },
  { id: "teapot", emoji: "🫖", gradient: ["#c9d8ff", "#7e9bff"] },
  { id: "honey", emoji: "🍯", gradient: ["#fff0c2", "#ffce4f"] },
];

/** Custom avatar upload validation. */
export const AVATAR_ACCEPT = ["image/png", "image/jpeg", "image/webp"] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export const APP_VERSION = "T4 Tea · v1.0.0";
