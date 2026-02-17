import { i18n } from "@lingui/core"
import { PostHogProvider } from "posthog-js/react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { loadTranslations } from "./lib/utils.ts"
import { useSettingsStore } from "./lib/settings_store.ts"

const initializeApp = async () => {
    // Need to use `getState()` here because we're outside a react component
    const storedLocale = useSettingsStore.getState().locale

    await loadTranslations(storedLocale)
    i18n.activate(storedLocale)

    // Only import App after i18n is initialized
    const { default: App } = await import("./App.tsx")

    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <PostHogProvider
                apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
                options={{
                    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
                    defaults: "2025-05-24",
                    capture_exceptions: true,
                    debug: import.meta.env.MODE === "development",
                }}
            >
                <App />
            </PostHogProvider>
        </StrictMode>
    )
}

initializeApp().catch(console.error)
