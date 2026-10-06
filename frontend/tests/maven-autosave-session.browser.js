/* Run this raw script on the Vite origin /favicon.ico. Mounts the actual sheet with local fetch fixtures; asserts autosave resumes after token verification. */
const mavenAutosavePause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  await import("/@react-refresh");
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => (type) => type;
  const sheetSource = await (await fetch("/src/pages/CharacterSheet.tsx")).text();
  const sheetDeps = [...sheetSource.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  const dep = (fragment) => sheetDeps.find((url) => url.includes(fragment));
  const rm = await import(dep("/react.js"));
  const React = rm.default ?? rm;
  const dm = await import("/node_modules/.vite/deps/react-dom_client.js");
  const ReactDOM = dm.default ?? dm;
  const authSource = await (await fetch(dep("/hooks/useAuth"))).text();
  const authDeps = [...authSource.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  const rq = await import(authDeps.find((url) => url.includes("react-query")));
  const { api, tokenStorage } = await import(authDeps.find((url) => url.includes("/utils/api")));
  const { accountScope } = await import(authDeps.find((url) => url.includes("account_scope")));
  const { createDefaultCharacter, toPersistedCharacter } =
    await import("/src/lib/character_document.ts");
  const lr = await import(dep("@lingui_react"));
  const runtimeSource = await (await fetch("/src/lib/maven_runtime.ts")).text();
  const coreUrl = [...runtimeSource.matchAll(/from "([^"]+)"/g)]
    .map((m) => m[1])
    .find((url) => url.includes("@lingui_core"));
  const lingui = await import(coreUrl);
  lingui.i18n.load("en", {});
  lingui.i18n.activate("en");
  const { useCharacterStore } = await import(dep("/lib/character_store"));
  const original = {
    fetch: window.fetch,
    scope: accountScope.current(),
    state: useCharacterStore.getState(),
    getCurrentUser: api.getCurrentUser,
  };
  const ownedKeys = [
    tokenStorage.key,
    "cozycrowns-character-storage",
    "cozycrowns-dark-conspiracy-storage",
    "cozycrowns-maven-save-receipts",
  ];
  const stored = Object.fromEntries(ownedKeys.map((key) => [key, localStorage.getItem(key)]));
  const user = {
    id: "review-autosave-alice",
    email: "review@invalid",
    firstName: null,
    lastName: null,
    nickname: null,
    isSuperadmin: false,
  };
  let remote = {
    ...createDefaultCharacter(),
    name: "Autosave probe",
    localId: "review-autosave-local",
    id: "review-autosave-remote",
    ownerId: user.id,
    version: 1,
  };
  remote.syncedContent = JSON.stringify(toPersistedCharacter(remote));
  const calls = [];
  window.fetch = async (input, options = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.includes("/characters") && !url.includes("/dark-conspiracies"))
      return original.fetch(input, options);
    if (url.includes("/dark-conspiracies")) return Response.json({ darkConspiracies: [] });
    if (options.method === "PUT") {
      const payload = JSON.parse(options.body);
      calls.push(payload);
      remote = { ...remote, ...payload.data, version: remote.version + 1 };
      return Response.json({ id: remote.id, version: remote.version });
    }
    return Response.json({
      characters: [
        { id: remote.id, version: remote.version, data: toPersistedCharacter(remote), owned: true },
      ],
    });
  };
  api.getCurrentUser = async () => user;
  tokenStorage.set("review-autosave-token");
  accountScope.set(user.id);
  useCharacterStore.setState({ characters: [remote], selectedCharacterId: remote.localId });
  const { default: CharacterSheet } = await import("/src/pages/CharacterSheet.tsx");
  const client = new rq.QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["auth", "me"], user);
  const host = document.createElement("div");
  document.body.append(host);
  const errors = [];
  const root = ReactDOM.createRoot(host, {
    onUncaughtError: (e) => errors.push(String(e.stack ?? e)),
  });
  try {
    root.render(
      React.createElement(
        rq.QueryClientProvider,
        { client },
        React.createElement(
          lr.I18nProvider,
          { i18n: lingui.i18n },
          React.createElement(CharacterSheet, {
            onBookClubsClick: () => {},
            onSwitchToCharacter: () => {},
          }),
        ),
      ),
    );
    await mavenAutosavePause(1100);
    if (errors.length) throw new Error(errors.join("\n"));
    const before = calls.length;
    accountScope.revalidate();
    useCharacterStore.getState().setStyle("Dirty during verification");
    await mavenAutosavePause(1100);
    const during = calls.length;
    accountScope.set(user.id);
    await mavenAutosavePause(1600);
    if (before !== during || calls.length <= during || remote.style !== "Dirty during verification")
      throw new Error("Paused Maven autosave did not resume after verification");
    return {
      before,
      during,
      after: calls.length,
      localStyle: useCharacterStore.getState().selected().style,
      remoteStyle: remote.style,
      mounted: host.textContent.includes("CozyCrowns"),
      errors,
    };
  } finally {
    root.unmount();
    host.remove();
    client.clear();
    useCharacterStore.setState(original.state);
    api.getCurrentUser = original.getCurrentUser;
    window.fetch = original.fetch;
    accountScope.invalidate();
    accountScope.set(original.scope.accountId);
    for (const [key, value] of Object.entries(stored)) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  }
})();
