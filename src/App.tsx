import { i18n } from "@lingui/core"
import { I18nProvider } from "@lingui/react"
import { Toaster } from "sonner"
import CharacterSheet from "./pages/CharacterSheet"

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
