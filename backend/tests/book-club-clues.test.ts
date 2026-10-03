import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";

test("prepared clues stay private until revealed and campaign notes survive authoring", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "cozycrowns-clues-"));
  process.env.NODE_ENV = "test";
  process.env.TEST_DATABASE_PATH = join(directory, "test.sqlite");
  process.env.WORKOS_API_KEY = "test-only-key";
  process.env.WORKOS_CLIENT_ID = "test-only-client";
  process.env.WORKOS_COOKIE_PASSWORD = "test-only-password-with-at-least-32-characters";
  const { db, schema } = await import("../src/db/index.js");
  migrate(db, { migrationsFolder: resolve("src/db/migrations") });
  const { workos } = await import("../src/config/workos.js");
  const originalSession = workos.userManagement.loadSealedSession;
  workos.userManagement.loadSealedSession = (({ sessionData }: { sessionData: string }) => ({
    authenticate: async () => ({
      authenticated: true,
      user: {
        id: sessionData,
        email: `${sessionData}@example.test`,
        firstName: null,
        lastName: null,
      },
    }),
  })) as typeof originalSession;
  const { bookClubRoutes } = await import("../src/routes/bookClubs.js");
  const { mysteryRoutes } = await import("../src/routes/mysteries.js");
  const { registerBookClubSocket } = await import("../src/realtime/bookClubUpdates.js");
  const app = Fastify();
  await app.register(websocket);
  await app.register(bookClubRoutes);
  await app.register(mysteryRoutes);
  const messages: string[] = [];
  const unregister = registerBookClubSocket("player", {
    readyState: 1,
    send: (message) => messages.push(message),
  });
  context.after(async () => {
    unregister?.();
    workos.userManagement.loadSealedSession = originalSession;
    await app.close();
    db.$client.close();
    rmSync(directory, { recursive: true, force: true });
  });
  db.insert(schema.users)
    .values([
      { id: "gm", email: "gm@example.test", nickname: "Keeper" },
      { id: "player", email: "player@example.test", nickname: "Maven" },
      { id: "outsider", email: "outsider@example.test", nickname: "Visitor" },
    ])
    .run();
  db.insert(schema.bookClubs).values({ id: "club", name: "Book club", ownerId: "gm" }).run();
  db.insert(schema.bookClubMembers)
    .values([
      { bookClubId: "club", userId: "gm", isGameMaster: true },
      { bookClubId: "club", userId: "player", isGameMaster: false },
    ])
    .run();
  const data = {
    schemaVersion: 1,
    title: "Case",
    intro: "Private setup",
    complexity: 6,
    establishingQuestions: [],
    locations: [],
    suspects: [],
    moments: [],
    clues: [{ id: "source", title: "Secret clue", description: "Private solution" }],
    voidClues: [{ id: "void-source", title: "Secret void", description: "Private void solution" }],
  };
  db.insert(schema.mysteries)
    .values({ id: "source-mystery", userId: "gm", title: "Case", data: JSON.stringify(data) })
    .run();
  db.insert(schema.bookClubMysteries)
    .values({
      id: "case",
      bookClubId: "club",
      sourceMysteryId: "source-mystery",
      title: "Case",
      isActive: true,
    })
    .run();
  db.insert(schema.bookClubClues)
    .values([
      { id: "prepared", mysteryId: "case", text: "Secret clue — Private solution", isVoid: false },
      {
        id: "prepared-void",
        mysteryId: "case",
        text: "Secret void — Private void solution",
        isVoid: true,
      },
    ])
    .run();
  // Legacy boards seeded prepared clues. Hide these without discarding their annotations or edges.
  db.insert(schema.bookClubTheoryNodes)
    .values([
      {
        id: "legacy",
        mysteryId: "case",
        sourceClueId: "prepared",
        kind: "clue",
        title: "Secret clue",
        description: "Private solution",
        x: 123,
        y: 456,
      },
      { id: "suspect", mysteryId: "case", kind: "suspect", title: "Mrs. Finch" },
    ])
    .run();
  db.insert(schema.bookClubTheoryEdges)
    .values({
      id: "connection",
      mysteryId: "case",
      sourceNodeId: "legacy",
      targetNodeId: "suspect",
      label: "Private connection",
    })
    .run();
  const request = (
    user: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    payload?: object,
  ) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${user}` },
      ...(payload ? { payload } : {}),
    });
  const base = "/book-clubs/club/mysteries/case";
  const board = `${base}/theorize`;

  await context.test("overview and boards do not disclose prepared clues", async () => {
    const gm = (await request("gm", "GET", "/book-clubs")).json();
    const player = (await request("player", "GET", "/book-clubs")).json();
    assert.equal(gm.clubs[0].activeMystery.clues.length, 2);
    assert.equal(player.clubs[0].activeMystery.clues.length, 0);
    assert.equal(player.clubs[0].mysteries[0].voidClues.length, 0);
    assert.equal(JSON.stringify(player).includes("Private solution"), false);
    for (const user of ["gm", "player"]) {
      const response = (await request(user, "GET", board)).json();
      assert.deepEqual(
        response.nodes.map((node: { id: string }) => node.id),
        ["suspect"],
      );
      assert.deepEqual(response.edges, []);
    }
    assert.equal((await request("outsider", "GET", board)).statusCode, 403);
    assert.equal(db.select().from(schema.bookClubTheoryNodes).all().length, 2);
  });

  await context.test("guessed hidden node and edge ids cannot be read or edited", async () => {
    const responses = await Promise.all([
      request("player", "PUT", `${board}/nodes/legacy/lock`),
      request("player", "DELETE", `${board}/nodes/legacy/lock`),
      request("player", "PUT", `${board}/nodes/legacy`, { version: 1, x: 500 }),
      request("player", "DELETE", `${board}/nodes/legacy`, { version: 1 }),
      request("player", "PUT", `${board}/nodes/positions`, {
        nodes: [{ id: "legacy", version: 1, x: 500, y: 500 }],
      }),
      request("player", "POST", `${board}/edges`, {
        sourceNodeId: "legacy",
        targetNodeId: "suspect",
      }),
      request("player", "PUT", `${board}/edges/connection`, { version: 1, label: "Guessed" }),
      request("player", "DELETE", `${board}/edges/connection`, { version: 1 }),
    ]);
    for (const response of responses) {
      assert.equal(response.statusCode, 404, response.body);
      assert.equal(response.body.includes("Secret"), false);
    }
    assert.equal(
      (await request("player", "PUT", `${base}/clues/prepared`, { checked: true })).statusCode,
      403,
    );
  });

  await context.test(
    "revealing custom text adds or updates a shared board node and broadcasts",
    async () => {
      const [reveal, ...duringReveal] = await Promise.all([
        request("gm", "PUT", `${base}/clues/prepared`, {
          checked: true,
          text: "Found envelope — Only the outside is visible",
        }),
        ...Array.from({ length: 12 }, () => request("player", "GET", board)),
      ]);
      assert.equal(reveal.statusCode, 200, reveal.body);
      assert.equal(reveal.body.includes("sourceText"), false);
      for (const snapshot of duringReveal)
        assert.equal(snapshot.body.includes("Private solution"), false);
      const response = (await request("player", "GET", board)).json();
      const clue = response.nodes.find((node: { id: string }) => node.id === "legacy");
      assert.equal(clue.title, "Found envelope");
      assert.equal(clue.description, "Only the outside is visible");
      assert.equal(clue.x, 123);
      assert.equal(clue.y, 456);
      assert.equal(response.edges.length, 1);
      assert(messages.some((message) => JSON.parse(message).type === "book-clubs-updated"));
      const overview = (await request("player", "GET", "/book-clubs")).json();
      assert.equal(overview.clubs[0].activeMystery.clues.length, 1);
      assert.equal(JSON.stringify(overview).includes("Private void solution"), false);
      const voidReveal = await request("gm", "PUT", `${base}/clues/prepared-void`, {
        checked: true,
      });
      assert.equal(voidReveal.statusCode, 200);
      const afterVoid = (await request("player", "GET", board)).json();
      assert(
        afterVoid.nodes.some(
          (node: { sourceClueId: string; kind: string }) =>
            node.sourceClueId === "prepared-void" && node.kind === "voidClue",
        ),
      );
    },
  );

  await context.test(
    "an unrelated authoring save matches a custom reveal's original source",
    async () => {
      const updated = await request("gm", "PUT", "/mysteries/source-mystery", {
        title: data.title,
        version: 1,
        saveKind: "auto",
        data: { ...data, intro: "An unrelated introduction edit" },
      });
      assert.equal(updated.statusCode, 200, updated.body);
      const campaignClues = db.select().from(schema.bookClubClues).all();
      assert.equal(campaignClues.length, 2);
      const custom = campaignClues.find((clue) => clue.id === "prepared");
      assert.equal(custom?.text, "Found envelope — Only the outside is visible");
      assert.equal(custom?.sourceText, "Secret clue — Private solution");
      for (const user of ["gm", "player"]) {
        const overviewResponse = await request(user, "GET", "/book-clubs");
        assert.equal(overviewResponse.body.includes("sourceText"), false);
        assert.equal(overviewResponse.body.includes("sourceEntryId"), false);
        assert.equal(overviewResponse.body.includes("Secret clue"), false);
        const boardResponse = await request(user, "GET", board);
        assert.equal(boardResponse.body.includes("Private solution"), false);
      }
    },
  );

  await context.test(
    "stable authored clue ids preserve found wording through source edits",
    async () => {
      const before = db
        .select()
        .from(schema.bookClubTheoryNodes)
        .where(eq(schema.bookClubTheoryNodes.id, "legacy"))
        .get();
      const edited = await request("gm", "PUT", "/mysteries/source-mystery", {
        title: data.title,
        version: 2,
        saveKind: "auto",
        data: {
          ...data,
          clues: [{ ...data.clues[0], description: "Private solution version two" }],
        },
      });
      assert.equal(edited.statusCode, 200, edited.body);
      const rows = db
        .select()
        .from(schema.bookClubClues)
        .where(eq(schema.bookClubClues.mysteryId, "case"))
        .all();
      assert.equal(rows.length, 2);
      const found = rows.find((clue) => clue.id === "prepared");
      assert.equal(found?.sourceEntryId, "source");
      assert.equal(found?.sourceText, "Secret clue — Private solution version two");
      assert.equal(found?.text, "Found envelope — Only the outside is visible");
      assert.deepEqual(
        db
          .select()
          .from(schema.bookClubTheoryNodes)
          .where(eq(schema.bookClubTheoryNodes.id, "legacy"))
          .get(),
        before,
      );
      for (const url of ["/book-clubs", board]) {
        const response = await request("player", "GET", url);
        assert.equal(response.body.includes("Private solution version two"), false);
        assert.equal(response.body.includes("sourceEntryId"), false);
      }
    },
  );

  await context.test("hiding and revealing retains notes, positions and edges", async () => {
    db.update(schema.bookClubTheoryNodes)
      .set({ description: "New player annotation", tags: '["evidence"]' })
      .where(eq(schema.bookClubTheoryNodes.id, "legacy"))
      .run();
    await request("gm", "PUT", `${base}/clues/prepared`, { checked: false });
    const hidden = (await request("player", "GET", board)).json();
    assert.equal(
      hidden.nodes.some((node: { id: string }) => node.id === "legacy"),
      false,
    );
    assert.equal(hidden.edges.length, 0);
    await request("gm", "PUT", `${base}/clues/prepared`, {
      checked: true,
      text: "Found envelope — Only the outside is visible",
    });
    const restored = (await request("player", "GET", board)).json();
    const node = restored.nodes.find((entry: { id: string }) => entry.id === "legacy");
    assert.equal(node.description, "New player annotation");
    assert.deepEqual(node.tags, ["evidence"]);
    assert.equal(restored.edges.length, 1);
  });

  await context.test(
    "mystery saves retain revealed custom campaign clues and the canvas",
    async () => {
      await request("gm", "PUT", `${base}/clues/prepared-void`, { checked: false });
      const updated = await request("gm", "PUT", "/mysteries/source-mystery", {
        title: "Revised case",
        version: 3,
        saveKind: "auto",
        data: {
          ...data,
          title: "Revised case",
          clues: [{ title: "Revised clue", description: "New private detail" }],
          voidClues: [],
        },
      });
      assert.equal(updated.statusCode, 200, updated.body);
      const response = (await request("player", "GET", board)).json();
      assert(
        response.nodes.some(
          (node: { id: string; description: string }) =>
            node.id === "legacy" && node.description === "New player annotation",
        ),
      );
      assert.equal(response.edges.length, 1);
      assert.equal(JSON.stringify(response).includes("New private detail"), false);
      assert(
        db
          .select()
          .from(schema.bookClubClues)
          .all()
          .some((clue) => clue.checked && clue.text.startsWith("Found envelope")),
      );
      const hiddenVoidClue = db
        .select()
        .from(schema.bookClubClues)
        .where(eq(schema.bookClubClues.id, "prepared-void"))
        .get();
      assert.equal(hiddenVoidClue?.checked, false);
      assert(
        db
          .select()
          .from(schema.bookClubTheoryNodes)
          .all()
          .some((node) => node.sourceClueId === "prepared-void"),
      );
    },
  );

  await context.test("manual additions are found clues with automatic board notes", async () => {
    const existingNodes = db.select().from(schema.bookClubTheoryNodes).all();
    const added = await request("gm", "POST", `${base}/clues`, {
      text: "Footprints — Beside the garden gate",
      isVoid: false,
    });
    assert.equal(added.statusCode, 200, added.body);
    const response = (await request("player", "GET", board)).json();
    assert(
      response.nodes.some(
        (node: { title: string; description: string }) =>
          node.title === "Footprints" && node.description === "Beside the garden gate",
      ),
    );
    const addedNode = response.nodes.find((node: { title: string }) => node.title === "Footprints");
    for (const node of existingNodes)
      assert(Math.abs(node.x - addedNode.x) >= 310 || Math.abs(node.y - addedNode.y) >= 174);
  });

  await context.test("linked clue descriptions support long revealed content", async () => {
    const locked = await request("player", "PUT", `${board}/nodes/legacy/lock`);
    assert.equal(locked.statusCode, 200, locked.body);
    const description = "Detailed evidence ".repeat(240);
    assert(description.length > 3000);
    const edited = await request("player", "PUT", `${board}/nodes/legacy`, {
      version: locked.json().version,
      description,
    });
    assert.equal(edited.statusCode, 200, edited.body);
    assert.equal(edited.json().description, description.trim());
  });

  await context.test(
    "legacy custom descriptions recover a unique unchanged source heading",
    async () => {
      const legacyData = {
        ...data,
        title: "Legacy case",
        clues: [{ title: "Legacy clue", description: "Original private description" }],
        voidClues: [],
      };
      db.insert(schema.mysteries)
        .values({
          id: "legacy-source",
          userId: "gm",
          title: legacyData.title,
          data: JSON.stringify(legacyData),
        })
        .run();
      db.insert(schema.bookClubMysteries)
        .values({
          id: "legacy-case",
          bookClubId: "club",
          sourceMysteryId: "legacy-source",
          title: legacyData.title,
        })
        .run();
      db.insert(schema.bookClubClues)
        .values({
          id: "legacy-custom",
          mysteryId: "legacy-case",
          text: "Legacy clue — Public custom description",
          checked: true,
        })
        .run();
      const saved = await request("gm", "PUT", "/mysteries/legacy-source", {
        title: legacyData.title,
        version: 1,
        saveKind: "auto",
        data: { ...legacyData, intro: "Unrelated change" },
      });
      assert.equal(saved.statusCode, 200, saved.body);
      const rows = db
        .select()
        .from(schema.bookClubClues)
        .where(eq(schema.bookClubClues.mysteryId, "legacy-case"))
        .all();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].sourceText, "Legacy clue — Original private description");
      const shared = await request(
        "player",
        "GET",
        "/book-clubs/club/mysteries/legacy-case/theorize",
      );
      assert.equal(shared.body.includes("Original private description"), false);
      assert.equal(shared.body.includes("sourceText"), false);
    },
  );

  await context.test(
    "bringing an owned mystery stores stable clue ids before custom reveals",
    async () => {
      const sourceData = {
        ...data,
        title: "Imported case",
        clues: [{ id: "import-entry", title: "Envelope", description: "Private import detail" }],
        voidClues: [],
      };
      db.insert(schema.mysteries)
        .values({
          id: "import-source",
          userId: "gm",
          title: sourceData.title,
          data: JSON.stringify(sourceData),
        })
        .run();
      const imported = await request("gm", "POST", "/book-clubs/club/mysteries", {
        sourceMysteryId: "import-source",
        name: sourceData.title,
        clues: ["Envelope — Private import detail"],
        voidClues: [],
      });
      assert.equal(imported.statusCode, 200, imported.body);
      assert.equal(imported.body.includes("sourceEntryId"), false);
      const campaign = db
        .select()
        .from(schema.bookClubMysteries)
        .where(eq(schema.bookClubMysteries.sourceMysteryId, "import-source"))
        .get()!;
      const initial = db
        .select()
        .from(schema.bookClubClues)
        .where(eq(schema.bookClubClues.mysteryId, campaign.id))
        .get()!;
      assert.equal(initial.sourceEntryId, "import-entry");
      await request("gm", "PUT", `/book-clubs/club/mysteries/${campaign.id}/clues/${initial.id}`, {
        checked: true,
        text: "Envelope — Only the outside is visible",
      });
      const saved = await request("gm", "PUT", "/mysteries/import-source", {
        title: sourceData.title,
        version: 1,
        saveKind: "auto",
        data: {
          ...sourceData,
          clues: [
            {
              ...sourceData.clues[0],
              title: "Renamed envelope",
              description: "Revised private import detail",
            },
          ],
        },
      });
      assert.equal(saved.statusCode, 200, saved.body);
      const rows = db
        .select()
        .from(schema.bookClubClues)
        .where(eq(schema.bookClubClues.mysteryId, campaign.id))
        .all();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].text, "Envelope — Only the outside is visible");
      const shared = await request(
        "player",
        "GET",
        `/book-clubs/club/mysteries/${campaign.id}/theorize`,
      );
      assert.equal(shared.body.includes("Revised private import detail"), false);
      assert.equal(shared.body.includes("sourceEntryId"), false);
    },
  );

  await context.test(
    "simultaneous manual board notes avoid all notes including hidden ones",
    async () => {
      const occupied = db
        .select()
        .from(schema.bookClubTheoryNodes)
        .where(eq(schema.bookClubTheoryNodes.mysteryId, "case"))
        .all();
      const hidden = occupied.find((node) => node.sourceClueId === "prepared-void")!;
      const responses = await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          request(index % 2 ? "gm" : "player", "POST", `${board}/nodes`, {
            title: `Concurrent note ${index}`,
            kind: "other",
            x: hidden.x,
            y: hidden.y,
          }),
        ),
      );
      for (const response of responses) {
        assert.equal(response.statusCode, 200, response.body);
        const node = response.json();
        for (const existing of occupied)
          assert(Math.abs(existing.x - node.x) >= 310 || Math.abs(existing.y - node.y) >= 174);
        occupied.push(node);
      }
    },
  );
});
