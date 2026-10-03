// Evaluate on the Vite origin's /favicon.ico document. No backend writes are made.
// Exposes the actual transformed private NotesPanel solely in an in-memory module.
(async () => {
  const source = await (await fetch("/src/pages/BookClubOverview.tsx")).text();
  const origin = location.origin;
  const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  const dep = (fragment) => imports.find((url) => url.includes(fragment));
  await import(origin + "/@react-refresh");
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => (type) => type;
  const reactModule = await import(origin + dep("/react.js"));
  const React = reactModule.default ?? reactModule;
  const dom = await import(origin + "/node_modules/.vite/deps/react-dom_client.js");
  const ReactDOM = dom.default ?? dom;
  const lingui = await import(origin + dep("@lingui_core"));
  const lr = await import(origin + dep("@lingui_react"));
  lingui.i18n.load("en", {});
  lingui.i18n.activate("en");
  const { api } = await import(origin + dep("/utils/api"));
  const apiSource = await (await fetch(dep("/utils/api"))).text();
  const accountUrl = [...apiSource.matchAll(/from "([^"]+)"/g)]
    .map((m) => m[1])
    .find((url) => url.includes("account_scope"));
  const { accountScope } = await import(origin + accountUrl);
  const probeAccounts = ["review-alice", "review-bob"];
  const storageKeys = Object.keys(localStorage).filter((key) =>
    probeAccounts.some((account) =>
      key.includes(`cozycrowns-book-club-notes:${account}:shared-club:`),
    ),
  );
  const originalDrafts = Object.fromEntries(
    storageKeys.map((key) => [key, localStorage.getItem(key)]),
  );
  for (const key of storageKeys) localStorage.removeItem(key);
  const originalScope = accountScope.current();
  const originalGet = api.getBookClubNotes;
  const originalUpdate = api.updateBookClubNotes;
  let modText = source.slice(0, source.indexOf("import * as RefreshRuntime"));
  modText = modText.replace(/import\.meta\.hot = __vite__createHotContext\([^;]+;/, "");
  modText = modText.replaceAll(
    /(from\s+|import\s+)("\/[^"]+")/g,
    (_, p, url) => p + JSON.stringify(origin + JSON.parse(url)),
  );
  modText =
    "const $RefreshSig$ = () => () => {}; const $RefreshReg$ = () => {};\n" +
    modText +
    "\nexport { NotesPanel };";
  const blob = URL.createObjectURL(new Blob([modText], { type: "text/javascript" }));
  const { NotesPanel } = await import(blob);
  const writes = [];
  const host = document.createElement("div");
  document.body.append(host);
  const root = ReactDOM.createRoot(host);
  api.getBookClubNotes = async () => ({
    shared: { content: "", version: 0 },
    private: { content: "", version: 0 },
  });
  api.updateBookClubNotes = async (id, data) => {
    writes.push({ account: accountScope.current().accountId, id, ...data });
    return { content: data.content, version: 1 };
  };
  const render = (key) =>
    root.render(
      React.createElement(
        lr.I18nProvider,
        { i18n: lingui.i18n },
        React.createElement(NotesPanel, {
          key,
          club: { id: "shared-club", sharedNotes: "", sharedNotesVersion: 0 },
          socket: null,
          cursors: [],
        }),
      ),
    );
  try {
    accountScope.set("review-alice");
    render("review-alice");
    await new Promise((r) => setTimeout(r, 100));
    const textarea = host.querySelector(".is-private textarea");
    if (!textarea || textarea.disabled) throw new Error("Private notebook did not load");
    const propsKey = Object.keys(textarea).find((key) => key.startsWith("__reactProps"));
    textarea[propsKey].onChange({ target: { value: "Alice private draft" } });
    accountScope.revalidate();
    accountScope.set("review-bob");
    render("review-bob");
    await new Promise((r) => setTimeout(r, 100));
    const bobContent = host.querySelector(".is-private textarea").value;
    const recoveredDraft = localStorage.getItem(
      "cozycrowns-book-club-notes:review-alice:shared-club:private",
    );
    if (writes.some((write) => write.account === "review-bob") || bobContent || !recoveredDraft)
      throw new Error("Old notebook leaked across accounts or its draft was lost");
    accountScope.revalidate();
    accountScope.set("review-alice");
    render("review-alice-returned");
    await new Promise((r) => setTimeout(r, 100));
    if (
      writes.length !== 1 ||
      writes[0].account !== "review-alice" ||
      writes[0].content !== "Alice private draft"
    )
      throw new Error("Original account did not recover its notebook draft");
    // Keep an old save pending while the same account receives a verified new token.
    let finishUpdate;
    const pendingUpdate = new Promise((resolve) => {
      finishUpdate = resolve;
    });
    api.updateBookClubNotes = async (id, data) => {
      writes.push({ account: accountScope.current().accountId, id, ...data });
      await pendingUpdate;
      return { content: data.content, version: 2 };
    };
    const resumedTextarea = host.querySelector(".is-private textarea");
    const resumedProps = Object.keys(resumedTextarea).find((key) => key.startsWith("__reactProps"));
    resumedTextarea[resumedProps].onChange({ target: { value: "Edits while token rotates" } });
    await new Promise((resolve) => setTimeout(resolve, 700));
    accountScope.revalidate();
    accountScope.set("review-alice");
    await new Promise((resolve) => setTimeout(resolve, 100));
    finishUpdate();
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (
      writes.length !== 3 ||
      writes.some((write) => write.account !== "review-alice") ||
      localStorage.getItem("cozycrowns-book-club-notes:review-alice:shared-club:private") !== null
    )
      throw new Error("Pending notebook save did not resume in the verified original account");
    return { writes, bobContent, draftRecoveredByOriginalAccount: true, pendingSaveResumed: true };
  } finally {
    root.unmount();
    for (const key of Object.keys(localStorage))
      if (
        probeAccounts.some((account) =>
          key.includes(`cozycrowns-book-club-notes:${account}:shared-club:`),
        )
      )
        localStorage.removeItem(key);
    for (const [key, value] of Object.entries(originalDrafts)) localStorage.setItem(key, value);
    host.remove();
    URL.revokeObjectURL(blob);
    api.getBookClubNotes = originalGet;
    api.updateBookClubNotes = originalUpdate;
    accountScope.invalidate();
    accountScope.set(originalScope.accountId);
  }
})();
