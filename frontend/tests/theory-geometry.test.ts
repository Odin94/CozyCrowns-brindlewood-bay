import { test } from "node:test";
import assert from "node:assert/strict";
import { edgeGeometry, pointOnNodeEdge, type TheoryPoint } from "../src/lib/theory_geometry.ts";

const size = { width: 286, height: 150 };
const source = { id: "a", x: 120, y: 180 };
const shift = (node: typeof source) => ({ ...node, x: node.x + 93, y: node.y - 42 });
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);
const inside = (point: TheoryPoint, node: TheoryPoint) =>
  point.x > node.x + 1e-8 &&
  point.x < node.x + size.width - 1e-8 &&
  point.y > node.y + 1e-8 &&
  point.y < node.y + size.height - 1e-8;
const onBorder = (point: TheoryPoint, node: TheoryPoint) => {
  assert.ok(point.x >= node.x - 1e-8 && point.x <= node.x + size.width + 1e-8);
  assert.ok(point.y >= node.y - 1e-8 && point.y <= node.y + size.height + 1e-8);
  assert.ok(
    Math.min(
      Math.abs(point.x - node.x),
      Math.abs(point.x - node.x - size.width),
      Math.abs(point.y - node.y),
      Math.abs(point.y - node.y - size.height),
    ) < 1e-8,
  );
};

for (const [name, deltaX, deltaY] of [
  ["horizontal", 600, 0],
  ["vertical", 0, 420],
  ["diagonal", 650, 360],
  ["steep diagonal", 330, 600],
  ["reverse diagonal", -650, 360],
  ["narrow horizontal gap", 300, 0],
  ["narrow vertical gap", 0, 160],
  ["narrow diagonal gap", -100, -160],
  ["narrow reverse diagonal gap", -80, 160],
] as const) {
  test(`reciprocal ${name} links have parallel straight paths and separate labels`, () => {
    const target = { id: "b", x: source.x + deltaX, y: source.y + deltaY };
    const forward = edgeGeometry(source, target, size, true);
    const reverse = edgeGeometry(target, source, size, true);
    assert.notEqual(forward.path, reverse.path);
    assert.ok(forward.path.includes(" L "));
    assert.ok(reverse.path.includes(" L "));
    assert.equal(forward.control, null);
    assert.equal(reverse.control, null);
    // The full 128px label boxes remain separate, including in tiny gaps.
    assert.ok(
      Math.abs(forward.midpoint.x - reverse.midpoint.x) >= 132 - 1e-8 ||
        Math.abs(forward.midpoint.y - reverse.midpoint.y) >= 32 - 1e-8,
    );
    // The arrow lanes are 16px to either side of the line between centers.
    const center = { x: source.x + size.width / 2, y: source.y + size.height / 2 };
    const side = (point: TheoryPoint) =>
      deltaX * (point.y - center.y) - deltaY * (point.x - center.x);
    assert.ok(side(forward.midpoint) > 0);
    assert.ok(side(reverse.midpoint) < 0);
    near(side(forward.midpoint), -side(reverse.midpoint));
    near(side(forward.start) / Math.hypot(deltaX, deltaY), 16);
    near(side(forward.end) / Math.hypot(deltaX, deltaY), 16);
    near(side(reverse.start) / Math.hypot(deltaX, deltaY), -16);
    near(side(reverse.end) / Math.hypot(deltaX, deltaY), -16);

    for (const [geometry, from, to] of [
      [forward, source, target],
      [reverse, target, source],
    ] as const) {
      onBorder(geometry.start, from);
      onBorder(geometry.end, to);
      for (const note of [from, to]) {
        const label = geometry.midpoint;
        assert.ok(
          label.x + 64 <= note.x - 4 + 1e-8 ||
            label.x - 64 >= note.x + size.width + 4 - 1e-8 ||
            label.y + 14 <= note.y - 4 + 1e-8 ||
            label.y - 14 >= note.y + size.height + 4 - 1e-8,
          "label rectangle should clear both notes",
        );
      }
      for (let sample = 1; sample < 100; sample += 1) {
        const t = sample / 100;
        const point = {
          x: geometry.start.x + (geometry.end.x - geometry.start.x) * t,
          y: geometry.start.y + (geometry.end.y - geometry.start.y) * t,
        };
        assert.equal(inside(point, from), false, `line enters its source at ${t}`);
        assert.equal(inside(point, to), false, `line enters its target at ${t}`);
      }
    }
  });
}

test("one-way connections retain their straight path and centered label", () => {
  const target = { id: "b", x: 720, y: 180 };
  const geometry = edgeGeometry(source, target, size);
  assert.equal(geometry.path, "M 406 255 L 720 255");
  assert.deepEqual(geometry.midpoint, { x: 563, y: 255 });
  assert.equal(geometry.control, null);
  const diagonal = { id: "b", x: 700, y: 600 };
  const result = edgeGeometry(source, diagonal, size);
  assert.deepEqual(result.start, pointOnNodeEdge(source, { x: 843, y: 675 }, size));
  assert.deepEqual(result.end, pointOnNodeEdge(diagonal, { x: 263, y: 255 }, size));
  assert.ok(result.path.includes(" L "));
});

test("moving both notes translates every connection coordinate with them", () => {
  const target = { id: "b", x: 720, y: 600 };
  const initial = edgeGeometry(source, target, size, true);
  const moved = edgeGeometry(shift(source), shift(target), size, true);
  for (const key of ["start", "end", "midpoint"] as const) {
    near(moved[key].x, initial[key].x + 93);
    near(moved[key].y, initial[key].y - 42);
  }
  const repositioned = edgeGeometry(source, { ...target, x: target.x + 200 }, size, true);
  assert.notEqual(repositioned.path, initial.path);
  assert.notDeepEqual(repositioned.midpoint, initial.midpoint);
});

test("coincident notes never produce non-finite paths or label positions", () => {
  const target = { ...source, id: "b" };
  for (const reciprocal of [false, true]) {
    const geometry = edgeGeometry(source, target, size, reciprocal);
    assert.ok(!/NaN|Infinity/.test(geometry.path));
    for (const point of [geometry.start, geometry.end, geometry.control, geometry.midpoint]) {
      if (!point) continue;
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    }
  }
  assert.notDeepEqual(
    edgeGeometry(source, target, size, true).midpoint,
    edgeGeometry(target, source, size, true).midpoint,
  );
});

test("reciprocal labels stagger along the two straight lanes when there is room", () => {
  const target = { id: "b", x: 720, y: 180 };
  const forward = edgeGeometry(source, target, size, true);
  const reverse = edgeGeometry(target, source, size, true);
  assert.equal(forward.path, "M 406 271 L 720 271");
  assert.equal(reverse.path, "M 720 239 L 406 239");
  near(forward.midpoint.x, 406 + (720 - 406) * 0.35);
  near(reverse.midpoint.x, 406 + (720 - 406) * 0.65);
  near(forward.midpoint.y, 271);
  near(reverse.midpoint.y, 239);
});
