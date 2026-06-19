import { create } from "zustand";

/**
 * Shared open-state for the member-QR drawer. The drawer is mounted once (in the
 * locale layout); the scan CTA, the bottom-nav FAB and the sidebar scan button
 * all open it through this store, so the QR shows over the current screen
 * instead of navigating away.
 */
type QrDrawerState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openDrawer: () => void;
};

export const useQrDrawer = create<QrDrawerState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  openDrawer: () => set({ open: true }),
}));
