import assert from "node:assert/strict";
import { test } from "node:test";
import { theoryAlignmentUndoPositions } from "../src/lib/theory_alignment_undo.ts";

const before = [
  { id: "a", x: 10, y: 20, version: 2 },
  { id: "b", x: 300, y: 200, version: 3 },
];
const aligned = [
  { id: "a", x: 1000, y: 500, version: 3 },
  { id: "b", x: 1400, y: 500, version: 4 },
];
const owner = { accountId: "alice", generation: 7 };

test("undo restores previous coordinates with versions returned by successful alignment", () => {
  assert.deepEqual(theoryAlignmentUndoPositions(before, aligned, aligned, owner, owner), [
    { id: "a", x: 10, y: 20, version: 3 },
    { id: "b", x: 300, y: 200, version: 4 },
  ]);
});

test("undo cannot overwrite saved edits, unsaved drags, deletion, or newly added notes", () => {
  const changedCases = [
    [{ ...aligned[0], version: 4 }, aligned[1]],
    [{ ...aligned[0], x: 1200 }, aligned[1]],
    [aligned[0]],
    [...aligned, { id: "c", x: 2000, y: 500, version: 1 }],
  ];
  for (const current of changedCases)
    assert.equal(theoryAlignmentUndoPositions(before, aligned, current, owner, owner), null);
});

test("undo rejects account switches, reauthentication, logout, and revalidation", () => {
  for (const scope of [
    { accountId: "bob", generation: 7 },
    { accountId: "alice", generation: 8 },
    { accountId: null, generation: 7 },
    { ...owner, signingOut: true },
    { ...owner, revalidating: true },
  ])
    assert.equal(theoryAlignmentUndoPositions(before, aligned, aligned, owner, scope), null);
});
