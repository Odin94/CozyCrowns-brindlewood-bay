/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string
    readonly VITE_PUBLIC_POSTHOG_KEY?: string
    readonly VITE_PUBLIC_POSTHOG_HOST?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

declare module "*.svg" {
    const content: string
    export default content
}

declare module "*.base64" {
    const content: string
    export default content
}
