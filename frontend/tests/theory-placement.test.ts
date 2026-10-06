import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findTheoryNotePlacement,
  panToRevealTheoryNote,
  theoryViewport,
  theoryOverview,
  THEORY_NOTE_GAP,
  THEORY_NOTE_HEIGHT,
  THEORY_NOTE_WIDTH,
} from "../../backend/src/lib/theory-placement.ts";

type Point = { x: number; y: number };
const isFree = (point: Point, nodes: readonly Point[]) =>
  nodes.every(
    (node) =>
      Math.abs(point.x - node.x) >= THEORY_NOTE_WIDTH + THEORY_NOTE_GAP ||
      Math.abs(point.y - node.y) >= THEORY_NOTE_HEIGHT + THEORY_NOTE_GAP,
  );

test("an empty board places the note at the requested viewport center", () => {
  const view = theoryViewport({ width: 1000, height: 600 }, { x: -320, y: 90 }, 0.5);
  assert.deepEqual(view, { x: 640, y: -180, width: 2000, height: 1200 });
  const desired = {
    x: view.x + (view.width - THEORY_NOTE_WIDTH) / 2,
    y: view.y + (view.height - THEORY_NOTE_HEIGHT) / 2,
  };
  assert.deepEqual(findTheoryNotePlacement([], desired, view), desired);
});

test("occupied center uses the nearest free position and leaves existing coordinates unchanged", () => {
  const nodes = Object.freeze([Object.freeze({ x: 0, y: 0 })]);
  const result = findTheoryNotePlacement(nodes, { x: 0, y: 0 });
  assert.deepEqual(result, { x: 0, y: -174 });
  assert.deepEqual(nodes, [{ x: 0, y: 0 }]);
});

test("all nodes, including positions hidden by filters, block overlapping placement", () => {
  const nodes = [
    { x: 0, y: 0 },
    { x: 0, y: -174 },
    { x: 0, y: 174 },
    { x: -310, y: 0 },
  ];
  const result = findTheoryNotePlacement(nodes, { x: 0, y: 0 });
  assert.deepEqual(result, { x: 310, y: 0 });
  assert.ok(isFree(result!, nodes));
});

test("fully visible free space takes precedence over a nearer offscreen position", () => {
  const nodes = [{ x: 0, y: 0 }];
  const result = findTheoryNotePlacement(
    nodes,
    { x: 0, y: 0 },
    { x: 0, y: 0, width: 800, height: 400 },
  );
  assert.deepEqual(result, { x: 0, y: 174 });
  assert.ok(isFree(result!, nodes));
});

test("a full viewport falls back to nearest free space and pans only enough to reveal it", () => {
  const nodes = [{ x: 0, y: 0 }];
  const size = { width: 286, height: 150 };
  const result = findTheoryNotePlacement(
    nodes,
    { x: 0, y: 0 },
    theoryViewport(size, { x: 0, y: 0 }, 1),
  );
  assert.deepEqual(result, { x: 0, y: -174 });
  assert.deepEqual(panToRevealTheoryNote(result!, size, { x: 0, y: 0 }, 1), { x: 0, y: 174 });
  assert.deepEqual(
    panToRevealTheoryNote({ x: 100, y: 50 }, { width: 1000, height: 600 }, { x: 50, y: 30 }, 1.5),
    { x: 50, y: 30 },
  );
});

test("placement remains legal near API bounds even when the viewport is outside them", () => {
  const nodes = [{ x: 10000, y: 10000 }];
  const result = findTheoryNotePlacement(
    nodes,
    { x: 20000, y: 20000 },
    { x: 20000, y: 20000, width: 500, height: 500 },
  );
  assert.ok(result);
  assert.ok(result.x <= 10000 && result.x >= -10000 && result.y <= 10000 && result.y >= -10000);
  assert.ok(isFree(result, nodes));
});

test("successive additions in a dense board maintain the required gap", () => {
  const nodes: Point[] = [];
  for (let index = 0; index < 60; index += 1) {
    const result = findTheoryNotePlacement(
      nodes,
      { x: 3000, y: 2000 },
      { x: 2700, y: 1850, width: 1000, height: 600 },
    );
    assert.ok(result);
    assert.ok(isFree(result, nodes), `note ${index} must avoid every existing note`);
    nodes.push(result);
  }
});

test("Overview includes every complete note with padding even below the old minimum zoom", () => {
  const nodes = [
    { x: -10000, y: -10000 },
    { x: 10000, y: 10000 },
    { x: 300, y: 500 },
  ];
  const size = { width: 320, height: 400 };
  const { pan, zoom } = theoryOverview(nodes, size);
  assert.ok(zoom < 0.35);
  for (const node of nodes) {
    assert.ok(node.x * zoom + pan.x >= 32 - 0.00001);
    assert.ok(node.y * zoom + pan.y >= 32 - 0.00001);
    assert.ok((node.x + THEORY_NOTE_WIDTH) * zoom + pan.x <= size.width - 32 + 0.00001);
    assert.ok((node.y + THEORY_NOTE_HEIGHT) * zoom + pan.y <= size.height - 32 + 0.00001);
  }
});

test("Overview of an empty board preserves the normal initial camera", () => {
  assert.deepEqual(theoryOverview([], { width: 1000, height: 600 }), {
    pan: { x: 48, y: 48 },
    zoom: 1,
  });
});
