import { accountScope } from "../lib/account_scope";
import { env } from "../config/env.ts";
import { createTokenStorage } from "../lib/auth_token";

const API_URL = env.VITE_API_URL;

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

export type LibraryMysterySummary = Pick<PublishedMystery, "id" | "title"> & {
  data: Pick<MysteryData, "intro" | "complexity">;
  locationCount: number;
  suspectCount: number;
};

export type BookClubCharacter = {
  id: string;
  name: string;
  data: Partial<import("@/lib/character_document").CharacterData> & {
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
  sharedNotes: string;
  sharedNotesVersion: number;
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
  mysteries: Array<{
    id: string;
    title: string;
    isActive: boolean;
    createdAt: string;
    voidClues: Array<{ id: string; text: string; checked: boolean }>;
  }>;
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

export type BookClubNoteCursor = {
  type: "book-club-note-cursor";
  bookClubId: string;
  userId: string;
  nickname: string | null;
  start: number;
  end: number;
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

export type TheoryNodePosition = Pick<TheoryNode, "id" | "x" | "y" | "version" | "updatedAt">;

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

export type TheoryBoard = {
  mystery: { id: string; title: string };
  nodes: TheoryNode[];
  edges: TheoryEdge[];
};

const TOKEN_STORAGE_KEY = "auth_token";
const rawTokenStorage = createTokenStorage(localStorage);
export const tokenStorage = {
  ...rawTokenStorage,
  key: TOKEN_STORAGE_KEY,
  remove: () => {
    rawTokenStorage.remove();
    accountScope.invalidate();
  },
};

const fetchWithSession = async (input: RequestInfo | URL, init?: RequestInit) => {
  const epoch = tokenStorage.sessionKey();
  const authorization = new Headers(init?.headers).get("Authorization");
  const requestToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  const response = await fetch(input, init);
  const renewed = response.headers.get("X-New-Token");
  if (renewed) tokenStorage.rotate(renewed, requestToken, epoch);
  return response;
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === TOKEN_STORAGE_KEY || event.key === null) {
      if (tokenStorage.get()) accountScope.revalidate();
      else accountScope.invalidate();
    }
  });
}

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

export const connectBookClubUpdates = (
  onUpdate: () => void,
  onMessage?: (message: BookClubNoteCursor) => void,
): WebSocket | null => {
  const token = tokenStorage.get();
  if (!token) return null;

  const generation = accountScope.current().generation;
  const epoch = tokenStorage.sessionKey();
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
      if (generation !== accountScope.current().generation) return;
      if (message.type === "ready" && typeof message.token === "string") {
        tokenStorage.rotate(message.token, token, epoch);
      }
      if (message.type === "ready" || message.type === "book-clubs-updated") onUpdate();
      if (message.type === "book-club-note-cursor") onMessage?.(message);
    } catch {
      // Ignore malformed messages and wait for the next server update.
    }
  });
  socket.addEventListener("close", () => window.clearInterval(heartbeat), { once: true });

  return socket;
};

// A late response from an old account must never rotate the new account's token.
const responseScopes = new WeakMap<Response, number>();
const scopedFetch: typeof fetch = async (...args) => {
  const scope = accountScope.current();
  const url =
    typeof args[0] === "string" ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
  if (
    (scope.revalidating || scope.signingOut) &&
    !new URL(url, window.location.origin).pathname.includes("/auth/")
  )
    throw new Error("Session changed");
  const generation = accountScope.current().generation;
  const response = await fetchWithSession(...args);
  responseScopes.set(response, generation);
  return response;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
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
      sessionGeneration?: number;
    };
    error.sessionGeneration = responseScopes.get(response);
    error.status = response.status;
    throw error;
  }
  return response.json();
};

export const api = {
  loginLocally: async (): Promise<AuthCallbackResponse> => {
    const response = await scopedFetch(`${API_URL}/auth/local-login`, {
      method: "POST",
    });
    return handleResponse<AuthCallbackResponse>(response);
  },

  getCurrentUser: async (): Promise<User & { token?: string }> => {
    const epoch = tokenStorage.sessionKey();
    const token = tokenStorage.get();
    const response = await scopedFetch(`${API_URL}/auth/me`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    // An obsolete response must not replace the new login's token or user.
    if (tokenStorage.sessionKey() !== epoch)
      throw Object.assign(new Error("The account session changed"), { status: 409 });
    const data = await handleResponse<User & { token?: string }>(response);
    if (tokenStorage.sessionKey() !== epoch)
      throw Object.assign(new Error("The account session changed"), { status: 409 });
    if (data.token) tokenStorage.rotate(data.token, token, epoch);
    return data;
  },

  handleAuthCallback: async (code: string, state?: string): Promise<AuthCallbackResponse> => {
    const params = new URLSearchParams({ code });
    if (state) {
      params.append("state", state);
    }
    const response = await scopedFetch(`${API_URL}/auth/callback?${params.toString()}`, {
      credentials: "include",
    });
    const data = await handleResponse<AuthCallbackResponse>(response);
    if (data.token) {
      tokenStorage.set(data.token);
    }
    return data;
  },

  logout: async (
    epoch = tokenStorage.sessionKey(),
  ): Promise<LogoutResponse & { sessionEpoch: string }> => {
    if (tokenStorage.sessionKey() !== epoch)
      throw Object.assign(new Error("The account session changed"), { status: 409 });
    const response = await scopedFetch(`${API_URL}/auth/logout`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    if (tokenStorage.sessionKey() !== epoch)
      throw Object.assign(new Error("The account session changed"), { status: 409 });
    const data = await handleResponse<LogoutResponse>(response);
    if (tokenStorage.sessionKey() !== epoch)
      throw Object.assign(new Error("The account session changed"), { status: 409 });
    tokenStorage.remove();
    return { ...data, sessionEpoch: tokenStorage.sessionKey() };
  },

  updateUserProfile: async (data: UpdateUserInput): Promise<User> => {
    const response = await scopedFetch(`${API_URL}/auth/me`, {
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
    const response = await scopedFetch(`${API_URL}/characters`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  createCharacter: async (data: {
    creationId?: string;
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
    const response = await scopedFetch(`${API_URL}/characters`, {
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
    const response = await scopedFetch(`${API_URL}/characters/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deleteCharacter: async (id: string): Promise<{ success: boolean }> => {
    const response = await scopedFetch(`${API_URL}/characters/${id}`, {
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
    const response = await scopedFetch(`${API_URL}/dark-conspiracies`, {
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
    const response = await scopedFetch(`${API_URL}/dark-conspiracies`, {
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
    const response = await scopedFetch(`${API_URL}/dark-conspiracies/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getMysteries: async (): Promise<{ mysteries: Mystery[] }> => {
    const response = await scopedFetch(`${API_URL}/mysteries`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  createMystery: async (data: {
    title: string;
    data: MysteryData;
    recoveryId?: string;
  }): Promise<Mystery> => {
    const response = await scopedFetch(`${API_URL}/mysteries`, {
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
    const response = await scopedFetch(`${API_URL}/mysteries/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  deleteMystery: async (id: string): Promise<{ success: boolean }> => {
    const response = await scopedFetch(`${API_URL}/mysteries/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  restoreMystery: async (id: string): Promise<Mystery> => {
    const response = await scopedFetch(`${API_URL}/mysteries/${id}/restore`, {
      method: "POST",
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  getMysteryVersions: async (id: string): Promise<{ versions: MysteryVersion[] }> => {
    const response = await scopedFetch(`${API_URL}/mysteries/${id}/versions`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  publishMystery: async (
    id: string,
  ): Promise<{ id: string; status: string; submittedAt: string }> => {
    const response = await scopedFetch(`${API_URL}/mysteries/${id}/publish`, {
      method: "POST",
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  getLibrarySummaries: async (): Promise<{ mysteries: LibraryMysterySummary[] }> => {
    const response = await fetchWithSession(`${API_URL}/library?summary=true`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  getLibrary: async (): Promise<{ mysteries: PublishedMystery[] }> => {
    const response = await scopedFetch(`${API_URL}/library`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  copyLibraryMystery: async (id: string): Promise<Mystery> => {
    const response = await scopedFetch(`${API_URL}/library/${id}/copy`, {
      method: "POST",
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  getPendingPublishedMysteries: async (): Promise<{ mysteries: PublishedMystery[] }> => {
    const response = await scopedFetch(`${API_URL}/superadmin/published-mysteries`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  approvePublishedMystery: async (id: string): Promise<{ id: string; status: string }> => {
    const response = await scopedFetch(`${API_URL}/superadmin/published-mysteries/${id}/approve`, {
      method: "PUT",
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  getBookClubs: async (): Promise<{ clubs: BookClub[]; invitations: BookClubInvitation[] }> => {
    const response = await scopedFetch(`${API_URL}/book-clubs`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  createBookClub: async (name: string): Promise<BookClub> => {
    const response = await scopedFetch(`${API_URL}/book-clubs`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse(response);
  },

  renameBookClub: async (bookClubId: string, name: string): Promise<BookClub> => {
    const response = await scopedFetch(`${API_URL}/book-clubs/${bookClubId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse(response);
  },

  deleteBookClub: async (bookClubId: string): Promise<{ success: boolean }> => {
    const response = await scopedFetch(`${API_URL}/book-clubs/${bookClubId}`, {
      method: "DELETE",
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  restoreBookClub: async (bookClubId: string): Promise<BookClub> => {
    const response = await scopedFetch(`${API_URL}/book-clubs/${bookClubId}/restore`, {
      method: "POST",
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  getBookClubNotes: async (
    bookClubId: string,
  ): Promise<{
    shared: { content: string; version: number };
    private: { content: string; version: number };
  }> => {
    const response = await scopedFetch(`${API_URL}/book-clubs/${bookClubId}/notes`, {
      headers: getAuthHeaders({ includeContentType: false }),
    });
    return handleResponse(response);
  },

  updateBookClubNotes: async (
    bookClubId: string,
    data: { kind: "shared" | "private"; content: string; baseVersion: number },
  ): Promise<{ content: string; version: number }> => {
    const response = await scopedFetch(`${API_URL}/book-clubs/${bookClubId}/notes`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  inviteToBookClub: async (bookClubId: string, nickname: string): Promise<{ success: boolean }> => {
    const response = await scopedFetch(`${API_URL}/book-clubs/${bookClubId}/invitations`, {
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
    const response = await scopedFetch(
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
    const response = await scopedFetch(
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
    const response = await scopedFetch(`${API_URL}/book-clubs/${bookClubId}/characters`, {
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
    const response = await scopedFetch(
      `${API_URL}/book-clubs/${bookClubId}/characters/${characterId}`,
      {
        method: "DELETE",
        headers: getAuthHeaders({ includeContentType: false }),
      },
    );
    return handleResponse(response);
  },

  shareBookClubRoll: async (
    bookClubId: string,
    data: { label: string; dice: string; result: string; characterId?: string | null },
  ) => {
    const response = await scopedFetch(`${API_URL}/book-clubs/${bookClubId}/rolls`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  createBookClubMystery: async (
    bookClubId: string,
    sourceMysteryId: string,
    name: string,
    clues: string[],
    voidClues: string[] = [],
  ): Promise<BookClub> => {
    const response = await scopedFetch(`${API_URL}/book-clubs/${bookClubId}/mysteries`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ sourceMysteryId, name, clues, voidClues }),
    });
    return handleResponse(response);
  },

  activateBookClubMystery: async (bookClubId: string, mysteryId: string): Promise<BookClub> => {
    const response = await scopedFetch(
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
    const response = await scopedFetch(
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
    const response = await scopedFetch(
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
    const response = await scopedFetch(
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
    const response = await scopedFetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/nodes`,
      { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data) },
    );
    return handleResponse(response);
  },

  lockBookClubTheoryNode: async (bookClubId: string, mysteryId: string, nodeId: string) => {
    const response = await scopedFetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/nodes/${nodeId}/lock`,
      { method: "PUT", headers: getAuthHeaders({ includeContentType: false }) },
    );
    return handleResponse<TheoryNode>(response);
  },

  releaseBookClubTheoryNode: async (bookClubId: string, mysteryId: string, nodeId: string) => {
    const response = await scopedFetch(
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
    const response = await scopedFetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/nodes/${nodeId}`,
      { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(data) },
    );
    return handleResponse(response);
  },

  updateBookClubTheoryNodePositions: async (
    bookClubId: string,
    mysteryId: string,
    nodes: Array<Pick<TheoryNode, "id" | "version" | "x" | "y">>,
  ): Promise<{ nodes: TheoryNodePosition[] }> => {
    const response = await scopedFetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/nodes/positions`,
      { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify({ nodes }) },
    );
    return handleResponse(response);
  },

  deleteBookClubTheoryNode: async (
    bookClubId: string,
    mysteryId: string,
    nodeId: string,
    version: number,
  ) => {
    const response = await scopedFetch(
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
    const response = await scopedFetch(
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
    const response = await scopedFetch(
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
    const response = await scopedFetch(
      `${API_URL}/book-clubs/${bookClubId}/mysteries/${mysteryId}/theorize/edges/${edgeId}`,
      { method: "DELETE", headers: getAuthHeaders(), body: JSON.stringify({ version }) },
    );
    return handleResponse<{ success: boolean }>(response);
  },
};

export { API_URL };
