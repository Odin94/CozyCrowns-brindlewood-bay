import type { BookClubNoteCursor } from "../utils/api.ts";

/** A live notification can arrive before its create request's acknowledgement. */
export function reconcileCreatedEntry<T extends { id: string }>(current: T[], created: T): T[] {
  return current.some((entry) => entry.id === created.id) ? current : [...current, created];
}

type Timer = ReturnType<typeof setTimeout>;
export type LiveConnection = {
  close: () => void;
  send: (data: string) => void;
  readonly readyState: number;
  addEventListener: (type: "close", listener: () => void, options?: { once: boolean }) => void;
};
type Environment = {
  connect: (
    updated: () => void,
    cursor: (cursor: BookClubNoteCursor) => void,
  ) => LiveConnection | null;
  visible: () => boolean;
  visibility: (listener: () => void) => () => void;
  later: (callback: () => void, delay: number) => Timer;
  cancel: (timer: Timer) => void;
  now: () => number;
};
export type LiveSnapshot<T> = {
  data: T;
  loading: boolean;
  error?: unknown;
  cursors: Array<BookClubNoteCursor & { seenAt: number }>;
};

/** Owns one update lifetime, including recovery and stale snapshot rejection. */
export class LiveBookClub<T> {
  private state: LiveSnapshot<T>;
  private env: Environment;
  private load: () => Promise<T>;
  private error: (error: unknown) => void;
  private userId?: string;
  private reconcile: (previous: T, incoming: T) => T;
  private listener = (_state: LiveSnapshot<T>) => {};
  private active = false;
  private lifetime = 0;
  private revision = 0;
  private holds = 0;
  private queued = false;
  private quiet = true;
  private running: Promise<void> | null = null;
  private connection: LiveConnection | null = null;
  private timers = new Set<Timer>();
  private cursorTimer?: Timer;
  private unsubscribe?: () => void;
  private attempts = 0;

  constructor(
    initial: T,
    load: () => Promise<T>,
    env: Environment,
    error: (error: unknown) => void,
    userId?: string,
    reconcile: (previous: T, incoming: T) => T = (_previous, incoming) => incoming,
  ) {
    this.state = { data: initial, loading: true, cursors: [] };
    this.load = load;
    this.env = env;
    this.error = error;
    this.userId = userId;
    this.reconcile = reconcile;
  }
  private emit() {
    if (this.active) this.listener(this.state);
  }
  private later(callback: () => void, delay: number) {
    const lifetime = this.lifetime;
    const timer = this.env.later(() => {
      this.timers.delete(timer);
      if (this.active && lifetime === this.lifetime) callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }
  start(listener: (state: LiveSnapshot<T>) => void): () => void {
    this.lifetime++;
    this.active = true;
    this.listener = listener;
    this.emit();
    void this.refresh(false);
    const poll = () => {
      if (this.env.visible()) void this.refresh();
      this.later(poll, 120_000);
    };
    this.later(poll, 120_000);
    this.unsubscribe = this.env.visibility(() => {
      if (this.env.visible()) void this.refresh();
    });
    this.later(() => this.connect(), 0);
    return () => this.stop();
  }
  private connect() {
    const lifetime = this.lifetime;
    const connection = this.env.connect(
      () => {
        if (!this.active || lifetime !== this.lifetime) return;
        this.attempts = 0;
        void this.refresh();
      },
      (cursor) => {
        if (!this.active || lifetime !== this.lifetime || cursor.userId === this.userId) return;
        this.state = {
          ...this.state,
          cursors: [
            ...this.state.cursors.filter(
              (entry) => entry.userId !== cursor.userId || entry.bookClubId !== cursor.bookClubId,
            ),
            { ...cursor, seenAt: this.env.now() },
          ],
        };
        this.emit();
        this.expireCursors();
      },
    );
    this.connection = connection;
    this.emit();
    const reconnect = () => {
      if (this.active && lifetime === this.lifetime)
        this.later(() => this.connect(), Math.min(5_000 * 2 ** this.attempts++, 60_000));
    };
    if (!connection) reconnect();
    else connection.addEventListener("close", reconnect, { once: true });
  }
  private expireCursors() {
    if (this.cursorTimer) {
      this.env.cancel(this.cursorTimer);
      this.timers.delete(this.cursorTimer);
    }
    if (!this.state.cursors.length) return;
    const next = Math.min(...this.state.cursors.map((entry) => entry.seenAt + 8_000));
    this.cursorTimer = this.later(
      () => {
        this.state = {
          ...this.state,
          cursors: this.state.cursors.filter((entry) => this.env.now() - entry.seenAt < 8_000),
        };
        this.emit();
        this.expireCursors();
      },
      Math.max(0, next - this.env.now()) + 20,
    );
  }
  refresh(quiet = true): Promise<void> {
    if (!this.active) return Promise.resolve();
    this.queued = true;
    this.quiet = this.quiet && quiet;
    if (this.holds) return this.running ?? Promise.resolve();
    if (this.running) return this.running;
    const lifetime = this.lifetime;
    const run = async () => {
      while (this.active && lifetime === this.lifetime && this.queued && !this.holds) {
        this.queued = false;
        const showError = !this.quiet;
        this.quiet = true;
        const revision = this.revision;
        try {
          // Requests must run in order; each follow-up consumes the latest server snapshot.
          // eslint-disable-next-line no-await-in-loop
          const data = await this.load();
          if (!this.active || lifetime !== this.lifetime) return;
          if (revision === this.revision && !this.holds)
            this.state = {
              ...this.state,
              data: this.reconcile(this.state.data, data),
              error: undefined,
            };
          else this.queued = true;
        } catch (error) {
          if (this.active && lifetime === this.lifetime) {
            this.state = { ...this.state, error };
            if (showError) this.error(error);
          }
        }
        if (this.active && lifetime === this.lifetime) {
          this.state = { ...this.state, loading: false };
          this.emit();
        }
      }
    };
    const running = run().finally(() => {
      if (this.running !== running) return;
      this.running = null;
      if (this.active && this.queued && !this.holds) void this.refresh();
    });
    this.running = running;
    return this.running;
  }
  edit(update: (current: T) => T) {
    this.revision++;
    this.state = { ...this.state, data: update(this.state.data) };
    this.emit();
  }
  hold(): () => void {
    this.holds++;
    this.revision++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holds--;
      if (this.active) void this.refresh();
    };
  }
  send(data: string) {
    if (this.active && this.connection?.readyState === 1) this.connection.send(data);
  }
  get socket() {
    return this.connection;
  }
  private stop() {
    this.lifetime++;
    this.active = false;
    this.running = null;
    this.unsubscribe?.();
    for (const timer of this.timers) this.env.cancel(timer);
    this.timers.clear();
    this.connection?.close();
    this.connection = null;
  }
}

export function reconcileClubSelection(
  ids: string[],
  preferred: string | null,
  previous: string | null,
): string | null {
  return (
    (preferred && ids.includes(preferred) ? preferred : null) ??
    (previous && ids.includes(previous) ? previous : null) ??
    ids[0] ??
    null
  );
}
