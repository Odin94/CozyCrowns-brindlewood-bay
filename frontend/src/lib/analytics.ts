import { env } from "@/config/env";

let client: Promise<typeof import("posthog-js").default | undefined> | undefined;

/** Analytics is optional and must not hold up the locally editable sheet. */
export const getAnalytics = () => {
  if (!env.VITE_PUBLIC_POSTHOG_KEY) return Promise.resolve(undefined);
  client ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(env.VITE_PUBLIC_POSTHOG_KEY!, {
      api_host: "https://info.odin-matthias.com",
      ui_host: "https://eu.posthog.com",
      defaults: "2026-01-30",
      capture_exceptions: true,
      cookieless_mode: "on_reject",
    });
    return posthog;
  });
  return client;
};
