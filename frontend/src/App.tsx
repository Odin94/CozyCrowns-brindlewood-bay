import { i18n } from "@lingui/core"
import { I18nProvider } from "@lingui/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import CharacterSheet from "./pages/CharacterSheet"
import { AuthCallback } from "./pages/AuthCallback"

const queryClient = new QueryClient()

function App() {
    const pathname = window.location.pathname

    return (
        <>
            <QueryClientProvider client={queryClient}>
                <I18nProvider i18n={i18n}>
                    {pathname === "/auth/callback" ? <AuthCallback /> : <CharacterSheet />}
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
            </QueryClientProvider>
        </>
    )
}

export default App
