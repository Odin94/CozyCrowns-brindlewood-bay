const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001"
const TOKEN_STORAGE_KEY = "auth_token"

type User = {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    nickname: string | null
}

type AuthCallbackResponse = {
    success: boolean
    token: string
    user: User
}

type LogoutResponse = {
    success: boolean
    logoutUrl: string | null
}

type UpdateUserInput = {
    nickname?: string | null
}

export const tokenStorage = {
    get: (): string | null => {
        if (typeof window === "undefined") return null
        return localStorage.getItem(TOKEN_STORAGE_KEY)
    },
    set: (token: string): void => {
        if (typeof window === "undefined") return
        localStorage.setItem(TOKEN_STORAGE_KEY, token)
    },
    remove: (): void => {
        if (typeof window === "undefined") return
        localStorage.removeItem(TOKEN_STORAGE_KEY)
    },
}

const getAuthHeaders = (): HeadersInit => {
    const token = tokenStorage.get()
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    }
    if (token) {
        headers.Authorization = `Bearer ${token}`
    }
    return headers
}

const handleResponse = async <T>(response: Response): Promise<T> => {
    const newToken = response.headers.get("X-New-Token")
    if (newToken) {
        tokenStorage.set(newToken)
    }

    if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`) as Error & { status?: number }
        error.status = response.status
        throw error
    }
    return response.json()
}

export const api = {
    getCurrentUser: async (): Promise<User & { token?: string }> => {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: getAuthHeaders(),
        })
        return handleResponse<User & { token?: string }>(response)
    },

    handleAuthCallback: async (code: string, state?: string): Promise<AuthCallbackResponse> => {
        const params = new URLSearchParams({ code })
        if (state) {
            params.append("state", state)
        }
        const response = await fetch(`${API_URL}/auth/callback?${params.toString()}`)
        const data = await handleResponse<AuthCallbackResponse>(response)
        if (data.token) {
            tokenStorage.set(data.token)
        }
        return data
    },

    logout: async (): Promise<LogoutResponse> => {
        const response = await fetch(`${API_URL}/auth/logout`, {
            headers: getAuthHeaders(),
        })
        const data = await handleResponse<LogoutResponse>(response)
        tokenStorage.remove()
        return data
    },

    updateUserProfile: async (data: UpdateUserInput): Promise<User> => {
        const response = await fetch(`${API_URL}/auth/me`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        })
        return handleResponse<User>(response)
    },
}

export { API_URL }
