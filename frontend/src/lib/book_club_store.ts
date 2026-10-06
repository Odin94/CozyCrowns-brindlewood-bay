import { create } from "zustand";
import { persist } from "zustand/middleware";

type ActiveBookClub = { id: string; name: string; characterIds: string[] } | null;

type BookClubState = {
  activeBookClub: ActiveBookClub;
  shareRolls: boolean;
  setActiveBookClub: (bookClub: ActiveBookClub) => void;
  setShareRolls: (shareRolls: boolean) => void;
};

export const useBookClubStore = create<BookClubState>()(
  persist(
    (set) => ({
      activeBookClub: null,
      shareRolls: false,
      setActiveBookClub: (activeBookClub) => set({ activeBookClub }),
      setShareRolls: (shareRolls) => set({ shareRolls }),
    }),
    { name: "cozycrowns-book-club-storage" },
  ),
);
