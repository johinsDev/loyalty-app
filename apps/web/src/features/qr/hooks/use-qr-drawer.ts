import { create } from "zustand";

/** Which currency a reward claim spends. "both" = an "and"-cost reward. */
export type ClaimCurrency = "stamps" | "points" | "both";

/**
 * What the QR view is currently encoding:
 * - `identity` — the member QR (`T4|<customerId>`), the default.
 * - `reward` — a signed single-use reward claim token (`T4P|<token>`).
 * - `streak` — the pending streak reward claim token (`T4S|<token>`).
 */
export type QrMode =
  | { kind: "identity" }
  | { kind: "reward"; rewardId: string; currency: ClaimCurrency }
  | { kind: "streak" };

/**
 * Shared open-state for the member-QR drawer. The drawer is mounted once (in the
 * locale layout); the scan CTA, the bottom-nav FAB and the sidebar scan button
 * all open it through this store, so the QR shows over the current screen
 * instead of navigating away. The unified view shows the member identity by
 * default and lets the customer switch to a ready reward / the streak reward via
 * an in-drawer selector. `openClaim(mode)` opens straight into a specific claim
 * (e.g. the rewards detail "Reclamar" button).
 */
type QrDrawerState = {
  open: boolean;
  mode: QrMode;
  setOpen: (open: boolean) => void;
  /** Open the drawer to the member identity QR. */
  openDrawer: () => void;
  /** Open the drawer straight into a specific reward / streak claim. */
  openClaim: (mode: QrMode) => void;
  /** Switch what the open drawer is encoding (from the in-drawer selector). */
  setMode: (mode: QrMode) => void;
};

const IDENTITY: QrMode = { kind: "identity" };

export const useQrDrawer = create<QrDrawerState>((set) => ({
  open: false,
  mode: IDENTITY,
  setOpen: (open) => set(open ? { open } : { open: false, mode: IDENTITY }),
  openDrawer: () => set({ open: true, mode: IDENTITY }),
  openClaim: (mode) => set({ open: true, mode }),
  setMode: (mode) => set({ mode }),
}));
