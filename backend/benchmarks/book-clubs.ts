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
const fixture = mkdtempSync(join(tmpdir(), "cozycrowns-benchmark-"));
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
  const clubCount = Number(process.env.BENCHMARK_CLUBS ?? 20);
  const rollsPerClub = Number(process.env.BENCHMARK_ROLLS ?? 1000);
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
  const { bookClubRoutes } = await import(
    pathToFileURL(join(fixture, "src/routes/bookClubs.ts")).href
  );
  const { issueLocalSession } = await import(
    pathToFileURL(join(fixture, "src/utils/localAuth.ts")).href
  );
  await app.register(websocket);
  app.get("/benchmark-session", (request) => ({ token: issueLocalSession(request) }));
  await app.register(bookClubRoutes);
  const session = await app.inject({ url: "/benchmark-session", headers: { host: "localhost" } });
  const token = session.json().token;
  assert.ok(token);
  const request = {
    url: "/book-clubs",
    headers: { host: "localhost", authorization: `Bearer ${token}` },
  };
  const samples = [];
  let bytes = 0;
  for (let index = 0; index < 5 + Number(process.env.BENCHMARK_ITERATIONS ?? 30); index++) {
    const start = performance.now();
    const response = await app.inject(request);
    const elapsed = performance.now() - start;
    assert.equal(response.statusCode, 200, response.body);
    const { clubs } = response.json();
    assert.equal(clubs.length, clubCount);
    for (const club of clubs) {
      assert.equal(club.rolls.length, Math.min(30, rollsPerClub));
      assert.equal(club.rolls[0].id, `${club.id}-roll-${rollsPerClub - 1}`);
      assert.equal(club.members[7].characters.length, 0, "soft-deleted sheets stay hidden");
      assert.equal(club.activeMystery.clues.length, 30);
      assert.equal(club.mysteries[0].voidClues.length, 15);
    }
    bytes = Buffer.byteLength(response.body);
    if (index >= 5) samples.push(elapsed);
  }
  samples.sort((a, b) => a - b);
  console.log(
    JSON.stringify(
      {
        benchmark:
          "authenticated GET /book-clubs via Fastify.inject and disposable migrated SQLite",
        clubCount,
        rollsPerClub,
        medianMs: samples[Math.floor(samples.length / 2)],
        p95Ms: samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))],
        responseBytes: bytes,
        samplesMs: samples,
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
  sqlite.close();
  rmSync(fixture, { recursive: true, force: true });
}
