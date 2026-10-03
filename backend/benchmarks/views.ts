import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import {
  createDefaultCharacter,
  toPersistedCharacter,
} from "../../frontend/src/lib/character_document.ts";

// Import copied production routes so their hardcoded SQLite path always points
// at a disposable fixture. Never open the application's database.
const fixture = mkdtempSync(join(tmpdir(), "cozycrowns-page-benchmark-"));
if (process.env.BENCHMARK_REF) {
  const archive = execFileSync("git", ["archive", process.env.BENCHMARK_REF, "backend/src"], {
    cwd: resolve(".."),
    maxBuffer: 20 * 1024 * 1024,
  });
  execFileSync("tar", ["-x", "-C", fixture], { input: archive });
  cpSync(join(fixture, "backend/src"), join(fixture, "src"), { recursive: true });
} else {
  cpSync(resolve("src"), join(fixture, "src"), { recursive: true });
}
symlinkSync(resolve("node_modules"), join(fixture, "node_modules"), "dir");
writeFileSync(join(fixture, "package.json"), '{"type":"module"}');
Object.assign(process.env, {
  WORKOS_API_KEY: "benchmark-only",
  WORKOS_CLIENT_ID: "benchmark-only",
  WORKOS_COOKIE_PASSWORD: "benchmark-only-password-32-characters",
  NODE_ENV: "test",
  LOCAL_AUTH_ENABLED: "true",
  PUBLIC_POSTHOG_KEY: "",
});
const sqlite = new Database(join(fixture, "db.sqlite"));
const app = Fastify();
try {
  for (const migration of readdirSync(join(fixture, "src/db/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(join(fixture, "src/db/migrations", migration), "utf8"));
  }
  const clubCount = 3;
  const rollsPerClub = 100;
  const document = JSON.stringify(toPersistedCharacter(createDefaultCharacter()));
  const insertUser = sqlite.prepare("INSERT INTO users (id, email, nickname) VALUES (?, ?, ?)");
  const insertClub = sqlite.prepare("INSERT INTO book_clubs (id, name, owner_id) VALUES (?, ?, ?)");
  const insertMember = sqlite.prepare(
    "INSERT INTO book_club_members (book_club_id, user_id) VALUES (?, ?)",
  );
  const insertCharacter = sqlite.prepare(
    "INSERT INTO characters (id, user_id, name, data, deleted_at) VALUES (?, ?, ?, ?, ?)",
  );
  const assign = sqlite.prepare(
    "INSERT INTO book_club_character_assignments (book_club_id, character_id) VALUES (?, ?)",
  );
  const insertMystery = sqlite.prepare(
    "INSERT INTO book_club_mysteries (id, book_club_id, title, is_active) VALUES (?, ?, ?, ?)",
  );
  const insertClue = sqlite.prepare(
    "INSERT INTO book_club_clues (id, mystery_id, text, is_void) VALUES (?, ?, ?, ?)",
  );
  const insertRoll = sqlite.prepare(
    "INSERT INTO book_club_roll_events (id, book_club_id, user_id, character_name, label, dice, result, created_at) VALUES (?, ?, ?, 'Mavis', 'Reason', '2d6', '7', ?)",
  );
  sqlite.transaction(() => {
    for (let member = 0; member < 8; member++) {
      const id = member === 0 ? "local-development-user" : `member-${member}`;
      insertUser.run(id, `${id}@example.test`, `Maven${member}`);
    }
    for (let club = 0; club < clubCount; club++) {
      const clubId = `club-${club}`;
      insertClub.run(clubId, `Book club ${club}`, "local-development-user");
      for (let member = 0; member < 8; member++) {
        const id = member === 0 ? "local-development-user" : `member-${member}`;
        insertMember.run(clubId, id);
        const characterId = `${clubId}-character-${member}`;
        insertCharacter.run(characterId, id, `Maven${member}`, document, member === 7 ? 1 : null);
        assign.run(clubId, characterId);
      }
      for (let mystery = 0; mystery < 6; mystery++) {
        const mysteryId = `${clubId}-mystery-${mystery}`;
        insertMystery.run(mysteryId, clubId, `Mystery ${mystery}`, Number(mystery === 0));
        for (let clue = 0; clue < 30; clue++)
          insertClue.run(`${mysteryId}-clue-${clue}`, mysteryId, `Clue ${clue}`, clue % 2);
      }
      for (let roll = 0; roll < rollsPerClub; roll++)
        insertRoll.run(`${clubId}-roll-${roll}`, clubId, "local-development-user", roll + 1);
    }
  })();
  const entries = Array.from({ length: 20 }, (_, index) => ({
    id: `entry-${index}`,
    title: `Entry ${index}`,
    name: `Suspect ${index}`,
    description: "A detailed fixture description",
    prompt: "A fixture prompt",
    quote: "A fixture quote",
  }));
  const mysteryDocument = JSON.stringify({
    schemaVersion: 1,
    title: "Fixture case",
    intro: "Fixture introduction",
    complexity: 6,
    establishingQuestions: ["Who knew the victim?"],
    locations: entries,
    suspects: entries,
    clues: entries,
    voidClues: entries,
    moments: entries,
  });
  sqlite.prepare("UPDATE users SET is_superadmin = 1 WHERE id = 'local-development-user'").run();
  const privateMystery = sqlite.prepare(
    "INSERT INTO mysteries (id, user_id, title, data, deleted_at) VALUES (?, 'local-development-user', ?, ?, ?)",
  );
  const published = sqlite.prepare(
    "INSERT INTO published_mysteries (id, mystery_id, owner_id, title, data, source_version, status, approved_at) VALUES (?, ?, 'local-development-user', ?, ?, 1, ?, ?)",
  );
  for (let index = 0; index < 28; index++) {
    privateMystery.run(`private-${index}`, `Fixture case ${index}`, mysteryDocument, null);
    published.run(
      `published-${index}`,
      `private-${index}`,
      `Fixture case ${index}`,
      mysteryDocument,
      index < 24 ? "approved" : "pending",
      index < 24 ? 1 : null,
    );
  }
  privateMystery.run("deleted-private", "Hidden deleted case", mysteryDocument, 1);
  const dark = {
    schemaVersion: 1,
    title: "Fixture conspiracy",
    firstVoidClue: "An unsettling clue",
    childOfPersephone: "",
    connectedCharactersLayerOne: "",
    layerTwoChecks: Array(5).fill(false),
    returningCharacter: "",
    childRevisionLayerTwo: "",
    connectedCharactersLayerTwo: "",
    layerThreeChecks: Array(4).fill(false),
    leaderOfTheMidwives: "",
    midwivesGoalRevision: "",
    connectedCharactersLayerThree: "",
    servitors: "",
    finalChildRevision: "",
    mysteries: Array.from({ length: 6 }, () => ({ name: "", resolution: "" })),
  };
  sqlite
    .prepare(
      "INSERT INTO dark_conspiracies (id,user_id,title,data) VALUES ('fixture-dark','local-development-user','Fixture conspiracy',?)",
    )
    .run(JSON.stringify(dark));
  const { bookClubRoutes } = await import(
    pathToFileURL(join(fixture, "src/routes/bookClubs.ts")).href
  );
  const { issueLocalSession } = await import(
    pathToFileURL(join(fixture, "src/utils/localAuth.ts")).href
  );
  await app.register(websocket);
  app.get("/benchmark-session", (request) => ({ token: issueLocalSession(request) }));
  await app.register(bookClubRoutes);
  const { mysteryRoutes } = await import(
    pathToFileURL(join(fixture, "src/routes/mysteries.ts")).href
  );
  const { darkConspiracyRoutes } = await import(
    pathToFileURL(join(fixture, "src/routes/darkConspiracies.ts")).href
  );
  const { characterRoutes } = await import(
    pathToFileURL(join(fixture, "src/routes/characters.ts")).href
  );
  await app.register(mysteryRoutes);
  await app.register(darkConspiracyRoutes);
  await app.register(characterRoutes);
  if (process.env.BENCHMARK_SERVE) {
    const { authRoutes } = await import(pathToFileURL(join(fixture, "src/routes/auth.ts")).href);
    await app.register((await import("@fastify/cookie")).default, {
      secret: process.env.WORKOS_COOKIE_PASSWORD,
    });
    await app.register((await import("@fastify/cors")).default, {
      origin: ["http://127.0.0.1:5343", "http://127.0.0.1:5213"],
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    });
    await app.register(authRoutes);
    await app.listen({ port: Number(process.env.BENCHMARK_SERVE), host: "127.0.0.1" });
    console.log(
      `Disposable authenticated fixture ready at http://127.0.0.1:${process.env.BENCHMARK_SERVE}; database ${fixture}`,
    );
    await new Promise<void>((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  } else {
    const session = await app.inject({ url: "/benchmark-session", headers: { host: "localhost" } });
    const token = session.json().token;
    assert.ok(token);
    const headers = { host: "localhost", authorization: `Bearer ${token}` };
    const paths = [
      "/mysteries",
      "/library",
      ...(process.env.BENCHMARK_REF ? [] : ["/library?summary=true"]),
      "/superadmin/published-mysteries",
      "/dark-conspiracies",
      "/book-clubs",
      "/book-clubs/club-0/notes",
      "/book-clubs/club-0/mysteries/club-0-mystery-0/theorize",
    ];
    const results = [];
    for (const path of paths) {
      const samples: number[] = [];
      let bytes = 0;
      for (let index = 0; index < 35; index++) {
        const start = performance.now();
        const response = await app.inject({ url: path, headers });
        const elapsed = performance.now() - start;
        assert.equal(response.statusCode, 200, response.body);
        const result = response.json();
        if (path === "/mysteries") {
          assert.equal(result.mysteries.length, 28);
          assert.ok(!result.mysteries.some((m: { id: string }) => m.id === "deleted-private"));
        }
        if (path === "/library") assert.equal(result.mysteries.length, 24);
        if (path === "/library?summary=true") {
          assert.equal(result.mysteries.length, 24);
          assert.equal(result.mysteries[0].locationCount, 20);
          assert.equal(result.mysteries[0].suspectCount, 20);
          assert.equal(result.mysteries[0].data.intro, "Fixture introduction");
          assert.equal(result.mysteries[0].data.complexity, 6);
          assert.ok(!("clues" in result.mysteries[0].data));
        }
        if (path === "/superadmin/published-mysteries") assert.equal(result.mysteries.length, 4);
        if (path === "/dark-conspiracies") assert.equal(result.darkConspiracies.length, 1);
        if (path.endsWith("/theorize")) {
          assert.equal(result.nodes.length, 30);
          assert.equal(result.edges.length, 0);
          assert.equal(
            new Set(result.nodes.map((n: { sourceClueId: string }) => n.sourceClueId)).size,
            30,
          );
        }
        bytes = Buffer.byteLength(response.body);
        if (index >= 5) samples.push(elapsed);
      }
      samples.sort((a, b) => a - b);
      results.push({
        path,
        medianMs: samples[15],
        p95Ms: samples[28],
        responseBytes: bytes,
        samplesMs: samples,
      });
    }
    const forbidden = await app.inject({
      url: "/book-clubs/unknown/mysteries/club-0-mystery-0/theorize",
      headers,
    });
    assert.equal(forbidden.statusCode, 403);
    console.log(
      JSON.stringify(
        {
          benchmark:
            "authenticated Fastify.inject actual page read paths; migrated disposable SQLite; 28private/24approved/4pending100entry documents,3clubs,30clues/board,100rolls/club;5warmups30samples; " +
            (process.env.BENCHMARK_REF
              ? `historical backend ${process.env.BENCHMARK_REF}`
              : "working backend"),
          results,
        },
        null,
        2,
      ),
    );
  }
} finally {
  await app.close();
  sqlite.close();
  rmSync(fixture, { recursive: true, force: true });
}
