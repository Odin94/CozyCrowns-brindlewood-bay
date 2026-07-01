import { i18n } from "@lingui/core";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { env } from "./config/env.ts";
import "./index.css";
import { useSettingsStore } from "./lib/settings_store.ts";
import { loadTranslations } from "./lib/utils.ts";

const initializeApp = async () => {
  // Need to use `getState()` here because we're outside a react component
  const storedLocale = useSettingsStore.getState().locale;

  await loadTranslations(storedLocale);
  i18n.activate(storedLocale);

  // Only import App after i18n is initialized
  const { default: App } = await import("./App.tsx");

  const posthogKey = env.VITE_PUBLIC_POSTHOG_KEY;

  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: "https://info.odin-matthias.com",
      ui_host: "https://eu.posthog.com",
      defaults: "2026-01-30",
      capture_exceptions: true,
      cookieless_mode: "on_reject",
    });
  }

  const appContent = posthogKey ? (
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  ) : (
    <App />
  );

  createRoot(document.getElementById("root")!).render(<StrictMode>{appContent}</StrictMode>);
};

initializeApp().catch(console.error);
