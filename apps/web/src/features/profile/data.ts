/**
 * Static design tokens for the profile screen. The editable fields (name,
 * nickname, avatar, stats, …) now come from the `profile` tRPC router — see
 * {@link import("./components/profile-screen").ProfileScreen}. Only the avatar
 * presets + upload constraints + app version stay here.
 */

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
