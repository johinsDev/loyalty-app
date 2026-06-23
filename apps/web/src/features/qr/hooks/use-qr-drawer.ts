import { create } from "zustand";

/** Which pending reward the drawer should render a claim QR for (if any). */
export type ClaimKind = "stamp" | "streak" | null;

/**
 * Shared open-state for the member-QR drawer. The drawer is mounted once (in the
 * locale layout); the scan CTA, the bottom-nav FAB and the sidebar scan button
 * all open it through this store, so the QR shows over the current screen
 * instead of navigating away. `claimKind` lets a reward banner/card open the
 * drawer straight into a specific claim (stamp wallet vs streak reward).
 */
type QrDrawerState = {
  open: boolean;
  claimKind: ClaimKind;
  setOpen: (open: boolean) => void;
  openDrawer: () => void;
  /** Open the drawer to claim a specific reward kind. */
  openClaim: (kind: ClaimKind) => void;
};

export const useQrDrawer = create<QrDrawerState>((set) => ({
  open: false,
  claimKind: null,
  setOpen: (open) => set(open ? { open } : { open: false, claimKind: null }),
  openDrawer: () => set({ open: true, claimKind: null }),
  openClaim: (kind) => set({ open: true, claimKind: kind }),
}));
