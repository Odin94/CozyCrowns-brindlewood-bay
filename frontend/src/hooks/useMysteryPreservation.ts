import { useEffect, useMemo, useSyncExternalStore } from "react";
import { MysteryPreservation } from "@/lib/mystery_preservation";
import { accountScope } from "@/lib/account_scope";
import { api } from "@/utils/api";
import { t } from "@lingui/core/macro";
import { toast } from "sonner";

export function useMysteryPreservation(userId?: string) {
  const session = useSyncExternalStore(accountScope.subscribe, accountScope.current);
  const owner = useMemo(() => {
    const preservation = new MysteryPreservation({
      scope: () => {
        const current = accountScope.current();
        return current.accountId === (userId ?? null) ? current : { ...current, accountId: null };
      },
      storage: localStorage,
      remote: api,
      untitled: () => t`Untitled Mystery`,
      failed: (error) =>
        toast.error(
          error instanceof Error ? error.message : t`Could not save mystery`,
          (error as Error & { status?: number }).status === 409
            ? {
                action: {
                  label: t`Reload`,
                  onClick: () =>
                    void preservation.reload().then((undo) => {
                      if (undo)
                        toast.success(t`Mystery restored.`, {
                          action: { label: t`Undo`, onClick: () => void undo() },
                        });
                    }),
                },
              }
            : undefined,
        ),
      later: (callback, delay) => setTimeout(callback, delay),
      cancel: (timer) => clearTimeout(timer),
    });
    return preservation;
  }, [userId]);
  const state = useSyncExternalStore(owner.subscribe, owner.current);
  useEffect(() => {
    if (userId) void owner.load();
    return () => owner.dispose();
  }, [owner, userId]);
  useEffect(() => {
    if (userId && !session.revalidating && !session.signingOut) void owner.resumeSession();
  }, [owner, userId, session]);
  return { ...state, owner };
}
