export type TheoryPoint = { x: number; y: number };
type TheoryRectangle = TheoryPoint & { id: string };
type NodeSize = { width: number; height: number };

const centerOf = (node: TheoryPoint, size: NodeSize): TheoryPoint => ({
  x: node.x + size.width / 2,
  y: node.y + size.height / 2,
});

export const pointOnNodeEdge = (
  node: TheoryPoint,
  toward: TheoryPoint,
  size: NodeSize,
): TheoryPoint => {
  const center = centerOf(node, size);
  const deltaX = toward.x - center.x;
  const deltaY = toward.y - center.y;
  if (!deltaX && !deltaY) return center;
  const scale =
    1 / Math.max(Math.abs(deltaX) / (size.width / 2), Math.abs(deltaY) / (size.height / 2));
  return { x: center.x + deltaX * scale, y: center.y + deltaY * scale };
};

// Clip a parallel lane from an interior point to the full rectangular note.
const exitOnNodeEdge = (
  node: TheoryPoint,
  origin: TheoryPoint,
  direction: TheoryPoint,
  size: NodeSize,
): TheoryPoint => {
  const exitX = direction.x
    ? (node.x + (direction.x > 0 ? size.width : 0) - origin.x) / direction.x
    : Infinity;
  const exitY = direction.y
    ? (node.y + (direction.y > 0 ? size.height : 0) - origin.y) / direction.y
    : Infinity;
  const distance = Math.min(exitX, exitY);
  return { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance };
};

// Distances along a ray for which a point lies inside an axis-aligned rectangle.
const overlapInterval = (
  origin: TheoryPoint,
  direction: TheoryPoint,
  rectangle: TheoryPoint & NodeSize,
): [number, number] | null => {
  let entry = -Infinity;
  let exit = Infinity;
  for (const [axis, extent] of [
    ["x", "width"],
    ["y", "height"],
  ] as const) {
    if (!direction[axis]) {
      if (origin[axis] <= rectangle[axis] || origin[axis] >= rectangle[axis] + rectangle[extent]) {
        return null;
      }
      continue;
    }
    const first = (rectangle[axis] - origin[axis]) / direction[axis];
    const last = (rectangle[axis] + rectangle[extent] - origin[axis]) / direction[axis];
    entry = Math.max(entry, Math.min(first, last));
    exit = Math.min(exit, Math.max(first, last));
  }
  return entry < exit && exit > 0 ? [entry, exit] : null;
};

const reciprocalLabels = (
  first: TheoryPoint,
  second: TheoryPoint,
  normal: TheoryPoint,
  source: TheoryPoint,
  target: TheoryPoint,
  size: NodeSize,
): TheoryPoint => {
  // Match the label's 128px maximum width, with room for its height and a gap.
  // A narrow card gap cannot contain a whole label, so move both labels outward
  // without changing the close, straight arrow lanes.
  const halfWidth = 64;
  const halfHeight = 14;
  const gap = 4;
  const intervals: [number, number][] = [];
  for (const [point, sign] of [
    [first, 1],
    [second, -1],
  ] as const) {
    for (const node of [source, target]) {
      const interval = overlapInterval(
        point,
        { x: normal.x * sign, y: normal.y * sign },
        {
          x: node.x - halfWidth - gap,
          y: node.y - halfHeight - gap,
          width: size.width + 2 * (halfWidth + gap),
          height: size.height + 2 * (halfHeight + gap),
        },
      );
      if (interval) intervals.push(interval);
    }
  }
  const labelsOverlap = overlapInterval(
    { x: first.x - second.x, y: first.y - second.y },
    { x: 2 * normal.x, y: 2 * normal.y },
    {
      x: -2 * halfWidth - gap,
      y: -2 * halfHeight - gap,
      width: 4 * halfWidth + 2 * gap,
      height: 4 * halfHeight + 2 * gap,
    },
  );
  if (labelsOverlap) intervals.push(labelsOverlap);
  intervals.sort((a, b) => a[0] - b[0]);
  let offset = 0;
  for (const [entry, exit] of intervals) {
    if (entry <= offset && offset < exit) offset = exit;
  }
  return { x: first.x + normal.x * offset, y: first.y + normal.y * offset };
};

export const edgeGeometry = (
  source: TheoryRectangle,
  target: TheoryRectangle,
  size: NodeSize,
  reciprocal = false,
) => {
  const sourceCenter = centerOf(source, size);
  const targetCenter = centerOf(target, size);
  if (!reciprocal) {
    const start = pointOnNodeEdge(source, targetCenter, size);
    const end = pointOnNodeEdge(target, sourceCenter, size);
    return {
      start,
      end,
      control: null,
      path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
      midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    };
  }

  const deltaX = targetCenter.x - sourceCenter.x;
  const deltaY = targetCenter.y - sourceCenter.y;
  const distance = Math.hypot(deltaX, deltaY);
  // Reversing the direction reverses its normal and selects the other lane.
  // Stable IDs keep even coincident notes finite and their labels distinct.
  const direction = distance
    ? { x: deltaX / distance, y: deltaY / distance }
    : { x: source.id < target.id ? 1 : -1, y: 0 };
  const normal = { x: -direction.y, y: direction.x };
  const laneOffset = Math.min(16, size.width / 4, size.height / 4);
  const lane = (from: TheoryPoint, to: TheoryPoint, sign: number) => {
    const offset = { x: normal.x * laneOffset * sign, y: normal.y * laneOffset * sign };
    const laneDirection = { x: direction.x * sign, y: direction.y * sign };
    const start = exitOnNodeEdge(
      from,
      { x: from.x + size.width / 2 + offset.x, y: from.y + size.height / 2 + offset.y },
      laneDirection,
      size,
    );
    const end = exitOnNodeEdge(
      to,
      { x: to.x + size.width / 2 + offset.x, y: to.y + size.height / 2 + offset.y },
      { x: -laneDirection.x, y: -laneDirection.y },
      size,
    );
    return {
      start,
      end,
      label: { x: start.x + (end.x - start.x) * 0.35, y: start.y + (end.y - start.y) * 0.35 },
    };
  };
  const forward = lane(source, target, 1);
  const reverse = lane(target, source, -1);
  return {
    start: forward.start,
    end: forward.end,
    control: null,
    path: `M ${forward.start.x} ${forward.start.y} L ${forward.end.x} ${forward.end.y}`,
    midpoint: reciprocalLabels(forward.label, reverse.label, normal, source, target, size),
  };
};
