import { env } from "../config/env.ts";

const API_URL = env.VITE_API_URL;
const TOKEN_STORAGE_KEY = "auth_token";

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
};

type AuthCallbackResponse = {
  success: boolean;
  token: string;
  user: User;
};

type LogoutResponse = {
  success: boolean;
  logoutUrl: string | null;
};

type UpdateUserInput = {
  nickname?: string | null;
};

export type BookClubCharacter = {
  id: string;
  name: string;
  data: {
    conditions: string;
    mavenMoves: string;
    voidChecks: boolean[];
    cozyItems: Array<{ checked: boolean; text: string }>;
  };
  version: number;
  updatedAt: string;
};

export type BookClub = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  members: Array<{
    id: string;
    nickname: string | null;
    joinedAt: string;
    isGameMaster: boolean;
    characters: BookClubCharacter[];
  }>;
  rolls: Array<{
    id: string;
    userId: string;
    characterId: string | null;
    characterName: string;
    label: string;
    dice: string;
    result: string;
    createdAt: string;
  }>;
  mysteries: Array<{ id: string; title: string; isActive: boolean; createdAt: string }>;
  activeMystery: {
    id: string;
    title: string;
    isActive: boolean;
    createdAt: string;
    clues: Array<{
      id: string;
      text: string;
      isVoid: boolean;
      checked: boolean;
      createdAt: string;
    }>;
  } | null;
};

export type BookClubInvitation = {
  club: Pick<BookClub, "id" | "name" | "ownerId" | "createdAt">;
  invitedByNickname: string | null;
  createdAt: string;
};

export const tokenStorage = {
  get: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  },
  set: (token: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  },
  remove: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  },
};

const getAuthHeaders = ({
  includeContentType = true,
}: { includeContentType?: boolean } = {}): HeadersInit => {
  const token = tokenStorage.get();
  const headers: HeadersInit = {};
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  const newToken = response.headers.get("X-New-Token");
  if (newToken) {
    tokenStorage.set(newToken);
  }

  if (!response.ok) {
    const error = new Error(`HTTP error! status: ${response.status}`) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return response.json();
};

export const api = {
  getCurrentUser: async (): Promise<User & { token?: string }> => {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse<User & { token?: string }>(response);
  },

  handleAuthCallback: async (code: string, state?: string): Promise<AuthCallbackResponse> => {
    const params = new URLSearchParams({ code });
    if (state) {
      params.append("state", state);
    }
    const response = await fetch(`${API_URL}/auth/callback?${params.toString()}`);
    const data = await handleResponse<AuthCallbackResponse>(response);
    if (data.token) {
      tokenStorage.set(data.token);
    }
    return data;
  },

  logout: async (): Promise<LogoutResponse> => {
    const response = await fetch(`${API_URL}/auth/logout`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    const data = await handleResponse<LogoutResponse>(response);
    tokenStorage.remove();
    return data;
  },

  updateUserProfile: async (data: UpdateUserInput): Promise<User> => {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse<User>(response);
  },

  getCharacters: async (): Promise<{
    characters: Array<{
      id: string;
      name: string;
      data: any;
      version: number;
      characterVersion: number;
      createdAt: Date;
      updatedAt: Date;
      owned: boolean;
    }>;
  }> => {
    const response = await fetch(`${API_URL}/characters`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  createCharacter: async (data: {
    name: string;
    data: any;
    version?: number;
  }): Promise<{
    id: string;
    name: string;
    data: any;
    version: number;
    characterVersion: number;
    createdAt: Date;
    updatedAt: Date;
  }> => {
    const response = await fetch(`${API_URL}/characters`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  updateCharacter: async (
    id: string,
    data: { name?: string; data?: any; version?: number },
  ): Promise<{
    id: string;
    name: string;
    data: any;
    version: number;
    characterVersion: number;
    createdAt: Date;
    updatedAt: Date;
  }> => {
    const response = await fetch(`${API_URL}/characters/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deleteCharacter: async (id: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_URL}/characters/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  getDarkConspiracies: async (): Promise<{
    darkConspiracies: Array<{
      id: string;
      title: string;
      data: any;
      version: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }> => {
    const response = await fetch(`${API_URL}/dark-conspiracies`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  createDarkConspiracy: async (data: {
    title: string;
    data: any;
    version?: number;
  }): Promise<{
    id: string;
    title: string;
    data: any;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }> => {
    const response = await fetch(`${API_URL}/dark-conspiracies`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  updateDarkConspiracy: async (
    id: string,
    data: { title?: string; data?: any; version?: number },
  ): Promise<{
    id: string;
    title: string;
    data: any;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }> => {
    const response = await fetch(`${API_URL}/dark-conspiracies/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getBookClubs: async (): Promise<{ clubs: BookClub[]; invitations: BookClubInvitation[] }> => {
    const response = await fetch(`${API_URL}/book-clubs`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  createBookClub: async (name: string): Promise<BookClub> => {
    const response = await fetch(`${API_URL}/book-clubs`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse(response);
  },

  inviteToBookClub: async (bookClubId: string, nickname: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_URL}/book-clubs/${bookClubId}/invitations`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ nickname }),
    });
    return handleResponse(response);
  },

  respondToBookClubInvitation: async (
    bookClubId: string,
    accept: boolean,
  ): Promise<BookClub | { success: boolean }> => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/invitations${accept ? "/accept" : ""}`,
      {
        method: accept ? "POST" : "DELETE",
        headers: getAuthHeaders({ includeContentType: false }),
      },
    );
    return handleResponse(response);
  },

  setBookClubGameMaster: async (
    bookClubId: string,
    userId: string,
    isGameMaster: boolean,
  ): Promise<BookClub> => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/members/${userId}/game-master`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isGameMaster }),
      },
    );
    return handleResponse(response);
  },

  assignBookClubCharacter: async (bookClubId: string, characterId: string): Promise<BookClub> => {
    const response = await fetch(`${API_URL}/book-clubs/${bookClubId}/characters`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ characterId }),
    });
    return handleResponse(response);
  },

  removeBookClubCharacter: async (
    bookClubId: string,
    characterId: string,
  ): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_URL}/book-clubs/${bookClubId}/characters/${characterId}`, {
      method: "DELETE",
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  shareBookClubRoll: async (
    bookClubId: string,
    data: { label: string; dice: string; result: string; characterId: string },
  ) => {
    const response = await fetch(`${API_URL}/book-clubs/${bookClubId}/rolls`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  createBookClubMystery: async (
    bookClubId: string,
    name: string,
    clues: string[],
  ): Promise<BookClub> => {
    const response = await fetch(`${API_URL}/book-clubs/${bookClubId}/mysteries`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, clues }),
    });
    return handleResponse(response);
  },

  activateBookClubMystery: async (bookClubId: string, mysteryId: string): Promise<BookClub> => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/activate`,
      {
        method: "PUT",
        headers: getAuthHeaders({ includeContentType: false }),
      },
    );
    return handleResponse(response);
  },

  addBookClubClue: async (
    bookClubId: string,
    mysteryId: string,
    text: string,
    isVoid: boolean,
  ): Promise<BookClub> => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/clues`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ text, isVoid }),
      },
    );
    return handleResponse(response);
  },

  updateBookClubClue: async (
    bookClubId: string,
    mysteryId: string,
    clueId: string,
    data: { checked?: boolean; text?: string },
  ): Promise<BookClub> => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/clues/${clueId}`,
      {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      },
    );
    return handleResponse(response);
  },
};

export { API_URL };
