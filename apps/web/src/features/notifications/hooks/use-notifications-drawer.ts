import { create } from "zustand";

/**
 * Shared open-state for the in-app notifications drawer. The drawer is mounted
 * once (in the locale layout); the header bell and the on-entry surface both
 * open it through this store, so there's a single drawer instance app-wide.
 */
type NotificationsDrawerState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openDrawer: () => void;
};

export const useNotificationsDrawer = create<NotificationsDrawerState>(
  (set) => ({
    open: false,
    setOpen: (open) => set({ open }),
    openDrawer: () => set({ open: true }),
  }),
);
