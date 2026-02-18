import { useEffect } from "react"
import { useAuth } from "../hooks/useAuth"

export const AuthCallback = () => {
    const { handleCallback, isHandlingCallback, callbackError } = useAuth()

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const code = params.get("code")
        const state = params.get("state") || undefined

        if (code) {
            handleCallback({ code, state })
        }
    }, [handleCallback])

    if (isHandlingCallback) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="text-lg">Completing sign in...</div>
                </div>
            </div>
        )
    }

    if (callbackError) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="text-lg text-red-600">Sign in failed. Please try again.</div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="text-lg">Redirecting...</div>
            </div>
        </div>
    )
}
