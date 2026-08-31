import { env } from "../config/env.ts";

const API_URL = env.VITE_API_URL;
const TOKEN_STORAGE_KEY = "auth_token";

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  isSuperadmin: boolean;
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

export type MysteryEntry = {
  id?: string;
  title?: string;
  name?: string;
  description: string;
  prompt?: string;
  quote?: string;
};
export type MysteryData = {
  schemaVersion: number;
  title: string;
  intro: string;
  establishingQuestions: string[];
  complexity: number;
  locations: Array<{ id?: string; title: string; description: string; prompt: string }>;
  suspects: Array<{ id?: string; name: string; title: string; description: string; quote: string }>;
  clues: Array<{ id?: string; title: string; description: string }>;
  voidClues: Array<{ id?: string; title: string; description: string }>;
  moments: Array<{ id?: string; description: string }>;
};

export type Mystery = {
  id: string;
  title: string;
  data: MysteryData;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type MysteryVersion = {
  id: string;
  title: string;
  data: MysteryData;
  version: number;
  kind: "auto" | "manual";
  savedAt: string;
};

export type PublishedMystery = {
  id: string;
  title: string;
  data: MysteryData;
  sourceVersion?: number;
  approvedAt?: string | null;
  submittedAt?: string;
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

export type TheoryNodeKind = "clue" | "voidClue" | "suspect" | "other";

export type TheoryNode = {
  id: string;
  mysteryId: string;
  sourceClueId: string | null;
  kind: TheoryNodeKind;
  title: string;
  description: string;
  tags: string[];
  baseTag: string;
  x: number;
  y: number;
  version: number;
  editingByUserId: string | null;
  editingByNickname: string | null;
  editLockExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TheoryEdge = {
  id: string;
  mysteryId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type TheoryBoard = { nodes: TheoryNode[]; edges: TheoryEdge[] };

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

const getBookClubWebSocketUrl = () => {
  const url = new URL(API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/book-clubs/live`;
  return url.toString();
};

export const connectBookClubUpdates = (onUpdate: () => void): WebSocket | null => {
  const token = tokenStorage.get();
  if (!token) return null;

  const socket = new WebSocket(getBookClubWebSocketUrl());
  const heartbeat = window.setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "heartbeat" }));
  }, 60_000);

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "authenticate", token }));
  });
  socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(String(event.data));
      if (message.type === "ready" && typeof message.token === "string") {
        tokenStorage.set(message.token);
      }
      if (message.type === "book-clubs-updated") onUpdate();
    } catch {
      // Ignore malformed messages and wait for the next server update.
    }
  });
  socket.addEventListener("close", () => window.clearInterval(heartbeat), { once: true });

  return socket;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  const newToken = response.headers.get("X-New-Token");
  if (newToken) {
    tokenStorage.set(newToken);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string" &&
        body.error.trim()
      ) {
        message = body.error;
      }
    } catch {
      // Some gateway failures do not include a JSON body.
    }
    const error = new Error(message) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }
  return response.json();
};

export const api = {
  loginLocally: async (): Promise<AuthCallbackResponse> => {
    const response = await fetch(`${API_URL}/auth/local-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return handleResponse<AuthCallbackResponse>(response);
  },

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
    const response = await fetch(`${API_URL}/auth/callback?${params.toString()}`, {
      credentials: "include",
    });
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
    data: { name?: string; data?: any; version: number },
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
    data: { title?: string; data?: any; version: number },
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

  getMysteries: async (): Promise<{ mysteries: Mystery[] }> => {
    const response = await fetch(`${API_URL}/mysteries`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  createMystery: async (data: { title: string; data: MysteryData }): Promise<Mystery> => {
    const response = await fetch(`${API_URL}/mysteries`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  updateMystery: async (
    id: string,
    data: { title: string; data: MysteryData; version: number; saveKind: "auto" | "manual" },
  ): Promise<Mystery> => {
    const response = await fetch(`${API_URL}/mysteries/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deleteMystery: async (id: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_URL}/mysteries/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  getMysteryVersions: async (id: string): Promise<{ versions: MysteryVersion[] }> => {
    const response = await fetch(`${API_URL}/mysteries/${id}/versions`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  publishMystery: async (
    id: string,
  ): Promise<{ id: string; status: string; submittedAt: string }> => {
    const response = await fetch(`${API_URL}/mysteries/${id}/publish`, {
      method: "POST",
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  getLibrary: async (): Promise<{ mysteries: PublishedMystery[] }> => {
    const response = await fetch(`${API_URL}/library`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  copyLibraryMystery: async (id: string): Promise<Mystery> => {
    const response = await fetch(`${API_URL}/library/${id}/copy`, {
      method: "POST",
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  getPendingPublishedMysteries: async (): Promise<{ mysteries: PublishedMystery[] }> => {
    const response = await fetch(`${API_URL}/superadmin/published-mysteries`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  approvePublishedMystery: async (id: string): Promise<{ id: string; status: string }> => {
    const response = await fetch(`${API_URL}/superadmin/published-mysteries/${id}/approve`, {
      method: "PUT",
      headers: getAuthHeaders({ includeContentType: false }),
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

  getBookClubTheory: async (bookClubId: string, mysteryId: string): Promise<TheoryBoard> => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize`,
      { headers: getAuthHeaders({ includeContentType: false }) },
    );
    return handleResponse(response);
  },

  createBookClubTheoryNode: async (
    bookClubId: string,
    mysteryId: string,
    data: {
      kind: TheoryNodeKind;
      title: string;
      description?: string;
      tags?: string[];
      x?: number;
      y?: number;
    },
  ): Promise<TheoryNode> => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/nodes`,
      { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data) },
    );
    return handleResponse(response);
  },

  lockBookClubTheoryNode: async (bookClubId: string, mysteryId: string, nodeId: string) => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/nodes/${nodeId}/lock`,
      { method: "PUT", headers: getAuthHeaders({ includeContentType: false }) },
    );
    return handleResponse<TheoryNode>(response);
  },

  releaseBookClubTheoryNode: async (bookClubId: string, mysteryId: string, nodeId: string) => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/nodes/${nodeId}/lock`,
      { method: "DELETE", headers: getAuthHeaders({ includeContentType: false }) },
    );
    return handleResponse<{ success: boolean }>(response);
  },

  updateBookClubTheoryNode: async (
    bookClubId: string,
    mysteryId: string,
    nodeId: string,
    data: {
      version: number;
      title?: string;
      description?: string;
      tags?: string[];
      x?: number;
      y?: number;
    },
  ): Promise<TheoryNode> => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/nodes/${nodeId}`,
      { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data) },
    );
    return handleResponse(response);
  },

  deleteBookClubTheoryNode: async (
    bookClubId: string,
    mysteryId: string,
    nodeId: string,
    version: number,
  ) => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/nodes/${nodeId}`,
      { method: "DELETE", headers: getAuthHeaders(), body: JSON.stringify({ version }) },
    );
    return handleResponse<{ success: boolean }>(response);
  },

  createBookClubTheoryEdge: async (
    bookClubId: string,
    mysteryId: string,
    data: { sourceNodeId: string; targetNodeId: string; label?: string },
  ): Promise<TheoryEdge> => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/edges`,
      { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data) },
    );
    return handleResponse(response);
  },

  updateBookClubTheoryEdge: async (
    bookClubId: string,
    mysteryId: string,
    edgeId: string,
    data: { version: number; label: string },
  ): Promise<TheoryEdge> => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/edges/${edgeId}`,
      { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data) },
    );
    return handleResponse(response);
  },

  deleteBookClubTheoryEdge: async (
    bookClubId: string,
    mysteryId: string,
    edgeId: string,
    version: number,
  ) => {
    const response = await fetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/edges/${edgeId}`,
      { method: "DELETE", headers: getAuthHeaders(), body: JSON.stringify({ version }) },
    );
    return handleResponse<{ success: boolean }>(response);
  },
};

export { API_URL };
