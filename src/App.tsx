import { i18n } from "@lingui/core"
import { I18nProvider } from "@lingui/react"
import { Toaster } from "sonner"
import CharacterSheet from "./pages/CharacterSheet"

// Load messages for the current locale
// TODOdin: Unify loadMessages functions
const loadMessages = async (locale: string) => {
    if (locale === "en") {
        const { messages } = await import("@/locales/en/messages.ts")
        i18n.load(locale, messages)
    } else if (locale === "de") {
        const { messages } = await import("@/locales/de/messages.ts")
        i18n.load(locale, messages)
    }
}

// Initialize with default locale and activate it
loadMessages("en")
    .then(() => {
        i18n.activate("en")
    })
    .catch(console.error)

function App() {
    return (
        <>
            <I18nProvider i18n={i18n}>
                <CharacterSheet />
                <Toaster
                    theme="light"
                    className="toaster"
                    toastOptions={{
                        style: {
                            background: "hsl(280 15% 75%)",
                            color: "hsl(280 30% 25%)",
                            border: "1px solid hsl(280 25% 60%)",
                        },
                    }}
                />
            </I18nProvider>
        </>
    )
}

export default App
