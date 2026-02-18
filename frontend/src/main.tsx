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

    const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
    const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST

    const appContent = posthogKey ? (
        <PostHogProvider
            apiKey={posthogKey}
            options={{
                api_host: posthogHost,
                defaults: "2025-05-24",
                capture_exceptions: true,
                debug: import.meta.env.MODE === "development",
            }}
        >
            <App />
        </PostHogProvider>
    ) : (
        <App />
    )

    createRoot(document.getElementById("root")!).render(<StrictMode>{appContent}</StrictMode>)
}

initializeApp().catch(console.error)
