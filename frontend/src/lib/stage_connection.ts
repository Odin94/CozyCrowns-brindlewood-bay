const KEY = "cozycrowns-stage-connection";
const LIFETIME = 180_000;

export type StageConnection = { redirectUri: string; state: string; expiresAt: number };

/** Only the native loopback receiver is allowed; this is never an open redirect. */
export function parseStageConnection(search: string, now = Date.now()): StageConnection | null {
  try {
    const params = new URLSearchParams(search);
    const redirectUri = params.get("redirect_uri") ?? "";
    const url = new URL(redirectUri);
    const state = params.get("state") ?? "";
    if (
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      !url.port ||
      Number(url.port) < 1024 ||
      url.pathname !== "/cozycrowns/callback" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^[a-f0-9]{64}$/.test(state)
    )
      return null;
    return { redirectUri: url.href, state, expiresAt: now + LIFETIME };
  } catch {
    return null;
  }
}

export function saveStageConnection(connection: StageConnection) {
  sessionStorage.setItem(KEY, JSON.stringify(connection));
}
export function clearStageConnection() {
  sessionStorage.removeItem(KEY);
}
export function readStageConnection(now = Date.now()): StageConnection | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as StageConnection | null;
    if (
      !saved ||
      !Number.isFinite(saved.expiresAt) ||
      saved.expiresAt <= now ||
      saved.expiresAt > now + LIFETIME
    ) {
      clearStageConnection();
      return null;
    }
    const parsed = parseStageConnection(
      new URLSearchParams({ redirect_uri: saved.redirectUri, state: saved.state }).toString(),
      now,
    );
    return parsed ? { ...parsed, expiresAt: saved.expiresAt } : null;
  } catch {
    clearStageConnection();
    return null;
  }
}
