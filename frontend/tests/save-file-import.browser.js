const saveFileDrop = (f) => {
  const transfer = new DataTransfer();
  transfer.items.add(f);
  document
    .querySelector('[role="dialog"]')
    .dispatchEvent(
      new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }),
    );
};
/* Evaluate on the Vite origin's /favicon.ico document.
 * Uses the actual MenuDialog and store, with in-memory persistence and a save fixture.
 * Covers invalid files, drop/paste, save-failure cancellation and concurrent edits.
 */
const saveFileImportsOf = async (path) =>
  [...(await (await fetch(path)).text()).matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
const saveFilePause = () => new Promise((resolve) => setTimeout(resolve, 180));
(async () => {
  await import("/@react-refresh");
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => (type) => type;
  const deps = await saveFileImportsOf("/src/components/MenuDialog/MenuDialog.tsx");
  const rm = await import(deps.find((url) => url.includes("/react.js")));
  const React = rm.default ?? rm;
  const dm = await import("/node_modules/.vite/deps/react-dom_client.js");
  const DOM = dm.default ?? dm;
  const authDeps = await saveFileImportsOf(deps.find((url) => url.includes("useAuth")));
  const rq = await import(authDeps.find((url) => url.includes("react-query")));
  const { accountScope } = await import(deps.find((url) => url.includes("account_scope")));
  const lc = await import(
    (await saveFileImportsOf("/src/pages/BookClubOverview.tsx")).find((url) =>
      url.includes("@lingui_core"),
    )
  );
  const lr = await import(deps.find((url) => url.includes("@lingui_react")));
  const { messages } = await import("/src/locales/en/messages.ts");
  lc.i18n.load("en", messages);
  lc.i18n.activate("en");
  const { useCharacterStore: store } = await import(
    deps.find((url) => url.includes("character_store"))
  );
  const { createDefaultCharacter } = await import(
    deps.find((url) => url.includes("character_document"))
  );
  const saveDeps = await saveFileImportsOf(deps.find((url) => url.includes("useCharacterSave")));
  const { mavenPersistence } = await import(saveDeps.find((url) => url.includes("maven_runtime")));
  const { default: MenuDialog } = await import("/src/components/MenuDialog/MenuDialog.tsx");
  const { Dialog } = await import(deps.find((url) => url.includes("/ui/dialog")));
  const darkDeps = await saveFileImportsOf("/src/pages/DarkConspiracySheet.tsx");
  const { useDarkConspiracyStore: darkStore, getDefaultDarkConspiracyData } = await import(
    darkDeps.find((url) => url.includes("dark_conspiracy_store"))
  );
  const { default: DarkSheet } = await import("/src/pages/DarkConspiracySheet.tsx");
  const originalDark = {
    state: darkStore.getState(),
    storage: darkStore.persist.getOptions().storage,
  };
  darkStore.persist.setOptions({
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
  const original = {
    state: store.getState(),
    storage: store.persist.getOptions().storage,
    save: mavenPersistence.save,
    scope: accountScope.current(),
  };
  store.persist.setOptions({
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  });
  const initial = {
    ...createDefaultCharacter(),
    name: "Original",
    localId: "import-probe-local",
    id: "import-probe-remote",
    version: 1,
  };
  store.setState({ characters: [initial], selectedCharacterId: initial.localId });
  const account = "file-import-probe";
  accountScope.set(account);
  const client = new rq.QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["auth", "me"], {
    id: account,
    nickname: "Reader",
    email: "reader@localhost",
    firstName: null,
    lastName: null,
    isSuperadmin: false,
  });
  let saves = 0,
    saveResult = true,
    finishSave;
  mavenPersistence.save = async () => {
    saves++;
    return finishSave
      ? new Promise((resolve) => {
          finishSave = resolve;
        })
      : saveResult;
  };
  const host = document.createElement("div");
  document.body.append(host);
  const errors = [];
  const root = DOM.createRoot(host, { onUncaughtError: (error) => errors.push(String(error)) });
  const h = React.createElement;
  const file = (name) =>
    new File([JSON.stringify({ ...createDefaultCharacter(), name })], "save.json", {
      type: "application/json",
    });
  try {
    root.render(
      h(
        React.StrictMode,
        null,
        h(
          rq.QueryClientProvider,
          { client },
          h(
            lr.I18nProvider,
            { i18n: lc.i18n },
            h(Dialog, { open: true }, h(MenuDialog, { open: true, onOpenChange: () => {} })),
          ),
        ),
      ),
    );
    await saveFilePause();
    saveFileDrop(new File(["{"], "broken.json"));
    await saveFilePause();
    if (saves || store.getState().selected().name !== "Original")
      throw new Error("Invalid file changed the sheet");
    saveFileDrop(file("Dropped"));
    await saveFilePause();
    if (
      saves !== 1 ||
      store.getState().selected().name !== "Dropped" ||
      store.getState().selected().id
    )
      throw new Error("Dropped save did not import with a fresh identity");
    saveResult = false;
    const pasted = new DataTransfer();
    pasted.items.add(file("Pasted"));
    document
      .querySelector('[role="dialog"]')
      .dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: pasted, bubbles: true, cancelable: true }),
      );
    await saveFilePause();
    const cancel = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Cancel",
    );
    if (!cancel || store.getState().selected().name !== "Dropped")
      throw new Error("Failed preservation did not ask before replacing content");
    cancel.click();
    await saveFilePause();
    if (store.getState().selected().name !== "Dropped")
      throw new Error("Cancelling import replaced content");
    finishSave = true;
    saveFileDrop(file("Delayed"));
    await saveFilePause();
    store.getState().setName("Edited while opening");
    finishSave(true);
    finishSave = null;
    await saveFilePause();
    if (store.getState().selected().name !== "Edited while opening" || errors.length)
      throw new Error(JSON.stringify({ name: store.getState().selected().name, errors }));
    root.render(
      h(lr.I18nProvider, { i18n: lc.i18n }, h(DarkSheet, { onBackToCharacterSheet: () => {} })),
    );
    await saveFilePause();
    const transferDark = new DataTransfer();
    transferDark.items.add(
      new File(
        [
          JSON.stringify({
            ...getDefaultDarkConspiracyData(),
            title: "Dropped conspiracy",
            id: "remote-dark",
            version: 9,
          }),
        ],
        "dark.json",
        { type: "application/json" },
      ),
    );
    host
      .querySelector(".dark-conspiracy-sheet")
      .dispatchEvent(
        new DragEvent("drop", { dataTransfer: transferDark, bubbles: true, cancelable: true }),
      );
    await saveFilePause();
    if (
      darkStore.getState().current.title !== "Dropped conspiracy" ||
      darkStore.getState().current.id
    )
      throw new Error("Dark Conspiracy drop did not detach its identity");
    const pastedDark = new DataTransfer();
    pastedDark.items.add(
      new File(
        [JSON.stringify({ ...getDefaultDarkConspiracyData(), title: "Pasted conspiracy" })],
        "dark.json",
        { type: "application/json" },
      ),
    );
    host
      .querySelector(".dark-conspiracy-sheet")
      .dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: pastedDark, bubbles: true, cancelable: true }),
      );
    await saveFilePause();
    if (darkStore.getState().current.title !== "Pasted conspiracy")
      throw new Error("Dark Conspiracy paste did not load");
    return {
      darkConspiracyDropAndPaste: true,
      invalidFilePreserved: true,
      dropImportedFreshIdentity: true,
      pastedFileCancellationPreserved: true,
      newerEditsPreserved: true,
      backendWrites: 0,
    };
  } finally {
    root.unmount();
    darkStore.setState(originalDark.state, true);
    darkStore.persist.setOptions({ storage: originalDark.storage });
    host.remove();
    client.clear();
    mavenPersistence.save = original.save;
    store.setState(original.state, true);
    store.persist.setOptions({ storage: original.storage });
    accountScope.invalidate();
    accountScope.set(original.scope.accountId);
  }
})();
