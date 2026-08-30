import { create } from "zustand";
import { persist } from "zustand/middleware";

type ActiveBookClub = { id: string; name: string; characterIds: string[] } | null;

type BookClubState = {
  activeBookClub: ActiveBookClub;
  setActiveBookClub: (bookClub: ActiveBookClub) => void;
};

export const useBookClubStore = create<BookClubState>()(
  persist(
    (set) => ({
      activeBookClub: null,
      setActiveBookClub: (activeBookClub) => set({ activeBookClub }),
    }),
    { name: "cozycrowns-book-club-storage" },
  ),
);
