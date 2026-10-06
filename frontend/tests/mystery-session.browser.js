/* Evaluate this raw script on the Vite origin's /favicon.ico document.
 * Uses actual React and useMysteryPreservation with local-only API fixtures.
 * Checks that an already displayed Undo action survives same-account token rotation.
 */
const mysterySessionPause = () => new Promise((resolve) => setTimeout(resolve, 80));
(async () => {
  const source = await (await fetch("/src/hooks/useMysteryPreservation.ts")).text();
  const deps = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
  const reactModule = await import(deps.find((url) => url.includes("/react.js")));
  const React = reactModule.default ?? reactModule;
  const domModule = await import("/node_modules/.vite/deps/react-dom_client.js");
  const ReactDOM = domModule.default ?? domModule;
  const { useMysteryPreservation } = await import("/src/hooks/useMysteryPreservation.ts");
  const { accountScope } = await import(deps.find((url) => url.includes("account_scope")));
  const { api } = await import(deps.find((url) => url.includes("/utils/api")));
  const account = "architecture-undo-probe";
  const stored = Object.fromEntries(
    Object.keys(localStorage)
      .filter((key) => key.includes(account))
      .map((key) => [key, localStorage.getItem(key)]),
  );
  const original = {
    scope: accountScope.current(),
    getMysteries: api.getMysteries,
    deleteMystery: api.deleteMystery,
    restoreMystery: api.restoreMystery,
    getMysteryVersions: api.getMysteryVersions,
  };
  const data = {
    schemaVersion: 1,
    title: "Undo probe",
    intro: "",
    establishingQuestions: [],
    complexity: 6,
    locations: [],
    suspects: [],
    clues: [],
    voidClues: [],
    moments: [],
  };
  const row = {
    id: "architecture-undo-probe-row",
    title: data.title,
    data,
    version: 1,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
  let deleted = false;
  let restores = 0;
  let hook;
  api.getMysteries = async () => ({ mysteries: deleted ? [] : [row] });
  api.deleteMystery = async () => {
    deleted = true;
    return { success: true };
  };
  api.restoreMystery = async () => {
    restores++;
    deleted = false;
    return row;
  };
  api.getMysteryVersions = async () => ({ versions: [] });
  accountScope.set(account);
  const host = document.createElement("div");
  document.body.append(host);
  const root = ReactDOM.createRoot(host);
  function Probe() {
    hook = useMysteryPreservation(account);
    return null;
  }
  try {
    root.render(React.createElement(Probe));
    await mysterySessionPause();
    const originalOwner = hook.owner;
    const removed = await originalOwner.delete();
    const undo = () => originalOwner.undelete(removed.id);
    accountScope.revalidate();
    await mysterySessionPause();
    accountScope.set(account);
    await mysterySessionPause();
    const undoResult = await undo();
    const result = {
      ownerReplaced: hook.owner !== originalOwner,
      undoResult,
      restoreRequests: restores,
      stillDeleted: deleted,
    };
    if (result.ownerReplaced || !undoResult || restores !== 1 || deleted)
      throw new Error(JSON.stringify(result));
    return result;
  } finally {
    root.unmount();
    host.remove();
    Object.assign(api, {
      getMysteries: original.getMysteries,
      deleteMystery: original.deleteMystery,
      restoreMystery: original.restoreMystery,
      getMysteryVersions: original.getMysteryVersions,
    });
    for (const key of Object.keys(localStorage))
      if (key.includes(account)) localStorage.removeItem(key);
    for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value);
    accountScope.invalidate();
    accountScope.set(original.scope.accountId);
  }
})();
