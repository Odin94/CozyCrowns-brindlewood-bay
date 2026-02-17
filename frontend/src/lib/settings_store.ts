import { create } from "zustand"
import { persist } from "zustand/middleware"

export type SettingsState = {
    locale: string
    setLocale: (locale: string) => void
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            locale: "en",
            setLocale: (locale) => set({ locale }),
        }),
        {
            name: "cozycrowns-settings-storage",
        }
    )
)
