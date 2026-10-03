/** Token rotation keeps the session; logout/account changes invalidate queued work. */
let snapshot = {
  accountId: null as string | null,
  generation: 0,
  revalidating: false,
  signingOut: false,
};
const listeners = new Set<() => void>();
const publish = (change: Partial<typeof snapshot>) => {
  snapshot = { ...snapshot, ...change };
  listeners.forEach((listener) => listener());
};
export const accountScope = {
  current: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  invalidate: () => {
    publish({
      accountId: null,
      generation: snapshot.generation + 1,
      revalidating: false,
      signingOut: false,
    });
  },
  beginSignOut: () => {
    publish({
      accountId: null,
      generation: snapshot.generation + 1,
      revalidating: false,
      signingOut: true,
    });
  },
  revalidate: () => {
    if (!snapshot.signingOut) publish({ generation: snapshot.generation + 1, revalidating: true });
  },
  set: (next: string | null) => {
    if (next !== snapshot.accountId || snapshot.revalidating || snapshot.signingOut)
      publish({
        accountId: next,
        generation: snapshot.generation + (next !== snapshot.accountId ? 1 : 0),
        revalidating: false,
        signingOut: false,
      });
  },
};
export type AccountScope = Pick<
  ReturnType<typeof accountScope.current>,
  "accountId" | "generation"
> & { revalidating?: boolean; signingOut?: boolean };
