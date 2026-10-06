import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LiveBookClub,
  reconcileClubSelection,
  reconcileCreatedEntry,
  type LiveSnapshot,
} from "../src/lib/live_book_club.ts";
import type { BookClubNoteCursor } from "../src/utils/api.ts";
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("a live-created note or connection cannot be duplicated by its delayed acknowledgement", async () => {
  await Promise.all(
    ["node", "edge"].map(async (kind) => {
      const response = deferred<{ id: string; version: number; text: string }>();
      const created = { id: `${kind}-created`, version: 1, text: "Created" };
      let rows: (typeof created)[] = [];
      const acknowledge = response.promise.then((entry) => {
        rows = reconcileCreatedEntry(rows, entry);
      });
      // The socket notification and a subsequent edit win the race with the POST response.
      rows = [{ ...created, version: 2, text: "Newer annotation" }];
      response.resolve(created);
      await acknowledge;
      assert.deepEqual(rows, [{ ...created, version: 2, text: "Newer annotation" }]);
    }),
  );
});

test("create acknowledgements still insert entries when the live notification arrives later", () => {
  const created = { id: "created", version: 1 };
  assert.deepEqual(reconcileCreatedEntry([{ id: "existing", version: 1 }], created), [
    { id: "existing", version: 1 },
    created,
  ]);
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const noop = () => {};
function fixture(load: () => Promise<number>) {
  let now = 0;
  let visible = true;
  let onVisible = noop;
  let timerId = 0;
  const timers = new Map<number, { callback: () => void; at: number }>();
  const connections: Array<{
    update: () => void;
    cursor: (cursor: BookClubNoteCursor) => void;
    closed: () => void;
    stopped: boolean;
  }> = [];
  const states: LiveSnapshot<number>[] = [];
  const live = new LiveBookClub(
    0,
    load,
    {
      connect: (update, cursor) => {
        const connection = { update, cursor, closed: () => {}, stopped: false };
        connections.push(connection);
        return {
          close: () => {
            connection.stopped = true;
            connection.closed();
          },
          send: () => {},
          readyState: 1,
          addEventListener: (_type, listener) => {
            connection.closed = listener;
          },
        };
      },
      visible: () => visible,
      visibility: (listener) => {
        onVisible = listener;
        return () => {
          onVisible = noop;
        };
      },
      now: () => now,
      later: (callback, delay) => {
        const id = ++timerId;
        timers.set(id, { callback, at: now + delay });
        return id as unknown as ReturnType<typeof setTimeout>;
      },
      cancel: (timer) => {
        timers.delete(timer as unknown as number);
      },
    },
    () => {},
    "me",
  );
  const stop = live.start((state) => states.push(state));
  const advance = async (duration: number) => {
    const end = now + duration;
    while (true) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.at <= end)
        .toSorted((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
      // Process scheduled events in virtual-time order.
      // eslint-disable-next-line no-await-in-loop
      await tick();
    }
    now = end;
  };
  return {
    live,
    stop,
    states,
    connections,
    timers,
    advance,
    visibility: (next: boolean) => {
      visible = next;
      onVisible();
    },
  };
}
test("live snapshots coalesce concurrent refresh triggers", async () => {
  const first = deferred<number>();
  let calls = 0;
  const f = fixture(() => (++calls === 1 ? first.promise : Promise.resolve(calls)));
  await f.advance(0);
  f.connections[0].update();
  f.connections[0].update();
  const refreshed = f.live.refresh();
  first.resolve(1);
  await refreshed;
  assert.equal(calls, 2);
  assert.equal(f.states.at(-1)!.data, 2);
  f.stop();
});
test("live snapshots reject a fetch started before a local mutation", async () => {
  const first = deferred<number>();
  let calls = 0;
  const f = fixture(() => (++calls === 1 ? first.promise : Promise.resolve(30)));
  f.live.edit(() => 20);
  first.resolve(10);
  await tick();
  assert.equal(
    f.states.some((state) => state.data === 10),
    false,
  );
  assert.equal(f.states.at(-1)!.data, 30);
  f.stop();
});
test("live refresh waits for interaction release and reconciles afterward", async () => {
  let calls = 0;
  const f = fixture(async () => ++calls);
  await tick();
  const release = f.live.hold();
  f.live.edit(() => 42);
  await f.live.refresh();
  assert.equal(calls, 1);
  assert.equal(f.states.at(-1)!.data, 42);
  release();
  await tick();
  assert.equal(calls, 2);
  f.stop();
});
test("live polling pauses in hidden tabs and resumes on visibility", async () => {
  let calls = 0;
  const f = fixture(async () => ++calls);
  await tick();
  f.visibility(false);
  await f.advance(120_000);
  assert.equal(calls, 1);
  f.visibility(true);
  await tick();
  assert.equal(calls, 2);
  await f.advance(120_000);
  assert.equal(calls, 3);
  f.stop();
});
test("live reconnect backs off, cursor expiry ignores own cursors, and disposal cleans up", async () => {
  const f = fixture(async () => 1);
  await f.advance(0);
  const connection = f.connections[0];
  const cursor: BookClubNoteCursor = {
    type: "book-club-note-cursor",
    bookClubId: "club",
    userId: "other",
    nickname: "friend",
    start: 1,
    end: 2,
  };
  connection.cursor({ ...cursor, userId: "me" });
  assert.equal(f.states.at(-1)!.cursors.length, 0);
  connection.cursor(cursor);
  assert.equal(f.states.at(-1)!.cursors.length, 1);
  connection.closed();
  await f.advance(4_999);
  assert.equal(f.connections.length, 1);
  await f.advance(1);
  assert.equal(f.connections.length, 2);
  f.connections[1].closed();
  await f.advance(3_020);
  assert.equal(f.states.at(-1)!.cursors.length, 0);
  await f.advance(6_980);
  assert.equal(f.connections.length, 3);
  f.stop();
  assert.equal(f.timers.size, 0);
  assert.equal(f.connections.at(-1)!.stopped, true);
  const count = f.states.length;
  connection.update();
  connection.cursor(cursor);
  assert.equal(f.states.length, count);
});
test("live disposal rejects outstanding loads, including a restarted lifetime", async () => {
  const first = deferred<number>();
  let calls = 0;
  const f = fixture(() => (++calls === 1 ? first.promise : Promise.resolve(2)));
  f.stop();
  const states: LiveSnapshot<number>[] = [];
  const stop = f.live.start((state) => states.push(state));
  await tick();
  first.resolve(99);
  await tick();
  assert.equal(states.at(-1)!.data, 2);
  assert.equal(
    states.some((state) => state.data === 99),
    false,
  );
  stop();
});
test("club selection reconciles unavailable preferences and preserves an existing selection", () => {
  assert.equal(reconcileClubSelection(["a", "b"], "missing", "b"), "b");
  assert.equal(reconcileClubSelection(["a", "b"], "a", "b"), "a");
  assert.equal(reconcileClubSelection([], "a", "b"), null);
});

test("failed snapshots retain data and expose an error until a successful retry", async () => {
  let failed = false;
  const failure = new Error("Temporarily unavailable");
  const f = fixture(async () => {
    if (failed) throw failure;
    return 7;
  });
  await tick();
  failed = true;
  await f.live.refresh(false);
  assert.equal(f.states.at(-1)?.data, 7);
  assert.equal(f.states.at(-1)?.error, failure);
  assert.equal(f.states.at(-1)?.loading, false);
  failed = false;
  await f.live.refresh(false);
  assert.equal(f.states.at(-1)?.data, 7);
  assert.equal(f.states.at(-1)?.error, undefined);
  f.stop();
});

test("a failure from a stopped lifetime cannot publish an error", async () => {
  let reject!: (reason: Error) => void;
  const f = fixture(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const count = f.states.length;
  f.stop();
  reject(new Error("Late network failure"));
  await tick();
  assert.equal(f.states.length, count);
  assert.equal(f.states.at(-1)?.error, undefined);
});
