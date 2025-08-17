/// <reference types="vite/client" />

declare module "*.svg" {
    const content: string
    export default content
}

declare module "*.base64" {
    const content: string
    export default content
}
