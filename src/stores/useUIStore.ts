import { create } from "zustand";

type PanelContent =
  | { type: "actor"; actorId: string; showId: string }
  | { type: "none" };

type UIState = {
  // Slide panel
  panel: PanelContent;
  openActorPanel: (actorId: string, showId: string) => void;
  closePanel: () => void;

  // Mobile nav
  mobileNavOpen: boolean;
  toggleMobileNav: () => void;
  closeMobileNav: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  panel: { type: "none" },
  openActorPanel: (actorId, showId) =>
    set({ panel: { type: "actor", actorId, showId } }),
  closePanel: () => set({ panel: { type: "none" } }),

  mobileNavOpen: false,
  toggleMobileNav: () =>
    set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
  closeMobileNav: () => set({ mobileNavOpen: false }),
}));
