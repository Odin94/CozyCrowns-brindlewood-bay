import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Profiler } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { loadTranslations } from "@/lib/utils";
import "@/index.css";

await loadTranslations("en");
i18n.activate("en");
const { api, tokenStorage } = await import("@/utils/api");
tokenStorage.remove(); // Fixture benchmark deliberately opens no real websocket.
const { createDefaultCharacter } = await import("@/lib/character_document");
const pages = {
  mysteries: (await import("@/pages/MysteriesPage")).default,
  library: (await import("@/pages/LibraryPage")).default,
  clubs: (await import("@/pages/BookClubOverview")).default,
  theory: (await import("@/pages/TheorizeBoard")).default,
  dark: (await import("@/pages/DarkConspiracySheet")).default,
  signin: (await import("@/pages/SignInPage")).default,
  maven: (await import("@/pages/BookClubMaven")).default,
};
const noop = () => {};
const stamp = "2026-10-03T00:00:00.000Z";
const entries = (name: string) =>
  Array.from({ length: 20 }, (_, index) => ({
    id: `${name}-${index}`,
    title: `${name} ${index}`,
    name: `${name} ${index}`,
    description: "A detailed fixture description",
    prompt: "Look closer",
    quote: "A fixture quote",
  }));
const mystery = {
  id: "fixture-mystery",
  title: "The fixture case",
  version: 1,
  createdAt: stamp,
  updatedAt: stamp,
  data: {
    schemaVersion: 1,
    title: "The fixture case",
    intro: "Fixture introduction",
    complexity: 6,
    establishingQuestions: ["Who knows the victim?"],
    locations: entries("Location"),
    suspects: entries("Suspect"),
    clues: entries("Clue"),
    voidClues: entries("Void"),
    moments: entries("Moment"),
  },
};
const club = {
  id: "fixture-club",
  name: "Fixture Book Club",
  ownerId: "fixture-user",
  sharedNotes: "Fixture shared notes",
  sharedNotesVersion: 1,
  createdAt: stamp,
  members: Array.from({ length: 24 }, (_, index) => ({
    id: index ? `member-${index}` : "fixture-user",
    nickname: `Player ${index}`,
    joinedAt: stamp,
    isGameMaster: !index,
    characters: [
      {
        id: `character-${index}`,
        name: `Maven ${index}`,
        version: 1,
        updatedAt: stamp,
        data: {
          ...createDefaultCharacter(),
          name: `Maven ${index}`,
          conditions: "Curious\nTired",
          mavenMoves: "A useful move",
          cozyItems: [{ text: "Tea", checked: false }],
        },
      },
    ],
  })),
  rolls: [],
  mysteries: [],
  activeMystery: null,
};
const nodes = Array.from({ length: 80 }, (_, index) => ({
  id: `node-${index}`,
  mysteryId: mystery.id,
  sourceClueId: null,
  kind: index % 2 ? "other" : "clue",
  title: `Fixture note ${index}`,
  description: "A fixture note description",
  tags: ["Fixture"],
  baseTag: "Fixture",
  x: (index % 10) * 350,
  y: Math.floor(index / 10) * 200,
  version: 1,
  editingByUserId: null,
  editingByNickname: null,
  editLockExpiresAt: null,
  createdAt: stamp,
  updatedAt: stamp,
}));
const board = {
  mystery: { id: mystery.id, title: mystery.title },
  nodes,
  edges: Array.from({ length: 100 }, (_, index) => ({
    id: `edge-${index}`,
    mysteryId: mystery.id,
    sourceNodeId: nodes[index % 80].id,
    targetNodeId: nodes[(index + 3) % 80].id,
    label: "Connection",
    version: 1,
    createdAt: stamp,
    updatedAt: stamp,
  })),
};
let requests: string[] = [];
let requestStarts: Array<{ name: string; ms: number }> = [];
const respond =
  <T,>(name: string, value: T, delay = 0) =>
  async () => {
    requests.push(name);
    requestStarts.push({ name, ms: performance.now() });
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    return structuredClone(value);
  };
Object.assign(api, {
  getMysteries: respond("mysteries", { mysteries: [mystery] }),
  getMysteryVersions: respond("versions", { versions: [] }),
  getBookClubs: respond("clubs", { clubs: [club], invitations: [] }),
  getBookClubTheory: respond("theory", board),
  getLibrary: respond(
    "library",
    { mysteries: Array.from({ length: 24 }, (_, i) => ({ ...mystery, id: `published-${i}` })) },
    80,
  ),
  getLibrarySummaries: respond(
    "library",
    {
      mysteries: Array.from({ length: 24 }, (_, i) => ({
        id: `published-${i}`,
        title: mystery.title,
        data: { intro: mystery.data.intro, complexity: mystery.data.complexity },
        locationCount: 20,
        suspectCount: 20,
      })),
    },
    80,
  ),
  getPendingPublishedMysteries: respond(
    "pending",
    { mysteries: [{ ...mystery, id: "pending" }] },
    80,
  ),
  getBookClubNotes: respond("notes", {
    shared: { content: "Shared fixture note", version: 1 },
    private: { content: "Private fixture note", version: 1 },
  }),
  getCharacters: respond("characters", { characters: [] }),
  getDarkConspiracies: respond("conspiracies", { darkConspiracies: [] }),
});
let expectedLibraryBooks = 25;
const root = createRoot(document.getElementById("root")!);
let durations: number[] = [];
let updates = 0;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (predicate: () => boolean) => {
  for (let n = 0; n < 200; n++) {
    if (predicate()) return;
    // Sequential readiness polling is intentional.
    // eslint-disable-next-line no-await-in-loop
    await pause(10);
  }
  throw new Error("View benchmark readiness timeout");
};
const mount = async (view: keyof typeof pages, panel: string | null = null) => {
  flushSync(() => root.render(null));
  localStorage.removeItem("cozycrowns-mystery-draft");
  requests = [];
  requestStarts = [];
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  query.setQueryData(["auth", "me"], {
    id: "fixture-user",
    email: "fixture@example.invalid",
    nickname: "Fixture",
    isSuperadmin: true,
  });
  const Component = pages[view];
  const props = {
    clubId: club.id,
    characterId: "character-1",
    panel,
    bookClubId: club.id,
    mysteryId: mystery.id,
    onClose: noop,
    onClubChange: noop,
    onPanelChange: noop,
    onOpenMaven: noop,
    onTheorize: noop,
    onBackToCharacterSheet: noop,
    onBack: noop,
    onGoToSheet: noop,
    onGoToDarkConspiracy: noop,
    returnTo: "/",
    onContinue: noop,
  };
  flushSync(() =>
    root.render(
      <QueryClientProvider client={query}>
        <I18nProvider i18n={i18n}>
          <Profiler
            id={view}
            onRender={(_, phase, duration) => {
              if (phase !== "mount") {
                updates++;
                durations.push(duration);
              }
            }}
          >
            <Component {...(props as never)} />
          </Profiler>
        </I18nProvider>
      </QueryClientProvider>,
    ),
  );
  if (view === "mysteries") await waitFor(() => Boolean(document.querySelector(".mystery-card")));
  if (view === "clubs")
    await waitFor(() => document.querySelectorAll(".book-club-maven-card").length === 24);
  if (view === "theory")
    await waitFor(() => document.querySelectorAll("[data-theory-node-id]").length === 80);
  if (view === "library")
    await waitFor(() => document.querySelectorAll(".library-book").length === expectedLibraryBooks);
  if (view === "maven") await waitFor(() => document.body.textContent!.includes("Read only"));
  await pause(30);
  return {
    view,
    requests: [...requests],
    requestStartSpreadMs:
      requestStarts.length > 1
        ? Math.max(...requestStarts.map((s) => s.ms)) - Math.min(...requestStarts.map((s) => s.ms))
        : 0,
    inputs: document.querySelectorAll("input,textarea").length,
  };
};
const edit = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
};
const run = async (view: "mysteries" | "clubs" | "theory" | "dark", workload = "edit") => {
  await mount(view);
  let target: HTMLInputElement | HTMLTextAreaElement | null = null;
  if (view === "mysteries") target = document.querySelector(".mystery-title input");
  if (view === "mysteries" && !target) target = document.querySelector(".mystery-parchment input");
  if (view === "clubs") target = document.querySelector('input[aria-label="Nickname"]');
  if (view === "theory" && workload === "edit") {
    Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent!.includes("Add note"))!
      .click();
    await pause(30);
    target = document.querySelector('[role="dialog"] input');
  }
  if (view === "dark") target = document.querySelector('textarea[aria-label="First Void Clue"]');
  if (!target && workload !== "pan") throw new Error(`No target for ${view}`);
  updates = 0;
  durations = [];
  (window as any).viewRenderCounts = {};
  const start = performance.now();
  for (let index = 0; index < 30; index++)
    flushSync(() => {
      if (workload === "pan")
        document
          .querySelector(".theory-board__canvas")!
          .dispatchEvent(new WheelEvent("wheel", { deltaY: 2, bubbles: true, cancelable: true }));
      else edit(target!, `Fixture edit ${index}`);
    });
  const elapsedMs = performance.now() - start;
  const result = {
    view,
    workload,
    edits: 30,
    elapsedMs,
    reactActualDurationMs: durations.reduce((s, n) => s + n, 0),
    updates,
    renderedComponents: { ...(window as any).viewRenderCounts },
    resultingValue: target?.value,
    nodes: document.querySelectorAll("[data-theory-node-id]").length,
    cards: document.querySelectorAll(".mystery-card,.book-club-maven-card").length,
  };
  await pause(20);
  return result;
};
const runFreshOverview = async () => {
  // Exercise explicit refreshes only; exclude background polling from counts.
  const schedule = window.setInterval;
  window.setInterval = (() => 0) as typeof window.setInterval;
  try {
    await mount("clubs");
  } finally {
    window.setInterval = schedule;
  }
  if (document.visibilityState !== "visible") throw new Error("Run with a visible browser tab");
  updates = 0;
  durations = [];
  (window as any).viewRenderCounts = {};
  const start = performance.now();
  for (let index = 0; index < 10; index++) {
    document.dispatchEvent(new Event("visibilitychange"));
    // Each HTTP fixture response clones its entire JSON document.
    // eslint-disable-next-line no-await-in-loop
    await pause(5);
    flushSync(() => {});
  }
  return {
    view: "clubs",
    workload: "fresh-json-refresh",
    refreshes: 10,
    elapsedMs: performance.now() - start,
    reactActualDurationMs: durations.reduce((sum, n) => sum + n, 0),
    renderedComponents: { ...(window as any).viewRenderCounts },
    requests: requests.filter((name) => name === "clubs").length,
  };
};
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
const checkContracts = async () => {
  const passed: string[] = [];
  const pending = api.getPendingPublishedMysteries;
  let rejectModeration!: (reason: Error) => void;
  expectedLibraryBooks = 24;
  api.getPendingPublishedMysteries = () =>
    new Promise((_, reject) => {
      rejectModeration = reject;
    });
  try {
    await mount("library");
    check(
      document.querySelectorAll(".library-book").length === 24,
      "Public books should render before unresolved moderation",
    );
    rejectModeration(new Error("Fixture moderation unavailable"));
    await pause(20);
    check(
      document.querySelectorAll(".library-book").length === 24,
      "Rejected moderation must retain public books",
    );
    passed.push("library parallel start and public success before slow/rejected moderation");
  } finally {
    api.getPendingPublishedMysteries = pending;
    expectedLibraryBooks = 25;
  }
  await mount("mysteries");
  const firstTitle = document.querySelector<HTMLTextAreaElement | HTMLInputElement>(
    ".mystery-card input",
  )!;
  flushSync(() => edit(firstTitle, "Edited location"));
  const mainTitle = document.querySelector<HTMLInputElement>(".mystery-editor-header input")!;
  flushSync(() => edit(mainTitle, "Renamed case"));
  check(firstTitle.value === "Edited location", "Header edits must retain child collection edits");
  const draft = JSON.parse(localStorage.getItem("cozycrowns-mystery-draft")!);
  check(
    draft.data.locations[0].title === "Edited location" && draft.title === "Renamed case",
    "Local draft must include both edits",
  );
  passed.push(
    "mystery collection edits survive header changes and synchronous local draft persistence",
  );
  const remove = document.querySelector<HTMLButtonElement>('button[title="Remove entry"]')!;
  const removeId = Object.entries(i18n.messages).find(
    ([, value]) => String(value) === "Remove entry",
  )?.[0];
  check(Boolean(removeId), "Compiled remove-entry message exists");
  await loadTranslations("de");
  // German currently has no translation for this entry; install a fixture translation.
  i18n.load("de", { ...i18n.messages, [removeId!]: "Fixture translated remove" });
  flushSync(() => i18n.activate("de"));
  check(
    remove.title === "Fixture translated remove" &&
      remove.getAttribute("aria-label") === "Fixture translated remove",
    "Cached collection remove buttons follow locale",
  );
  await loadTranslations("en");
  flushSync(() => i18n.activate("en"));
  passed.push("cached Mystery collection remove titles and aria labels update on locale change");
  for (const panel of ["mystery", "rolls", "characters", "settings", "notes", "clues"]) {
    // These panels share a root and must be mounted sequentially.
    // eslint-disable-next-line no-await-in-loop
    await mount("clubs", panel);
    check(
      document.querySelectorAll(".book-club-maven-card").length === 24,
      `Mavens retained with ${panel} panel`,
    );
    check(Boolean(document.querySelector(".book-club-drawer")), `Drawer mounted: ${panel}`);
  }
  passed.push("all six Book Club drawers mount with Maven cards preserved");
  await mount("maven");
  check(document.body.textContent?.includes("Read only"), "Shared Maven remains read only");
  passed.push("shared Maven read-only sheet");
  await mount("dark");
  const field = document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="First Void Clue"]',
  )!;
  flushSync(() => edit(field, "Persisted void clue"));
  const storage = JSON.parse(localStorage.getItem("cozycrowns-dark-conspiracy-storage")!);
  check(
    storage.state.current.firstVoidClue === "Persisted void clue",
    "Dark field stored before returning from event",
  );
  await mount("dark");
  check(
    document.querySelector<HTMLTextAreaElement>('textarea[aria-label="First Void Clue"]')?.value ===
      "Persisted void clue",
    "Dark field retains state after remount",
  );
  passed.push("Dark Conspiracy primitive edit persists and remounts");
  await mount("theory");
  const before = (document.querySelector(".theory-board__canvas > div") as HTMLElement).style
    .transform;
  flushSync(() =>
    document
      .querySelector(".theory-board__canvas")!
      .dispatchEvent(new WheelEvent("wheel", { deltaY: 20, bubbles: true, cancelable: true })),
  );
  const after = (document.querySelector(".theory-board__canvas > div") as HTMLElement).style
    .transform;
  check(
    before !== after && document.querySelectorAll("[data-theory-node-id]").length === 80,
    "Pan must update transform and retain notes",
  );
  const clueFilter = Array.from(document.querySelectorAll(".theory-filter")).find(
    (button) => button.textContent === "Clue",
  ) as HTMLButtonElement;
  flushSync(() => clueFilter.click());
  check(
    document.querySelectorAll("[data-theory-node-id]").length === 40,
    "Kind filters must invalidate cached scene",
  );
  passed.push("theory viewport transform and filter cache invalidation");
  return { passed, fixture: "faithful API fixtures; actual mounted production view source" };
};
const runPanelNavigation = async () => {
  flushSync(() => root.render(null));
  const previousSocket = window.WebSocket;
  let socketsOpened = 0;
  class FixtureSocket extends EventTarget {
    static OPEN = 1;
    readyState = 1;
    constructor() {
      super();
      socketsOpened++;
      queueMicrotask(() => this.dispatchEvent(new Event("open")));
    }
    send() {}
    close() {
      this.readyState = 3;
      this.dispatchEvent(new Event("close"));
    }
  }
  window.WebSocket = FixtureSocket as unknown as typeof WebSocket;
  api.getCurrentUser = respond("me", {
    id: "fixture-user",
    email: "fixture@example.invalid",
    firstName: "Fixture",
    lastName: "User",
    nickname: "Fixture",
    isSuperadmin: true,
  });
  tokenStorage.set("fixture-auth-only");
  const initialPath = location.pathname + location.search;
  history.replaceState({}, "", `/book-clubs/${club.id}`);
  requests = [];
  try {
    const App = (await import("@/App")).default;
    flushSync(() => root.render(<App />));
    await waitFor(() => document.querySelectorAll(".book-club-maven-card").length === 24);
    const initialRequests = requests.filter((name) => name === "clubs").length;
    for (const label of ["Mystery", "Rolls", "Characters", "Settings", "Notes", "Clues"]) {
      const button = document.querySelector<HTMLButtonElement>(
        `.book-club-drawer-rail button[aria-label="${label}"]`,
      )!;
      flushSync(() => button.click());
      // Settling each navigation is part of this lifecycle benchmark.
      // eslint-disable-next-line no-await-in-loop
      await pause(30);
      check(
        document.querySelectorAll(".book-club-maven-card").length === 24,
        "Route navigation retains club Mavens",
      );
    }
    return {
      initialRequests,
      totalClubRequests: requests.filter((name) => name === "clubs").length,
      socketsOpened,
      panels: 6,
      requests,
      path: location.pathname + location.search,
    };
  } finally {
    flushSync(() => root.render(null));
    window.WebSocket = previousSocket;
    tokenStorage.remove();
    history.replaceState({}, "", initialPath);
  }
};
Object.assign(window, {
  runFreshOverviewBenchmark: runFreshOverview,
  runPanelNavigationBenchmark: runPanelNavigation,
  checkViewContracts: checkContracts,
  mountViewBenchmark: mount,
  runViewBenchmark: run,
  benchmarkFixtures: { mystery, club, board },
});
document.body.dataset.ready = "true";
