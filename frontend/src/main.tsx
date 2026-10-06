import { i18n } from "@lingui/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getAnalytics } from "./lib/analytics.ts";
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

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  void getAnalytics().catch((error) => console.warn("Analytics initialization failed:", error));
};

initializeApp().catch(console.error);
