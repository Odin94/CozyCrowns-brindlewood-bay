const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001"

type User = {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    nickname: string | null
}

type AuthCallbackResponse = {
    success: boolean
    user: User
}

type LogoutResponse = {
    success: boolean
    logoutUrl: string | null
}

type UpdateUserInput = {
    nickname?: string | null
}

const handleResponse = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`) as Error & { status?: number }
        error.status = response.status
        throw error
    }
    return response.json()
}

export const api = {
    getCurrentUser: async (): Promise<User> => {
        const response = await fetch(`${API_URL}/auth/me`, {
            credentials: "include",
        })
        return handleResponse<User>(response)
    },

    handleAuthCallback: async (code: string, state?: string): Promise<AuthCallbackResponse> => {
        const params = new URLSearchParams({ code })
        if (state) {
            params.append("state", state)
        }
        const response = await fetch(`${API_URL}/auth/callback?${params.toString()}`, {
            credentials: "include",
        })
        return handleResponse<AuthCallbackResponse>(response)
    },

    logout: async (): Promise<LogoutResponse> => {
        const response = await fetch(`${API_URL}/auth/logout`, {
            credentials: "include",
        })
        return handleResponse<LogoutResponse>(response)
    },

    updateUserProfile: async (data: UpdateUserInput): Promise<User> => {
        const response = await fetch(`${API_URL}/auth/me`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(data),
        })
        return handleResponse<User>(response)
    },
}

export { API_URL }
