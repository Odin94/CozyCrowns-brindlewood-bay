/*
 * Run in the browser's main frame on the CozyCrowns Vite origin, preferably its
 * /favicon.ico document so the real application has no mounted auth observers.
 * Example: navigate to http://127.0.0.1:5175/favicon.ico, then paste this file
 * into the browser console or pass its contents to preview_evaluate.
 * It imports the actual transformed useAuth hook and its exact dependency URLs,
 * mounts real React/React Query, and replaces only API getCurrentUser/logout
 * with controlled local promises. No backend request or write is performed.
 * Returns observations or throws on regression; restores API methods, token, location hash, and root.
 * Logout uses a same-document hash URL to observe navigation without reloading.
 */
const authSessionPause = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  const source = await (await fetch("/src/hooks/useAuth.ts")).text();
  const imports = [...source.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
  const dependency = (fragment) => {
    const found = imports.find((url) => url.includes(fragment));
    if (!found) throw new Error(`Missing transformed hook dependency: ${fragment}`);
    return found;
  };
  const reactModule = await import(/* @vite-ignore */ dependency("/react.js"));
  const React = reactModule.default ?? reactModule;
  const rq = await import(/* @vite-ignore */ dependency("react-query"));
  const { useAuth } = await import(/* @vite-ignore */ "/src/hooks/useAuth.ts");
  const { accountScope } = await import(/* @vite-ignore */ dependency("account_scope"));
  const { api, tokenStorage } = await import(/* @vite-ignore */ dependency("/utils/api"));
  const domModule = await import(/* @vite-ignore */ "/node_modules/.vite/deps/react-dom_client.js");
  const ReactDOM = domModule.default ?? domModule;
  const original = {
    token: tokenStorage.get(),
    scope: accountScope.current(),
    getCurrentUser: api.getCurrentUser,
    logout: api.logout,
    href: location.href,
  };
  const user = { id: "review-alice", email: "review@invalid", firstName: null, lastName: null };
  const roots = [];
  const exceptions = [];
  const hosts = [];
  const clients = [];
  const mount = (Component) => {
    const client = new rq.QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["auth", "me"], user);
    clients.push(client);
    const host = document.createElement("div");
    document.body.append(host);
    hosts.push(host);
    const root = ReactDOM.createRoot(host, {
      onUncaughtError: (error) => exceptions.push(error.stack ?? String(error)),
    });
    roots.push(root);
    root.render(
      React.createElement(rq.QueryClientProvider, { client }, React.createElement(Component)),
    );
    return { client, root, host };
  };
  const resetSession = () => {
    tokenStorage.set("review-token");
    accountScope.set(user.id);
  };
  const results = {};
  try {
    // Probe 1: a fresh auth refetch starts after signOut invalidates the scope,
    // while the API logout request is still outstanding.
    resetSession();
    api.getCurrentUser = async () => user;
    let finishLogout;
    api.logout = () =>
      new Promise((resolve) => {
        finishLogout = resolve;
      });
    let auth;
    function LogoutProbe() {
      auth = useAuth();
      return React.createElement("span", {}, auth.user?.id ?? "anonymous");
    }
    const logoutMount = mount(LogoutProbe);
    await authSessionPause();
    if (!auth) throw new Error(exceptions.join("\n") || "Auth hook did not mount");
    auth.signOut();
    await authSessionPause();
    const afterSignOut = accountScope.current();
    await auth.refreshAuth();
    await authSessionPause();
    const afterRefetch = accountScope.current();
    if (!finishLogout) throw new Error("Logout mutation did not start");
    const logoutTarget = `${original.href.split("#")[0]}#review-logout-completed`;
    finishLogout({ success: true, logoutUrl: logoutTarget });
    await authSessionPause();
    results.logoutRace = {
      afterSignOut,
      afterRefetch,
      afterLogout: accountScope.current(),
      tokenRemains: tokenStorage.get() === "review-token",
      userRemains: auth.user?.id ?? null,
      followedLogoutUrl: location.hash === "#review-logout-completed",
    };
    logoutMount.root.unmount();
    logoutMount.host.remove();
    logoutMount.client.clear();
    roots.splice(roots.indexOf(logoutMount.root), 1);
    hosts.splice(hosts.indexOf(logoutMount.host), 1);
    history.replaceState(null, "", original.href);

    // Probe 2: a token rotation from another tab while /auth/me verification
    // is outstanding. Protected mirrors the actual App.tsx route semantics.
    resetSession();
    const pendingUsers = [];
    api.getCurrentUser = () => new Promise((resolve) => pendingUsers.push(resolve));
    let currentAuth;
    let editorMounts = 0;
    let editorUnmounts = 0;
    const requireSignIn = [];
    function Editor() {
      React.useEffect(() => {
        editorMounts++;
        return () => {
          editorUnmounts++;
        };
      }, []);
      const [draft] = React.useState("unsaved theory dialog text");
      return React.createElement("span", {}, draft);
    }
    function Protected() {
      currentAuth = useAuth();
      const { loading, isAuthenticated } = currentAuth;
      React.useEffect(() => {
        if (!loading && !isAuthenticated) requireSignIn.push("/sign-in");
      }, [loading, isAuthenticated]);
      if (loading || !isAuthenticated) return null;
      return React.createElement(Editor, { key: currentAuth.user?.id });
    }
    const storageMount = mount(Protected);
    await authSessionPause();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: tokenStorage.key,
        oldValue: "previous-review-token",
        newValue: "review-token",
      }),
    );
    await authSessionPause();
    const query = storageMount.client.getQueryState(["auth", "me"]);
    const during = {
      loading: currentAuth.loading,
      isAuthenticated: currentAuth.isAuthenticated,
      queryStatus: query.status,
      fetchStatus: query.fetchStatus,
      editorMounts,
      editorUnmounts,
      requireSignIn: [...requireSignIn],
    };
    for (const resolve of pendingUsers) resolve(user);
    await authSessionPause();
    results.crossTabRotation = {
      during,
      after: {
        loading: currentAuth.loading,
        isAuthenticated: currentAuth.isAuthenticated,
        editorMounts,
        editorUnmounts,
        requireSignIn: [...requireSignIn],
      },
    };
    // Confirm that another account resets the protected editor and cross-tab logout exits it.
    const beforeAccountChange = editorUnmounts;
    pendingUsers.length = 0;
    window.dispatchEvent(
      new StorageEvent("storage", { key: tokenStorage.key, newValue: "other-account-token" }),
    );
    await authSessionPause();
    for (const resolve of pendingUsers) resolve({ ...user, id: "review-bob" });
    await authSessionPause();
    results.crossTabAccountChange = {
      user: currentAuth.user?.id,
      editorUnmounts,
      reset: editorUnmounts > beforeAccountChange,
    };
    localStorage.removeItem(tokenStorage.key);
    window.dispatchEvent(new StorageEvent("storage", { key: tokenStorage.key, newValue: null }));
    await authSessionPause();
    results.crossTabLogout = {
      isAuthenticated: currentAuth.isAuthenticated,
      requireSignIn: [...requireSignIn],
    };
    if (
      results.logoutRace.tokenRemains ||
      results.logoutRace.userRemains ||
      !results.logoutRace.followedLogoutUrl
    )
      throw new Error("Logout completion was interrupted by auth refresh");
    if (
      results.crossTabRotation.during.editorUnmounts ||
      results.crossTabRotation.after.editorUnmounts ||
      requireSignIn.length !== 1
    )
      throw new Error("Token rotation unmounted the editor or logout did not require sign-in");
    if (!results.crossTabAccountChange.reset || results.crossTabAccountChange.user !== "review-bob")
      throw new Error("Account replacement did not retire the departing editor");
    if (results.crossTabLogout.isAuthenticated)
      throw new Error("Cross-tab logout remained authenticated");
    return results;
  } finally {
    for (const root of roots) root.unmount();
    for (const host of hosts) host.remove();
    for (const client of clients) client.clear();
    api.getCurrentUser = original.getCurrentUser;
    api.logout = original.logout;
    if (original.token === null) localStorage.removeItem(tokenStorage.key);
    else localStorage.setItem(tokenStorage.key, original.token);
    accountScope.invalidate();
    accountScope.set(original.scope.accountId);
    history.replaceState(null, "", original.href);
  }
})();
