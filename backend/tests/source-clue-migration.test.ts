import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { reconcileSourceClues, sourceClues } from "../src/lib/sourceClues.ts";

test("additive source identity migration preserves a pre-existing duplicate clue graph", () => {
  const sqlite = new Database(":memory:");
  try {
    const migrationDir = resolve("src/db/migrations");
    const files = readdirSync(migrationDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files.filter((file) => !file.startsWith("0011_")))
      sqlite.exec(readFileSync(resolve(migrationDir, file), "utf8"));
    sqlite.pragma("foreign_keys = ON");
    sqlite.exec(
      "INSERT INTO users(id,email) VALUES('owner','owner@example.test'); INSERT INTO book_clubs(id,name,owner_id) VALUES('club','Club','owner'); INSERT INTO book_club_mysteries(id,book_club_id,title) VALUES('mystery','club','Mystery');",
    );
    sqlite
      .prepare("INSERT INTO book_club_clues(id,mystery_id,text,checked) VALUES(?,?,?,?)")
      .run("clueA", "mystery", "Letter — old", 1);
    sqlite
      .prepare("INSERT INTO book_club_clues(id,mystery_id,text,checked) VALUES(?,?,?,?)")
      .run("clueB", "mystery", "Letter — old", 0);
    sqlite.exec(
      "INSERT INTO book_club_theory_nodes(id,mystery_id,source_clue_id,kind,title,tags,x,y) VALUES('nodeA','mystery','clueA','clue','Letter','[\"important\"]',777,444),('nodeB','mystery','clueB','clue','Letter','[]',20,30); INSERT INTO book_club_theory_edges(id,mystery_id,source_node_id,target_node_id,label) VALUES('edge','mystery','nodeA','nodeB','signed by');",
    );
    sqlite.exec(
      readFileSync(resolve(migrationDir, files.find((file) => file.startsWith("0011_"))!), "utf8"),
    );
    const existing = sqlite
      .prepare(
        "SELECT id,text,is_void AS isVoid,source_clue_id AS sourceClueId FROM book_club_clues ORDER BY id",
      )
      .all() as Array<{ id: string; text: string; isVoid: number; sourceClueId: null }>;
    const old = sourceClues({
      clues: [
        { id: "sourceA", title: "Letter", description: "old" },
        { id: "sourceB", title: "Letter", description: "old" },
      ],
      voidClues: [],
    });
    const after = old.map((clue, index) => ({
      ...clue,
      text: index === 0 ? "Letter — corrected" : clue.text,
    }));
    const result = reconcileSourceClues(
      existing.map((clue) => ({ ...clue, isVoid: Boolean(clue.isVoid) })),
      old,
      after,
    );
    for (const clue of result.updates)
      sqlite
        .prepare("UPDATE book_club_clues SET text=?,source_clue_id=? WHERE id=?")
        .run(clue.text, clue.sourceClueId, clue.id);
    assert.deepEqual(sqlite.prepare("SELECT id,checked FROM book_club_clues ORDER BY id").all(), [
      { id: "clueA", checked: 1 },
      { id: "clueB", checked: 0 },
    ]);
    assert.deepEqual(
      sqlite.prepare("SELECT id,tags,x,y FROM book_club_theory_nodes WHERE id='nodeA'").get(),
      { id: "nodeA", tags: '["important"]', x: 777, y: 444 },
    );
    assert.deepEqual(sqlite.prepare("SELECT id,label FROM book_club_theory_edges").get(), {
      id: "edge",
      label: "signed by",
    });
    assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
  } finally {
    sqlite.close();
  }
});
