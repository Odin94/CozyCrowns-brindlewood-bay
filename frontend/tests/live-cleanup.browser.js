const nativeCleanupImportsOf = async (path) =>
  [...(await (await fetch(path)).text()).matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
const nativeCleanupPause = () => new Promise((resolve) => setTimeout(resolve, 100));
/* Evaluate on the Vite origin's /favicon.ico document.
 * Exercises the real hooks in React StrictMode with native browser timers.
 * API and socket fixtures never write to the backend or change the login token.
 */
(async () => {
  await import("/@react-refresh");
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => (type) => type;
  const liveDeps = await nativeCleanupImportsOf("/src/hooks/useLiveBookClub.ts");
  const mysteryDeps = await nativeCleanupImportsOf("/src/hooks/useMysteryPreservation.ts");
  const reactModule = await import(liveDeps.find((url) => url.includes("/react.js")));
  const React = reactModule.default ?? reactModule;
  const domModule = await import("/node_modules/.vite/deps/react-dom_client.js");
  const ReactDOM = domModule.default ?? domModule;
  const { accountScope } = await import(liveDeps.find((url) => url.includes("account_scope")));
  const { api } = await import(mysteryDeps.find((url) => url.includes("/utils/api")));
  const { useLiveBookClub } = await import("/src/hooks/useLiveBookClub.ts");
  const { useMysteryPreservation } = await import("/src/hooks/useMysteryPreservation.ts");
  const lingui = await import(mysteryDeps.find((url) => url.includes("@lingui_core")));
  lingui.i18n.load("en", {});
  lingui.i18n.activate("en");
  const account = "native-timer-cleanup-probe";
  const original = {
    scope: accountScope.current(),
    getMysteries: api.getMysteries,
    getMysteryVersions: api.getMysteryVersions,
    updateMystery: api.updateMystery,
    socket: window.WebSocket,
  };
  const originals = Object.fromEntries(
    Object.keys(localStorage)
      .filter((key) => key.includes(account))
      .map((key) => [key, localStorage.getItem(key)]),
  );
  let writes = 0;
  const errors = [];
  const sockets = [];
  class Socket extends EventTarget {
    static OPEN = 1;
    readyState = 1;
    constructor() {
      super();
      sockets.push(this);
    }
    send() {}
    close() {
      this.readyState = 3;
      this.dispatchEvent(new Event("close"));
    }
  }
  window.WebSocket = Socket;
  const row = {
    id: account,
    title: "Cleanup",
    version: 1,
    data: {
      schemaVersion: 1,
      title: "Cleanup",
      intro: "",
      establishingQuestions: [],
      complexity: 6,
      locations: [],
      suspects: [],
      clues: [],
      voidClues: [],
      moments: [],
    },
  };
  api.getMysteries = async () => ({ mysteries: [row] });
  api.getMysteryVersions = async () => ({ versions: [] });
  api.updateMystery = async () => {
    writes++;
    return row;
  };
  accountScope.set(account);
  const host = document.createElement("div");
  document.body.append(host);
  const root = ReactDOM.createRoot(host, {
    onUncaughtError: (error) => errors.push(String(error)),
    onCaughtError: (error) => errors.push(String(error)),
  });
  let live, mystery;
  function Probe() {
    live = useLiveBookClub(
      "cleanup",
      [],
      async () => ["loaded"],
      (error) => errors.push(String(error)),
      account,
    );
    mystery = useMysteryPreservation(account);
    return React.createElement("p", null, live.data.join(","));
  }
  try {
    root.render(React.createElement(React.StrictMode, null, React.createElement(Probe)));
    await nativeCleanupPause();
    if (host.textContent !== "loaded" || !mystery?.selected)
      throw new Error("StrictMode remount did not load the hooks");
    mystery.owner.edit({ intro: "A pending draft" });
    mystery.owner.edit({ intro: "Replacing the pending draft cancels its timer" });
    root.unmount();
    await nativeCleanupPause();
    if (errors.length || sockets.some((socket) => socket.readyState !== 3) || writes)
      throw new Error(
        JSON.stringify({ errors, writes, sockets: sockets.map((socket) => socket.readyState) }),
      );
    return {
      strictModeLoaded: true,
      nativeTimerReplacementAndUnmount: true,
      socketsClosed: true,
      backendWrites: writes,
    };
  } finally {
    root.unmount();
    host.remove();
    window.WebSocket = original.socket;
    Object.assign(api, {
      getMysteries: original.getMysteries,
      getMysteryVersions: original.getMysteryVersions,
      updateMystery: original.updateMystery,
    });
    for (const key of Object.keys(localStorage))
      if (key.includes(account)) localStorage.removeItem(key);
    for (const [key, value] of Object.entries(originals)) localStorage.setItem(key, value);
    accountScope.invalidate();
    accountScope.set(original.scope.accountId);
  }
})();
