/** Shared case-file geometry. Coordinates are the API's integer top-left positions. */
export const THEORY_NOTE_WIDTH = 286;
export const THEORY_NOTE_HEIGHT = 150;
export const THEORY_NOTE_GAP = 24;
const MIN_COORDINATE = -10_000;
const MAX_COORDINATE = 10_000;

export type TheoryPoint = { x: number; y: number };
export type TheoryViewport = TheoryPoint & { width: number; height: number };
type PositionBounds = { minX: number; maxX: number; minY: number; maxY: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function theoryViewport(
  size: { width: number; height: number },
  pan: TheoryPoint,
  zoom: number,
): TheoryViewport {
  return {
    x: -pan.x / zoom,
    y: -pan.y / zoom,
    width: size.width / zoom,
    height: size.height / zoom,
  };
}

/** Find the closest legal top-left position without moving any existing note. */
function closestFreePosition(
  nodes: readonly TheoryPoint[],
  preferred: TheoryPoint,
  bounds: PositionBounds,
): TheoryPoint | null {
  if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) return null;
  const preferredX = clamp(Math.round(preferred.x), bounds.minX, bounds.maxX);
  const preferredY = clamp(Math.round(preferred.y), bounds.minY, bounds.maxY);
  // The nearest empty point lies at the preferred x or an obstacle/domain edge.
  const candidatesX = new Set([preferredX, bounds.minX, bounds.maxX]);
  for (const node of nodes) {
    candidatesX.add(
      clamp(Math.floor(node.x - THEORY_NOTE_WIDTH - THEORY_NOTE_GAP), bounds.minX, bounds.maxX),
    );
    candidatesX.add(
      clamp(Math.ceil(node.x + THEORY_NOTE_WIDTH + THEORY_NOTE_GAP), bounds.minX, bounds.maxX),
    );
  }
  let best: TheoryPoint | null = null;
  let bestDistance = Infinity;
  for (const x of [...candidatesX].sort(
    (a, b) => Math.abs(a - preferred.x) - Math.abs(b - preferred.x) || a - b,
  )) {
    if ((x - preferred.x) ** 2 > bestDistance) continue;
    const blocked = nodes
      .filter((node) => Math.abs(x - node.x) < THEORY_NOTE_WIDTH + THEORY_NOTE_GAP)
      .map((node) => ({
        min: node.y - THEORY_NOTE_HEIGHT - THEORY_NOTE_GAP,
        max: node.y + THEORY_NOTE_HEIGHT + THEORY_NOTE_GAP,
      }))
      .sort((a, b) => a.min - b.min);
    const merged: typeof blocked = [];
    for (const interval of blocked) {
      const previous = merged.at(-1);
      // Open intervals deliberately preserve a valid point where two edges touch.
      if (previous && interval.min < previous.max)
        previous.max = Math.max(previous.max, interval.max);
      else merged.push({ ...interval });
    }
    const candidatesY = new Set([preferredY, bounds.minY, bounds.maxY]);
    for (const interval of merged) {
      if (interval.min >= bounds.minY && interval.min <= bounds.maxY)
        candidatesY.add(Math.floor(interval.min));
      if (interval.max >= bounds.minY && interval.max <= bounds.maxY)
        candidatesY.add(Math.ceil(interval.max));
    }
    for (const y of candidatesY) {
      if (
        y < bounds.minY ||
        y > bounds.maxY ||
        merged.some((interval) => y > interval.min && y < interval.max)
      )
        continue;
      const distance = (x - preferred.x) ** 2 + (y - preferred.y) ** 2;
      if (
        distance < bestDistance ||
        (distance === bestDistance && best && (y < best.y || (y === best.y && x < best.x)))
      ) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }
  return best;
}

/** Prefer a fully visible empty spot, then the nearest empty spot in API bounds. */
export function findTheoryNotePlacement(
  nodes: readonly TheoryPoint[],
  preferred: TheoryPoint,
  viewport?: TheoryViewport,
): TheoryPoint | null {
  if (viewport) {
    const visible = closestFreePosition(nodes, preferred, {
      minX: Math.max(MIN_COORDINATE, Math.ceil(viewport.x)),
      maxX: Math.min(MAX_COORDINATE, Math.floor(viewport.x + viewport.width - THEORY_NOTE_WIDTH)),
      minY: Math.max(MIN_COORDINATE, Math.ceil(viewport.y)),
      maxY: Math.min(MAX_COORDINATE, Math.floor(viewport.y + viewport.height - THEORY_NOTE_HEIGHT)),
    });
    if (visible) return visible;
  }
  return closestFreePosition(nodes, preferred, {
    minX: MIN_COORDINATE,
    maxX: MAX_COORDINATE,
    minY: MIN_COORDINATE,
    maxY: MAX_COORDINATE,
  });
}

/** Reveal only the new note; preserve zoom and avoid panning an already visible note. */
export function panToRevealTheoryNote(
  note: TheoryPoint,
  size: { width: number; height: number },
  pan: TheoryPoint,
  zoom: number,
): TheoryPoint {
  const revealAxis = (
    position: number,
    dimension: number,
    viewportSize: number,
    offset: number,
  ) => {
    const start = position * zoom + offset;
    const length = dimension * zoom;
    if (length > viewportSize) return (viewportSize - length) / 2 - position * zoom;
    if (start < 0) return -position * zoom;
    if (start + length > viewportSize) return viewportSize - (position + dimension) * zoom;
    return offset;
  };
  return {
    x: revealAxis(note.x, THEORY_NOTE_WIDTH, size.width, pan.x),
    y: revealAxis(note.y, THEORY_NOTE_HEIGHT, size.height, pan.y),
  };
}

/** Fit complete note rectangles with a 32px gutter, including very spread-out boards. */
export function theoryOverview(
  notes: readonly TheoryPoint[],
  size: { width: number; height: number },
): { pan: TheoryPoint; zoom: number } {
  if (!notes.length) return { pan: { x: 48, y: 48 }, zoom: 1 };
  const minX = Math.min(...notes.map((note) => note.x));
  const maxX = Math.max(...notes.map((note) => note.x + THEORY_NOTE_WIDTH));
  const minY = Math.min(...notes.map((note) => note.y));
  const maxY = Math.max(...notes.map((note) => note.y + THEORY_NOTE_HEIGHT));
  const zoom = Math.min(
    1,
    Math.max(1, size.width - 64) / (maxX - minX),
    Math.max(1, size.height - 64) / (maxY - minY),
  );
  return {
    zoom,
    pan: {
      x: size.width / 2 - ((minX + maxX) / 2) * zoom,
      y: size.height / 2 - ((minY + maxY) / 2) * zoom,
    },
  };
}
