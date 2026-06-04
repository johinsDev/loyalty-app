import { create } from "zustand";

/**
 * Thin client store for the promo wizard: just the draft id. The server
 * `promociones.getState` query is the source of truth for which step we're on
 * (server-driven), so there's nothing else to keep here. See the `zustand` +
 * `wizard` skills.
 */
interface PromoWizardState {
  draftId: string | null;
  setDraftId: (id: string | null) => void;
  reset: () => void;
}

export const usePromoWizardStore = create<PromoWizardState>((set) => ({
  draftId: null,
  setDraftId: (draftId) => set({ draftId }),
  reset: () => set({ draftId: null }),
}));
