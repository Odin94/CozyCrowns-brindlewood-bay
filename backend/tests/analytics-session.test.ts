import assert from "node:assert/strict";
import test from "node:test";
import {
  identifyAnalyticsUser,
  resetAnalyticsAndNavigate,
} from "../../frontend/src/lib/analytics_session.ts";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
};
const user = (id: string) => ({ id, email: `${id}@example.test`, firstName: null, lastName: null });
const unexpectedError = (error: unknown) => {
  throw error;
};

test("logout cancels identification queued behind a delayed analytics initializer", async () => {
  const events: string[] = [];
  const client = {
    identify: (id: string) => events.push(`identify:${id}`),
    reset: () => events.push("reset"),
  };
  const loading = deferred<typeof client>();
  const cancel = identifyAnalyticsUser(() => loading.promise, user("first"), unexpectedError);
  cancel();
  const logout = resetAnalyticsAndNavigate(
    () => loading.promise,
    () => {
      events.push("navigate");
    },
    unexpectedError,
  );
  assert.deepEqual(events, []);
  loading.resolve(client);
  await logout;
  assert.deepEqual(events, ["reset", "navigate"]);
});

test("a user transition identifies only the current user when initialization finishes", async () => {
  const identities: string[] = [];
  const client = { identify: (id: string) => identities.push(id), reset: () => {} };
  const loading = deferred<typeof client>();
  const cancelFirst = identifyAnalyticsUser(() => loading.promise, user("first"), unexpectedError);
  cancelFirst();
  const cancelSecond = identifyAnalyticsUser(
    () => loading.promise,
    user("second"),
    unexpectedError,
  );
  loading.resolve(client);
  await loading.promise;
  assert.deepEqual(identities, ["second"]);
  cancelSecond();
});

test("logout still navigates when analytics fails or is disabled", async () => {
  const failure = new Error("Analytics chunk unavailable");
  const events: unknown[] = [];
  await resetAnalyticsAndNavigate(
    () => Promise.reject(failure),
    () => {
      events.push("navigate");
    },
    (error) => {
      events.push(error);
    },
  );
  assert.deepEqual(events, [failure, "navigate"]);
  events.length = 0;
  await resetAnalyticsAndNavigate(
    () => Promise.resolve(undefined),
    () => {
      events.push("navigate");
    },
    unexpectedError,
  );
  assert.deepEqual(events, ["navigate"]);
});
