import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { api, API_URL, tokenStorage } from "../utils/api"
import posthog from "posthog-js"

export const useAuth = () => {
    const queryClient = useQueryClient()

    const {
        data: userData,
        isLoading: loading,
        refetch,
    } = useQuery({
        queryKey: ["auth", "me"],
        queryFn: async () => {
            const data = await api.getCurrentUser()
            if (data.token) {
                tokenStorage.set(data.token)
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { token, ...user } = data
            return user
        },
        retry: (failureCount, error) => {
            const status = (error as Error & { status?: number })?.status
            if (status === 401) {
                tokenStorage.remove()
                return false
            }
            if (status && status >= 400 && status < 500) {
                return false
            }
            if (failureCount < 2) {
                return true
            }
            return false
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
        staleTime: 5 * 60 * 1000,
        enabled: !!tokenStorage.get(),
    })

    const user = userData || null

    useEffect(() => {
        if (user) {
            try {
                posthog.identify(user.id, {
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                })
            } catch (error) {
                console.warn("PostHog identify failed:", error)
            }
        }
    }, [user])

    const refreshAuth = async () => {
        queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
        return refetch()
    }

    const logoutMutation = useMutation({
        mutationFn: () => api.logout(),
        onSuccess: (data) => {
            tokenStorage.remove()
            queryClient.setQueryData(["auth", "me"], null)

            try {
                posthog.reset()
            } catch (error) {
                console.warn("PostHog reset failed:", error)
            }

            if (data.logoutUrl) {
                window.location.href = data.logoutUrl
            } else {
                window.location.href = "/"
            }
        },
        onError: () => {
            tokenStorage.remove()
            queryClient.setQueryData(["auth", "me"], null)

            try {
                posthog.reset()
            } catch (error) {
                console.warn("PostHog reset failed:", error)
            }

            window.location.href = "/"
        },
    })

    const handleCallbackMutation = useMutation({
        mutationFn: ({ code, state }: { code: string; state?: string }) => api.handleAuthCallback(code, state),
        onSuccess: (data) => {
            if (data.token) {
                tokenStorage.set(data.token)
            }
            queryClient.setQueryData(["auth", "me"], data.user)
            queryClient.invalidateQueries({ queryKey: ["auth", "me"] })

            try {
                posthog.identify(data.user.id, {
                    email: data.user.email,
                    firstName: data.user.firstName,
                    lastName: data.user.lastName,
                })
            } catch (error) {
                console.warn("PostHog identify failed:", error)
            }

            window.location.href = "/"
        },
    })

    const signIn = () => {
        window.location.href = `${API_URL}/auth/login`
    }

    const signOut = () => {
        logoutMutation.mutate()
    }

    const updateProfileMutation = useMutation({
        mutationFn: (data: { nickname?: string | null }) => api.updateUserProfile(data),
        onSuccess: (data) => {
            queryClient.setQueryData(["auth", "me"], data)
            queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
        },
    })

    return {
        user: user || null,
        loading,
        isAuthenticated: !!user,
        signIn,
        signOut,
        refreshAuth,
        handleCallback: handleCallbackMutation.mutate,
        isHandlingCallback: handleCallbackMutation.isPending,
        callbackError: handleCallbackMutation.error,
        updateProfile: updateProfileMutation.mutate,
        isUpdatingProfile: updateProfileMutation.isPending,
        updateProfileError: updateProfileMutation.error,
    }
}
