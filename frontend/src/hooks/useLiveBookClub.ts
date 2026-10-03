import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { accountScope } from "@/lib/account_scope";
import { LiveBookClub, type LiveSnapshot } from "@/lib/live_book_club";
import { connectBookClubUpdates } from "@/utils/api";

/** Views render snapshots; the module owns all connection and refresh lifetimes. */
export function useLiveBookClub<T>(
  key: string,
  initial: T,
  load: () => Promise<T>,
  failed: (error: unknown) => void,
  userId?: string,
  reconcile?: (previous: T, incoming: T) => T,
) {
  const session = useSyncExternalStore(accountScope.subscribe, accountScope.current);
  const callbacks = useRef({ key, initial, load, failed, reconcile });
  callbacks.current = { key, initial, load, failed, reconcile };
  const live = useMemo(
    () =>
      new LiveBookClub(
        callbacks.current.initial,
        () => {
          if (callbacks.current.key !== key) return Promise.reject(new Error("Live scope changed"));
          return callbacks.current.load();
        },
        {
          connect: connectBookClubUpdates,
          visible: () => document.visibilityState === "visible",
          visibility: (listener) => {
            document.addEventListener("visibilitychange", listener);
            return () => document.removeEventListener("visibilitychange", listener);
          },
          later: (callback, delay) => setTimeout(callback, delay),
          cancel: (timer) => clearTimeout(timer),
          now: Date.now,
        },
        (error) => callbacks.current.failed(error),
        userId,
        (previous, incoming) => callbacks.current.reconcile?.(previous, incoming) ?? incoming,
      ),
    [key, userId],
  );
  const [snapshot, setSnapshot] = useState<{ owner: typeof live; state: LiveSnapshot<T> }>({
    owner: live,
    state: { data: initial, loading: true, cursors: [] },
  });
  useEffect(() => {
    if (session.revalidating || session.signingOut) return;
    return live.start((state) => setSnapshot({ owner: live, state }));
  }, [live, session.generation, session.revalidating, session.signingOut]);
  return {
    ...(snapshot.owner === live ? snapshot.state : { data: initial, loading: true, cursors: [] }),
    live,
  };
}
