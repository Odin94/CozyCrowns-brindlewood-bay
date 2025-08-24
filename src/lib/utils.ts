import { i18n } from "@lingui/core"
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export const loadTranslations = async (locale: string) => {
    if (locale === "de") {
        const { messages } = await import("@/locales/de/messages.ts")
        i18n.load(locale, messages)
    } else {
        const { messages } = await import("@/locales/en/messages.ts")
        i18n.load(locale, messages)
    }
}
