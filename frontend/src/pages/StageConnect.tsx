import { useState } from "react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useAuth } from "@/hooks/useAuth";
import { api, tokenStorage } from "@/utils/api";
import {
  clearStageConnection,
  parseStageConnection,
  readStageConnection,
  saveStageConnection,
} from "@/lib/stage_connection";
import { rememberAuthReturnTo } from "@/lib/auth_return_to";
import { Button } from "@/components/ui/button";
export default function StageConnect() {
  const auth = useAuth();
  const [connection] = useState(() => {
    if (window.location.search) {
      const parsed = parseStageConnection(window.location.search);
      clearStageConnection();
      if (parsed) saveStageConnection(parsed);
      window.history.replaceState(window.history.state, "", "/stage-connect");
      return parsed;
    }
    return readStageConnection();
  });
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const current = readStageConnection();
      if (!current) throw new Error(t`This request expired. Start sign-in again in Stage.`);
      const epoch = tokenStorage.sessionKey();
      const user = await api.getCurrentUser();
      if (epoch !== tokenStorage.sessionKey() || user.id !== auth.user?.id)
        throw new Error(t`Your account changed. Reload this page before connecting.`);
      const token = tokenStorage.get();
      if (!token) throw new Error(t`Sign in with WorkOS again.`);
      const response = await fetch(current.redirectUri, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: current.state, token }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(t`Stage could not connect. Start a new connection in Stage.`);
      clearStageConnection();
      setConnected(true);
    } catch {
      setError(
        t`Could not connect. Keep Stage open, check your sign-in and local network access, then retry. If the request expired, start again in Stage.`,
      );
    } finally {
      setBusy(false);
    }
  }
  function login() {
    if (!connection || !readStageConnection()) {
      setError(t`This request expired. Start sign-in again in Stage.`);
      return;
    }
    rememberAuthReturnTo("/stage-connect");
    auth.signIn();
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-md space-y-5 rounded-xl border border-border bg-card p-6 shadow-lg">
        <h1 className="text-2xl font-semibold">
          {connected ? (
            <Trans>Connected to Stage</Trans>
          ) : (
            <Trans>Connect CozyCrowns to Stage</Trans>
          )}
        </h1>
        <p className="text-sm text-muted-foreground">
          {connected ? (
            <Trans>Return to Stage and choose your book club.</Trans>
          ) : (
            <Trans>
              Stage can follow your Mavens and book clubs, read GM mystery material, and mark clues
              found when you choose.
            </Trans>
          )}
        </p>
        {!connected &&
          (!connection ? (
            <p role="alert">
              <Trans>Start a connection from Settings → Integrations in Stage.</Trans>
            </p>
          ) : auth.loading ? (
            <p role="status">
              <Trans>Checking your account…</Trans>
            </p>
          ) : auth.user ? (
            <>
              <p className="text-sm">
                <Trans>Connect as</Trans> <strong>{auth.user.nickname || auth.user.email}</strong>
              </p>
              <Button disabled={busy} onClick={() => void connect()}>
                {busy ? <Trans>Connecting…</Trans> : <Trans>Connect to Stage</Trans>}
              </Button>
            </>
          ) : (
            <Button onClick={login}>
              <Trans>Sign in with WorkOS</Trans>
            </Button>
          ))}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <a href="/" onClick={clearStageConnection} className="block text-sm underline">
          <Trans>Return to CozyCrowns</Trans>
        </a>
      </section>
    </main>
  );
}
