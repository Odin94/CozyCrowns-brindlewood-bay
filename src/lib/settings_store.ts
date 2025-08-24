import { create } from "zustand"

export type SettingsState = {
    locale: string
    setLocale: (locale: string) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
    locale: "en",
    setLocale: (locale) => set({ locale }),
}))
