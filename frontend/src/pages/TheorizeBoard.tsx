import { accountScope } from "@/lib/account_scope";
import { reconcileCreatedEntry } from "@/lib/live_book_club";
import { theoryAlignmentUndoPositions } from "@/lib/theory_alignment_undo";
import { useLiveBookClub } from "@/hooks/useLiveBookClub";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { api, type TheoryEdge, type TheoryNode, type TheoryNodeKind } from "@/utils/api";
import {
  edgeGeometry as connectionGeometry,
  pointOnNodeEdge as rectangleEdgePoint,
} from "@/lib/theory_geometry";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
  ChevronLeft,
  Crosshair,
  Filter,
  Link2,
  Lock,
  Maximize,
  Plus,
  Tag,
  Trash2,
  UserRound,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  findTheoryNotePlacement,
  panToRevealTheoryNote,
  theoryViewport,
  theoryOverview,
  THEORY_NOTE_WIDTH,
  THEORY_NOTE_HEIGHT,
} from "../../../backend/src/lib/theory-placement";
import "./theorize-board.css";

const BOARD_WIDTH = 6_000;
const BOARD_HEIGHT = 4_000;
const NODE_WIDTH = THEORY_NOTE_WIDTH;
const NODE_HEIGHT = THEORY_NOTE_HEIGHT;
const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.005;
const MAX_ZOOM = 1.8;

const kindLabel = (kind: TheoryNodeKind) => {
  switch (kind) {
    case "clue":
      return t`Clue`;
    case "voidClue":
      return t`Void Clue`;
    case "suspect":
      return t`Suspect`;
    default:
      return t`Other`;
  }
};

const nodeTone: Record<TheoryNodeKind, string> = {
  clue: "theory-node--clue",
  voidClue: "theory-node--void-clue",
  suspect: "theory-node--suspect",
  other: "theory-node--other",
};

type EditNode = TheoryNode & { draftTitle: string; draftDescription: string; draftTags: string[] };

type Point = { x: number; y: number };

type ConnectionDraft =
  | { sourceId: string; mode: "pointer"; pointer: Point }
  | { sourceId: string; mode: "keyboard" };

const nodeSize = { width: NODE_WIDTH, height: NODE_HEIGHT };
const pointOnNodeEdge = (node: TheoryNode, toward: Point): Point =>
  rectangleEdgePoint(node, toward, nodeSize);

const edgeGeometry = (source: TheoryNode, target: TheoryNode, reciprocal = false) =>
  connectionGeometry(source, target, nodeSize, reciprocal);

const hash = (value: string) => {
  let result = 0;
  for (let index = 0; index < value.length; index += 1)
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  return result;
};

const autoLayout = (nodes: TheoryNode[], edges: TheoryEdge[]) => {
  if (nodes.length < 2) return new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y }]));

  const center = { x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 };
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const degree = nodes.map(() => 0);
  const linkedEdges = edges.flatMap((edge) => {
    const source = indexById.get(edge.sourceNodeId);
    const target = indexById.get(edge.targetNodeId);
    if (source === undefined || target === undefined) return [];
    degree[source] += 1;
    degree[target] += 1;
    return [{ source, target }];
  });
  const order: Array<{ node: TheoryNode; index: number }> = nodes.map((node, index) => ({
    node,
    index,
  }));
  order.sort(
    (left, right) =>
      degree[right.index] - degree[left.index] || left.node.id.localeCompare(right.node.id),
  );
  const kindAngles: Record<TheoryNodeKind, number> = {
    suspect: 0,
    other: Math.PI / 2,
    clue: Math.PI,
    voidClue: -Math.PI / 2,
  };
  const kindOffsets: Record<TheoryNodeKind, Point> = {
    suspect: { x: 460, y: 0 },
    other: { x: 0, y: 340 },
    clue: { x: -460, y: 0 },
    voidClue: { x: 0, y: -340 },
  };
  const kindCounts = new Map<TheoryNodeKind, number>();
  const positions = nodes.map(() => ({ ...center }));
  order.forEach(({ node, index }, rank) => {
    if (rank === 0) return;
    const kindIndex = kindCounts.get(node.kind) ?? 0;
    kindCounts.set(node.kind, kindIndex + 1);
    const jitter = ((hash(node.id) % 1_000) / 1_000 - 0.5) * 0.55;
    const angle = kindAngles[node.kind] + kindIndex * 2.399_963 + jitter;
    const radius = 190 + Math.sqrt(rank) * 150;
    positions[index] = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  });

  const velocities = nodes.map(() => ({ x: 0, y: 0 }));
  for (let iteration = 0; iteration < 300; iteration += 1) {
    const forces = nodes.map(() => ({ x: 0, y: 0 }));
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        let deltaX = positions[right].x - positions[left].x;
        let deltaY = positions[right].y - positions[left].y;
        let distance = Math.hypot(deltaX, deltaY);
        if (distance < 1) {
          deltaX = ((hash(nodes[left].id) % 17) - 8) / 8;
          deltaY = ((hash(nodes[right].id) % 17) - 8) / 8;
          distance = Math.max(1, Math.hypot(deltaX, deltaY));
        }
        if (distance > 950) continue;
        const strength = (950 - distance) * 0.0015 + 16_000 / (distance * distance);
        const forceX = (deltaX / distance) * strength;
        const forceY = (deltaY / distance) * strength;
        forces[left].x -= forceX;
        forces[left].y -= forceY;
        forces[right].x += forceX;
        forces[right].y += forceY;
      }
    }
    linkedEdges.forEach(({ source, target }) => {
      const deltaX = positions[target].x - positions[source].x;
      const deltaY = positions[target].y - positions[source].y;
      const distance = Math.max(1, Math.hypot(deltaX, deltaY));
      const strength = (distance - 360) * 0.008;
      const forceX = (deltaX / distance) * strength;
      const forceY = (deltaY / distance) * strength;
      forces[source].x += forceX;
      forces[source].y += forceY;
      forces[target].x -= forceX;
      forces[target].y -= forceY;
    });
    nodes.forEach((node, index) => {
      const importance = degree[index] / Math.max(1, linkedEdges.length);
      const centerStrength = 0.0018 + importance * 0.055;
      forces[index].x += (center.x - positions[index].x) * centerStrength;
      forces[index].y += (center.y - positions[index].y) * centerStrength;
      const typeAnchor = kindOffsets[node.kind];
      forces[index].x += (center.x + typeAnchor.x - positions[index].x) * 0.0012;
      forces[index].y += (center.y + typeAnchor.y - positions[index].y) * 0.0012;
      velocities[index].x = (velocities[index].x + forces[index].x) * 0.76;
      velocities[index].y = (velocities[index].y + forces[index].y) * 0.76;
      const speed = Math.hypot(velocities[index].x, velocities[index].y);
      if (speed > 20) {
        velocities[index].x = (velocities[index].x / speed) * 20;
        velocities[index].y = (velocities[index].y / speed) * 20;
      }
      positions[index].x += velocities[index].x;
      positions[index].y += velocities[index].y;
    });
  }

  for (let iteration = 0; iteration < 80; iteration += 1) {
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const deltaX = positions[right].x - positions[left].x;
        const deltaY = positions[right].y - positions[left].y;
        const overlapX = NODE_WIDTH + 52 - Math.abs(deltaX);
        const overlapY = NODE_HEIGHT + 52 - Math.abs(deltaY);
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (overlapX < overlapY) {
          const direction = deltaX === 0 ? (hash(nodes[left].id) % 2 ? 1 : -1) : Math.sign(deltaX);
          positions[left].x -= (overlapX / 2) * direction;
          positions[right].x += (overlapX / 2) * direction;
        } else {
          const direction = deltaY === 0 ? (hash(nodes[right].id) % 2 ? 1 : -1) : Math.sign(deltaY);
          positions[left].y -= (overlapY / 2) * direction;
          positions[right].y += (overlapY / 2) * direction;
        }
      }
    }
  }
  const hub = positions[order[0].index];
  const offset = { x: center.x - hub.x, y: center.y - hub.y };
  positions.forEach((position) => {
    position.x = Math.round(position.x + offset.x);
    position.y = Math.round(position.y + offset.y);
  });

  // Pairwise relaxation can leave collisions in dense graphs. Place each note
  // beyond any already placed rectangles it still intersects.
  const placed: Point[] = [];
  for (const { index } of order) {
    const position = positions[index];
    let collision: Point | undefined;
    while (
      (collision = placed.find(
        (other) =>
          Math.abs(other.x - position.x) < NODE_WIDTH + 52 &&
          Math.abs(other.y - position.y) < NODE_HEIGHT + 52,
      ))
    ) {
      position.y = collision.y + NODE_HEIGHT + 52;
    }
    placed.push(position);
  }

  return new Map(
    nodes.map((node, index) => [
      node.id,
      {
        x: Math.round(positions[index].x - NODE_WIDTH / 2),
        y: Math.round(positions[index].y - NODE_HEIGHT / 2),
      },
    ]),
  );
};

export default function TheorizeBoard({
  bookClubId,
  mysteryId,
  onClose,
}: {
  bookClubId: string;
  mysteryId: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLElement>(null);
  const newTitleRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const {
    data: board,
    loading,
    error: loadError,
    live,
  } = useLiveBookClub(
    `${bookClubId}:${mysteryId}`,
    { mystery: { id: mysteryId, title: "" }, nodes: [] as TheoryNode[], edges: [] as TheoryEdge[] },
    () => api.getBookClubTheory(bookClubId, mysteryId),
    (error) =>
      toast.error(error instanceof Error ? error.message : t`Could not load the theory board`),
    user?.id,
  );
  const mysteryTitle = board.mystery.title;
  const { nodes, edges } = board;
  const setNodes = useCallback(
    (update: TheoryNode[] | ((current: TheoryNode[]) => TheoryNode[])) =>
      live.edit((current) => ({
        ...current,
        nodes: typeof update === "function" ? update(current.nodes) : update,
      })),
    [live],
  );
  const setEdges = useCallback(
    (update: TheoryEdge[] | ((current: TheoryEdge[]) => TheoryEdge[])) =>
      live.edit((current) => ({
        ...current,
        edges: typeof update === "function" ? update(current.edges) : update,
      })),
    [live],
  );
  const { i18n } = useLingui();
  const [filters, setFilters] = useState<Record<TheoryNodeKind, boolean>>({
    clue: true,
    voidClue: true,
    suspect: true,
    other: true,
  });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 48, y: 48 });
  const [drag, setDrag] = useState<
    | { type: "node"; node: TheoryNode; clientX: number; clientY: number; x: number; y: number }
    | { type: "pan"; clientX: number; clientY: number; x: number; y: number }
    | null
  >(null);
  const [connecting, setConnecting] = useState<ConnectionDraft | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [descriptionNodeId, setDescriptionNodeId] = useState<string | null>(null);
  const [aligning, setAligning] = useState(false);
  const aligningRef = useRef(false);
  const [creating, setCreating] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const savingNoteRef = useRef(false);
  const [newKind, setNewKind] = useState<TheoryNodeKind>("clue");
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [editing, setEditing] = useState<EditNode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const [inlineEdge, setInlineEdge] = useState<TheoryEdge | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const contextRef = useRef({ live, bookClubId, mysteryId });
  contextRef.current = { live, bookClubId, mysteryId };
  const interactionRef = useRef({ drag, editing, creating });
  interactionRef.current = { drag, editing, creating };
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const initialCameraRef = useRef<typeof live | null>(null);
  zoomRef.current = zoom;
  panRef.current = pan;

  useEffect(() => {
    if (initialCameraRef.current === live || loading || loadError) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    const view = theoryOverview(nodes, bounds);
    initialCameraRef.current = live;
    zoomRef.current = view.zoom;
    panRef.current = view.pan;
    setZoom(view.zoom);
    setPan(view.pan);
    setFilters({ clue: true, voidClue: true, suspect: true, other: true });
  }, [live, loading, loadError, nodes]);

  const chooseNewKind = (kind: TheoryNodeKind) => {
    setNewKind(kind);
    setTypeMenuOpen(false);
    newTitleRef.current?.focus();
    newTitleRef.current?.select();
  };

  const openNewNote = useCallback(() => {
    setNewKind("clue");
    setCreating(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "n" ||
        aligningRef.current ||
        creating ||
        editing ||
        inlineEdge ||
        connecting ||
        drag ||
        document.querySelector('[role="dialog"], [role="alertdialog"]') ||
        (event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
          ))
      )
        return;
      event.preventDefault();
      openNewNote();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [creating, editing, inlineEdge, connecting, drag, openNewNote]);

  const refresh = useCallback((quiet = false) => live.refresh(quiet), [live]);
  useEffect(() => {
    if (drag?.type === "node") return live.hold();
  }, [live, drag?.type]);

  const clientToBoard = useCallback((clientX: number, clientY: number): Point => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    return {
      x: (clientX - (bounds?.left ?? 0) - panRef.current.x) / zoomRef.current,
      y: (clientY - (bounds?.top ?? 0) - panRef.current.y) / zoomRef.current,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
      if (!event.ctrlKey && !event.metaKey) {
        const currentPan = panRef.current;
        const nextPan = {
          x: currentPan.x - event.deltaX * deltaScale,
          y: currentPan.y - event.deltaY * deltaScale,
        };
        panRef.current = nextPan;
        setPan(nextPan);
        return;
      }
      const bounds = canvas.getBoundingClientRect();
      const pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      const currentZoom = zoomRef.current;
      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, currentZoom * Math.exp(-event.deltaY * 0.0015)),
      );
      if (nextZoom === currentZoom) return;
      const currentPan = panRef.current;
      const nextPan = {
        x: pointer.x - ((pointer.x - currentPan.x) * nextZoom) / currentZoom,
        y: pointer.y - ((pointer.y - currentPan.y) * nextZoom) / currentZoom,
      };
      zoomRef.current = nextZoom;
      panRef.current = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
    };
    let pinch: { distance: number; zoom: number; boardPoint: Point } | undefined;
    const touchDistance = (event: TouchEvent) =>
      Math.hypot(
        event.touches[1].clientX - event.touches[0].clientX,
        event.touches[1].clientY - event.touches[0].clientY,
      );
    const touchMidpoint = (event: TouchEvent) => {
      const bounds = canvas.getBoundingClientRect();
      return {
        x: (event.touches[0].clientX + event.touches[1].clientX) / 2 - bounds.left,
        y: (event.touches[0].clientY + event.touches[1].clientY) / 2 - bounds.top,
      };
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      setDrag(null);
      const midpoint = touchMidpoint(event);
      pinch = {
        distance: touchDistance(event),
        zoom: zoomRef.current,
        boardPoint: {
          x: (midpoint.x - panRef.current.x) / zoomRef.current,
          y: (midpoint.y - panRef.current.y) / zoomRef.current,
        },
      };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const midpoint = touchMidpoint(event);
      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, pinch.zoom * (touchDistance(event) / pinch.distance)),
      );
      const nextPan = {
        x: midpoint.x - pinch.boardPoint.x * nextZoom,
        y: midpoint.y - pinch.boardPoint.y * nextZoom,
      };
      zoomRef.current = nextZoom;
      panRef.current = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinch = undefined;
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      if (drag.type === "pan") {
        setPan({
          x: drag.x + event.clientX - drag.clientX,
          y: drag.y + event.clientY - drag.clientY,
        });
        return;
      }
      const x = Math.round(drag.x + (event.clientX - drag.clientX) / zoom);
      const y = Math.round(drag.y + (event.clientY - drag.clientY) / zoom);
      setNodes((current) =>
        current.map((node) => (node.id === drag.node.id ? { ...node, x, y } : node)),
      );
    };
    const onUp = (event: PointerEvent) => {
      if (drag.type === "node") {
        const x = Math.round(drag.x + (event.clientX - drag.clientX) / zoom);
        const y = Math.round(drag.y + (event.clientY - drag.clientY) / zoom);
        const releaseLive = live.hold();
        void (async () => {
          try {
            const updated = await api.updateBookClubTheoryNode(
              bookClubId,
              mysteryId,
              drag.node.id,
              {
                version: drag.node.version,
                x,
                y,
              },
            );
            setNodes((current) => current.map((node) => (node.id === updated.id ? updated : node)));
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t`Could not move that note`);
            void refresh(true);
          } finally {
            releaseLive();
          }
        })();
      }
      setDrag(null);
    };
    const onCancel = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onCancel, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [bookClubId, drag, mysteryId, refresh, zoom, setNodes, live]);

  const editingNodeId = editing?.id;

  useEffect(() => {
    if (!editingNodeId) return;
    const heartbeat = window.setInterval(() => {
      void api.lockBookClubTheoryNode(bookClubId, mysteryId, editingNodeId).catch(() => undefined);
    }, 25_000);
    return () => {
      window.clearInterval(heartbeat);
      void api.releaseBookClubTheoryNode(bookClubId, mysteryId, editingNodeId);
    };
  }, [bookClubId, editingNodeId, mysteryId]);

  const visibleNodes = useMemo(() => nodes.filter((node) => filters[node.kind]), [filters, nodes]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const edgeDirections = useMemo(
    () => new Set(edges.map((edge) => JSON.stringify([edge.sourceNodeId, edge.targetNodeId]))),
    [edges],
  );
  const isReciprocal = (edge: TheoryEdge) =>
    edge.sourceNodeId !== edge.targetNodeId &&
    edgeDirections.has(JSON.stringify([edge.targetNodeId, edge.sourceNodeId]));
  const existingTags = useMemo(() => [...new Set(nodes.flatMap((node) => node.tags))], [nodes]);

  const centerViewport = useCallback((candidates: TheoryNode[]) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const view = theoryOverview(candidates, bounds);
    zoomRef.current = view.zoom;
    panRef.current = view.pan;
    setZoom(view.zoom);
    setPan(view.pan);
  }, []);

  const overview = () => {
    setFilters({ clue: true, voidClue: true, suspect: true, other: true });
    centerViewport(nodes);
  };

  const alignBoard = async () => {
    if (nodes.length < 2 || aligningRef.current) return;
    const owner = accountScope.current();
    const original = nodes.map((node) => ({ ...node }));
    const originalView = { pan: { ...panRef.current }, zoom: zoomRef.current };
    const currentContext = () =>
      mountedRef.current &&
      contextRef.current.live === live &&
      contextRef.current.bookClubId === bookClubId &&
      contextRef.current.mysteryId === mysteryId;
    const sameAccount = () => {
      const current = accountScope.current();
      return (
        current.accountId === owner.accountId &&
        current.generation === owner.generation &&
        !current.signingOut &&
        !current.revalidating
      );
    };
    const refreshAction = {
      label: t`Refresh board`,
      onClick: () => {
        if (currentContext() && sameAccount()) void live.refresh(false);
      },
    };
    aligningRef.current = true;
    setAligning(true);
    const releaseLive = live.hold();
    const layout = autoLayout(nodes, edges);
    const arranged = nodes.map((node) => ({ ...node, ...layout.get(node.id)! }));
    setNodes(arranged);
    centerViewport(arranged);
    try {
      const result = await api.updateBookClubTheoryNodePositions(
        bookClubId,
        mysteryId,
        arranged.map(({ id, version, x, y }) => ({ id, version, x, y })),
      );
      if (!currentContext() || !sameAccount()) return;
      const positions = new Map(result.nodes.map((node) => [node.id, node]));
      const updated = arranged.map((node) => Object.assign({}, node, positions.get(node.id)!));
      nodesRef.current = updated;
      setNodes(updated);
      centerViewport(updated);
      const arrangedView = { pan: { ...panRef.current }, zoom: zoomRef.current };
      let undone = false;
      toast.success(t`Notes aligned`, {
        duration: 8_000,
        action: {
          label: t`Undo`,
          onClick: () => {
            if (undone || !currentContext()) return;
            const interaction = interactionRef.current;
            const plan = theoryAlignmentUndoPositions(
              original,
              updated,
              nodesRef.current,
              owner,
              accountScope.current(),
            );
            if (
              !plan ||
              aligningRef.current ||
              interaction.drag ||
              interaction.editing ||
              interaction.creating ||
              savingNoteRef.current
            ) {
              toast.error(t`The board changed after auto-align. Your newer changes were kept.`, {
                action: refreshAction,
              });
              return;
            }
            undone = true;
            aligningRef.current = true;
            setAligning(true);
            const releaseUndo = live.hold();
            void (async () => {
              try {
                const restored = await api.updateBookClubTheoryNodePositions(
                  bookClubId,
                  mysteryId,
                  plan,
                );
                if (!currentContext() || !sameAccount()) return;
                const restoredById = new Map(restored.nodes.map((node) => [node.id, node]));
                setNodes((current) =>
                  current.map((node) => ({ ...node, ...restoredById.get(node.id) })),
                );
                // Restore the camera only while it still shows the aligned arrangement.
                if (
                  panRef.current.x === arrangedView.pan.x &&
                  panRef.current.y === arrangedView.pan.y &&
                  zoomRef.current === arrangedView.zoom
                ) {
                  panRef.current = originalView.pan;
                  zoomRef.current = originalView.zoom;
                  setPan(originalView.pan);
                  setZoom(originalView.zoom);
                }
                toast.success(t`Previous positions restored`);
              } catch {
                if (currentContext() && sameAccount())
                  toast.error(t`Could not undo auto-align. Refresh the board and try again.`, {
                    action: refreshAction,
                  });
              } finally {
                releaseUndo();
                aligningRef.current = false;
                if (currentContext()) setAligning(false);
              }
            })();
          },
        },
      });
    } catch (error) {
      if (currentContext() && sameAccount()) {
        toast.error(error instanceof Error ? error.message : t`Could not auto-align the board`);
        releaseLive();
        await refresh(true);
      }
    } finally {
      releaseLive();
      aligningRef.current = false;
      if (currentContext()) setAligning(false);
    }
  };

  const startConnection = useCallback(
    (event: React.PointerEvent, sourceId: string) => {
      if (event.button !== 0 || aligningRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      setConnecting({
        sourceId,
        mode: "pointer",
        pointer: clientToBoard(event.clientX, event.clientY),
      });
    },
    [clientToBoard],
  );

  const createConnection = useCallback(
    (sourceId: string, targetId: string) => {
      void (async () => {
        try {
          const edge = await api.createBookClubTheoryEdge(bookClubId, mysteryId, {
            sourceNodeId: sourceId,
            targetNodeId: targetId,
          });
          setEdges((current) => reconcileCreatedEntry(current, edge));
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t`Could not connect those notes`);
        }
      })();
    },
    [bookClubId, mysteryId, setEdges],
  );

  const connectingSourceId = connecting?.mode === "pointer" ? connecting.sourceId : null;
  useEffect(() => {
    if (!connectingSourceId) return;
    const onMove = (event: PointerEvent) => {
      const pointer = clientToBoard(event.clientX, event.clientY);
      setConnecting((current) => (current?.mode === "pointer" ? { ...current, pointer } : current));
    };
    const onUp = (event: PointerEvent) => {
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const targetId = element?.closest<HTMLElement>("[data-theory-node-id]")?.dataset.theoryNodeId;
      setConnecting(null);
      if (targetId && targetId !== connectingSourceId)
        createConnection(connectingSourceId, targetId);
    };
    const onCancel = () => setConnecting(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onCancel, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [clientToBoard, connectingSourceId, createConnection]);

  const connectionMode = connecting?.mode;
  useEffect(() => {
    if (!connectionMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConnecting(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [connectionMode]);

  const openEdit = useCallback(
    async (node: TheoryNode) => {
      try {
        const locked = await api.lockBookClubTheoryNode(bookClubId, mysteryId, node.id);
        setEditing({
          ...locked,
          draftTitle: locked.title,
          draftDescription: locked.description,
          draftTags: locked.tags,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t`This note is currently locked`);
        void refresh(true);
      }
    },
    [bookClubId, mysteryId, refresh],
  );

  const closeEdit = () => {
    setConfirmDelete(false);
    setEditing(null);
  };

  const saveEdit = async () => {
    if (!editing || (!editing.sourceClueId && !editing.draftTitle.trim()) || savingNoteRef.current)
      return;
    savingNoteRef.current = true;
    setSavingNote(true);
    try {
      const updated = await api.updateBookClubTheoryNode(bookClubId, mysteryId, editing.id, {
        version: editing.version,
        ...(editing.sourceClueId ? {} : { title: editing.draftTitle.trim() }),
        description: editing.draftDescription.trim(),
        tags: editing.draftTags,
      });
      setNodes((current) => current.map((node) => (node.id === updated.id ? updated : node)));
      closeEdit();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not save that note`);
      void refresh(true);
    } finally {
      savingNoteRef.current = false;
      setSavingNote(false);
    }
  };

  const deleteNode = async () => {
    if (!editing || editing.sourceClueId || savingNoteRef.current) return;
    savingNoteRef.current = true;
    setSavingNote(true);
    const scope = accountScope.current();
    const context = contextRef.current;
    const currentContext = () =>
      mountedRef.current &&
      contextRef.current.live === context.live &&
      accountScope.current().generation === scope.generation;
    const releaseLive = live.hold();
    try {
      await api.deleteBookClubTheoryNode(bookClubId, mysteryId, editing.id, editing.version);
      if (!currentContext()) return;
      setNodes((current) => current.filter((node) => node.id !== editing.id));
      setEdges((current) =>
        current.filter(
          (edge) => edge.sourceNodeId !== editing.id && edge.targetNodeId !== editing.id,
        ),
      );
      closeEdit();
    } catch (error) {
      if (currentContext())
        toast.error(error instanceof Error ? error.message : t`Could not delete that note`);
    } finally {
      releaseLive();
      savingNoteRef.current = false;
      if (currentContext()) setSavingNote(false);
    }
  };

  const createNode = async () => {
    if (!newTitle.trim() || savingNoteRef.current) return;
    savingNoteRef.current = true;
    setSavingNote(true);
    try {
      const bounds = canvasRef.current?.getBoundingClientRect();
      const viewport = bounds ? theoryViewport(bounds, panRef.current, zoomRef.current) : undefined;
      const preferred = viewport
        ? {
            x: viewport.x + (viewport.width - NODE_WIDTH) / 2,
            y: viewport.y + (viewport.height - NODE_HEIGHT) / 2,
          }
        : { x: 220, y: 180 };
      const position = findTheoryNotePlacement(nodes, preferred, viewport);
      if (!position) throw new Error(t`The board is full. Move a note before adding another.`);
      const node = await api.createBookClubTheoryNode(bookClubId, mysteryId, {
        kind: newKind,
        title: newTitle.trim(),
        description: newDescription.trim(),
        tags: newTags,
        ...position,
      });
      setNodes((current) => reconcileCreatedEntry(current, node));
      setFilters((current) => ({ ...current, [node.kind]: true }));
      if (bounds) {
        const nextPan = panToRevealTheoryNote(node, bounds, panRef.current, zoomRef.current);
        panRef.current = nextPan;
        setPan(nextPan);
      }
      setNewTitle("");
      setNewDescription("");
      setNewTags([]);
      setNewKind("clue");
      setCreating(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not add that note`);
    } finally {
      savingNoteRef.current = false;
      setSavingNote(false);
    }
  };

  const submitNoteShortcut = (event: React.KeyboardEvent) => {
    if (
      creating &&
      !event.defaultPrevented &&
      !event.nativeEvent.isComposing &&
      !event.repeat &&
      event.altKey &&
      event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const kindIndex = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(event.code);
      if (kindIndex !== -1) {
        event.preventDefault();
        event.stopPropagation();
        chooseNewKind((["clue", "voidClue", "suspect", "other"] as const)[kindIndex]);
        return;
      }
    }
    if (
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.repeat ||
      event.key !== "Enter" ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey ||
      event.shiftKey
    )
      return;
    event.preventDefault();
    if (creating) void createNode();
    else if (editing) void saveEdit();
  };

  const saveEdgeLabel = useCallback(async () => {
    if (!inlineEdge) return;
    try {
      const updated = await api.updateBookClubTheoryEdge(bookClubId, mysteryId, inlineEdge.id, {
        version: inlineEdge.version,
        label: inlineEdge.label,
      });
      setEdges((current) => current.map((edge) => (edge.id === updated.id ? updated : edge)));
      setInlineEdge(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not rename that connection`);
      void refresh(true);
    }
  }, [bookClubId, mysteryId, inlineEdge, refresh, setEdges]);

  const deleteEdge = useCallback(async () => {
    if (!inlineEdge) return;
    const deletedEdge = inlineEdge;
    try {
      await api.deleteBookClubTheoryEdge(
        bookClubId,
        mysteryId,
        deletedEdge.id,
        deletedEdge.version,
      );
      setEdges((current) => current.filter((edge) => edge.id !== deletedEdge.id));
      setInlineEdge(null);
      toast.success(t`Connection removed`, {
        duration: 8_000,
        action: {
          label: t`Undo`,
          onClick: () =>
            void api
              .createBookClubTheoryEdge(bookClubId, mysteryId, {
                sourceNodeId: deletedEdge.sourceNodeId,
                targetNodeId: deletedEdge.targetNodeId,
                label: deletedEdge.label,
              })
              .then((restored) =>
                setEdges((current) => [
                  ...current.filter((edge) => edge.id !== restored.id),
                  restored,
                ]),
              )
              .catch((error) =>
                toast.error(
                  error instanceof Error ? error.message : t`Could not restore that connection`,
                ),
              ),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not delete that connection`);
    }
  }, [bookClubId, mysteryId, inlineEdge, setEdges]);

  const isDragging = Boolean(drag);
  const scene = useMemo(() => {
    void i18n.locale; // Refresh translated node controls when the locale changes.
    const connectorPreview =
      connecting?.mode === "pointer" ? nodeMap.get(connecting.sourceId) : null;
    const connectorStart =
      connectorPreview && connecting?.mode === "pointer"
        ? pointOnNodeEdge(connectorPreview, connecting.pointer)
        : null;
    return (
      <>
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
        >
          <defs>
            <marker
              id="theory-arrow-subtle"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L7,3 z" fill="#655f56" fillOpacity="0.52" />
            </marker>
            <marker
              id="theory-arrow-highlighted"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L7,3 z" fill="#51483e" fillOpacity="0.92" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const source = nodeMap.get(edge.sourceNodeId);
            const target = nodeMap.get(edge.targetNodeId);
            if (!source || !target || !visibleIds.has(source.id) || !visibleIds.has(target.id))
              return null;
            const highlighted =
              hoveredNodeId === edge.sourceNodeId || hoveredNodeId === edge.targetNodeId;
            return (
              <path
                key={edge.id}
                d={edgeGeometry(source, target, isReciprocal(edge)).path}
                fill="none"
                className={`theory-edge ${highlighted ? "is-highlighted" : ""}`}
                markerEnd={`url(#theory-arrow-${highlighted ? "highlighted" : "subtle"})`}
              />
            );
          })}
          {connectorPreview && connectorStart && connecting?.mode === "pointer" && (
            <path
              d={`M ${connectorStart.x} ${connectorStart.y} L ${connecting.pointer.x} ${connecting.pointer.y}`}
              fill="none"
              className="theory-edge-preview"
            />
          )}
        </svg>

        {edges.map((edge) => {
          const source = nodeMap.get(edge.sourceNodeId);
          const target = nodeMap.get(edge.targetNodeId);
          if (!source || !target || !visibleIds.has(source.id) || !visibleIds.has(target.id))
            return null;
          const point = edgeGeometry(source, target, isReciprocal(edge)).midpoint;
          const highlighted =
            hoveredNodeId === edge.sourceNodeId || hoveredNodeId === edge.targetNodeId;
          if (inlineEdge?.id === edge.id) {
            return (
              <div
                key={edge.id}
                data-board-interactive
                className="theory-edge-editor absolute z-30 flex gap-1"
                style={{ left: point.x - 86, top: point.y - 16 }}
                onPointerDown={(event) => event.stopPropagation()}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                    void saveEdgeLabel();
                }}
              >
                <Input
                  autoFocus
                  className="h-8 w-40 px-2 text-xs"
                  value={inlineEdge.label}
                  onChange={(event) => setInlineEdge({ ...inlineEdge, label: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveEdgeLabel();
                    if (event.key === "Escape") setInlineEdge(null);
                  }}
                />
                <Button
                  type="button"
                  variant="bare"
                  aria-label={t`Delete connection`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void deleteEdge()}
                  className="theory-edge-editor__delete rounded px-2"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          }
          return (
            <Button
              key={edge.id}
              type="button"
              variant="bare"
              data-board-interactive
              className={`theory-edge-label absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs ${highlighted ? "is-highlighted" : ""}`}
              style={{ left: point.x, top: point.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setInlineEdge({ ...edge })}
              title={t`Click to name this connection`}
            >
              {edge.label || <Link2 className="size-3" />}
            </Button>
          );
        })}

        {visibleNodes.map((node) => (
          <Tooltip
            key={node.id}
            delayDuration={350}
            onOpenChange={(open) =>
              setDescriptionNodeId((current) =>
                open ? node.id : current === node.id ? null : current,
              )
            }
            open={Boolean(
              descriptionNodeId === node.id &&
              !isDragging &&
              !connecting &&
              node.description?.trim(),
            )}
          >
            <TooltipTrigger asChild>
              <article
                data-theory-node-id={node.id}
                data-board-interactive
                role={
                  connecting?.mode === "keyboard" && connecting.sourceId !== node.id
                    ? "button"
                    : undefined
                }
                tabIndex={0}
                aria-label={
                  connecting?.mode === "keyboard" && connecting.sourceId !== node.id
                    ? `${t`Connect to this note`}: ${node.title}`
                    : undefined
                }
                className={`theory-node absolute z-10 flex cursor-grab select-none flex-col p-3 active:cursor-grabbing ${nodeTone[node.kind]} ${connecting?.sourceId === node.id ? "is-connection-source" : connecting ? "is-connection-target" : ""}`}
                style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                onFocus={() => setHoveredNodeId(node.id)}
                onBlur={() => setHoveredNodeId(null)}
                onPointerEnter={() => setHoveredNodeId(node.id)}
                onPointerLeave={() =>
                  setHoveredNodeId((current) => (current === node.id ? null : current))
                }
                onPointerDown={(event) => {
                  if (
                    aligningRef.current ||
                    event.button !== 0 ||
                    (event.pointerType === "touch" && !event.isPrimary)
                  )
                    return;
                  if (connecting?.mode === "keyboard") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (connecting.sourceId !== node.id) {
                      const sourceId = connecting.sourceId;
                      setConnecting(null);
                      createConnection(sourceId, node.id);
                    }
                    return;
                  }
                  event.stopPropagation();
                  setDrag({
                    type: "node",
                    node,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    x: node.x,
                    y: node.y,
                  });
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (!aligningRef.current) void openEdit(node);
                }}
                onKeyDown={(event) => {
                  if (
                    connecting?.mode === "keyboard" &&
                    connecting.sourceId !== node.id &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    const sourceId = connecting.sourceId;
                    setConnecting(null);
                    createConnection(sourceId, node.id);
                  }
                }}
              >
                {(["top", "right", "bottom", "left"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    title={t`Drag to connect notes`}
                    aria-label={t`Create connection from this note`}
                    aria-hidden={connecting?.mode === "keyboard" && connecting.sourceId !== node.id}
                    tabIndex={
                      connecting?.mode === "keyboard" && connecting.sourceId !== node.id
                        ? -1
                        : undefined
                    }
                    data-board-interactive
                    className={`theory-node__pin theory-node__pin--${side} absolute z-20 rounded-full`}
                    onPointerDown={(event) => startConnection(event, node.id)}
                    onClick={(event) => {
                      if (event.detail === 0)
                        setConnecting({ sourceId: node.id, mode: "keyboard" });
                    }}
                  >
                    <Link2 className="size-3.5" aria-hidden="true" />
                  </button>
                ))}
                <div className="flex items-start gap-2 pr-2">
                  {node.kind === "suspect" ? (
                    <UserRound className="theory-node__icon mt-0.5 size-4 shrink-0" />
                  ) : (
                    <Crosshair className="theory-node__icon mt-0.5 size-4 shrink-0" />
                  )}
                  <h2 className="line-clamp-2 text-sm font-semibold leading-snug">{node.title}</h2>
                </div>
                {node.description?.trim() && (
                  <p className="theory-node__description mt-1 line-clamp-2 text-xs leading-snug">
                    {node.description}
                  </p>
                )}
                <div className="theory-node__tags mt-auto flex max-h-11 flex-wrap gap-1 overflow-hidden pt-2">
                  <span className="theory-node__base-tag rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                    {node.baseTag}
                  </span>
                  {node.tags.map((tag) => (
                    <span
                      key={tag}
                      className="theory-node__tag rounded-full px-2 py-0.5 text-[10px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {node.editingByNickname && (
                  <span className="theory-node__lock mt-1 flex items-center gap-1 text-[10px]">
                    <Lock className="size-3" /> {node.editingByNickname}
                  </span>
                )}
              </article>
            </TooltipTrigger>
            {node.description?.trim() && (
              <TooltipContent className="theory-description-tooltip whitespace-pre-wrap break-words">
                {node.description}
              </TooltipContent>
            )}
          </Tooltip>
        ))}
      </>
    );
  }, [
    edges,
    edgeDirections,
    nodeMap,
    visibleIds,
    visibleNodes,
    hoveredNodeId,
    descriptionNodeId,
    isDragging,
    connecting,
    inlineEdge,
    startConnection,
    createConnection,
    openEdit,
    saveEdgeLabel,
    deleteEdge,
    i18n.locale,
  ]);

  return (
    <div className="theory-board flex flex-col">
      <header className="theory-board__header flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="bare"
            size="icon"
            className="subtle-back-button"
            onClick={onClose}
            aria-label={t`Book Club`}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <p className="theory-board__eyebrow text-xs font-bold uppercase tracking-[0.18em]">
              <Trans>Theorize</Trans>
            </p>
            <h1 className="truncate !text-2xl leading-none">{mysteryTitle}</h1>
          </div>
        </div>
        <Button
          className="theory-button theory-button--primary"
          onClick={openNewNote}
          disabled={aligning}
          aria-keyshortcuts="N"
          title={t`Add note (N)`}
        >
          <Plus className="size-4" /> <Trans>Add note</Trans>
          <kbd className="theory-shortcut hidden sm:inline" aria-hidden="true">
            N
          </kbd>
        </Button>
      </header>

      {loadError != null && (
        <section className="cozy-load-error" role="alert">
          <p>
            {loadError instanceof Error ? loadError.message : t`Could not load the theory board`}
          </p>
          <Button
            size="sm"
            className="theory-button theory-button--secondary"
            onClick={() => void live.refresh(false)}
          >
            <Trans>Try again</Trans>
          </Button>
        </section>
      )}

      <div className="theory-board__toolbar flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
        <span className="mr-1 flex items-center gap-1">
          <Filter className="size-4" /> <Trans>Show</Trans>
        </span>
        {(Object.keys(filters) as TheoryNodeKind[]).map((kind) => (
          <Button
            key={kind}
            type="button"
            variant="bare"
            aria-pressed={filters[kind]}
            onClick={() => setFilters((current) => ({ ...current, [kind]: !current[kind] }))}
            className={`theory-filter rounded-full border px-3 py-1 text-xs font-semibold transition ${filters[kind] ? "is-active" : ""}`}
          >
            {kindLabel(kind)}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="hidden sm:inline">
            <Trans>Drag the board to move around. Drag a link handle to connect notes.</Trans>
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex" tabIndex={aligning || nodes.length < 2 ? 0 : undefined}>
                <Button
                  variant="ghost"
                  className="theory-button theory-button--toolbar"
                  size="sm"
                  onClick={() => void alignBoard()}
                  disabled={aligning || nodes.length < 2}
                  aria-label={t`Auto-align notes`}
                >
                  <WandSparkles className="size-4" />
                  <span className="hidden md:inline">
                    {aligning ? <Trans>Aligning…</Trans> : <Trans>Auto-align</Trans>}
                  </span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent
              className="theory-description-tooltip pointer-events-none"
              side="bottom"
              align="end"
              collisionPadding={12}
            >
              {nodes.length < 2
                ? t`Add at least two notes to auto-align.`
                : aligning
                  ? t`Aligning…`
                  : t`Auto-align notes`}
            </TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            className="theory-button theory-button--toolbar"
            size="sm"
            onClick={overview}
            title={t`Show all notes`}
            aria-label={t`Overview`}
          >
            <Maximize className="size-4" />
            <span className="hidden md:inline">
              <Trans>Overview</Trans>
            </span>
          </Button>
        </div>
      </div>

      <main
        ref={canvasRef}
        className="theory-board__canvas relative min-h-0 flex-1 touch-none overflow-hidden"
        onPointerDown={(event) => {
          if (
            aligningRef.current ||
            event.button !== 0 ||
            (event.pointerType === "touch" && !event.isPrimary) ||
            connecting ||
            (event.target as Element).closest("[data-board-interactive]")
          )
            return;
          event.preventDefault();
          setDrag({
            type: "pan",
            clientX: event.clientX,
            clientY: event.clientY,
            x: pan.x,
            y: pan.y,
          });
        }}
      >
        {loading && (
          <p className="theory-board__loading absolute left-1/2 top-1/2 -translate-x-1/2 text-sm">
            <Trans>Opening the case files…</Trans>
          </p>
        )}
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={
            {
              width: BOARD_WIDTH,
              height: BOARD_HEIGHT,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              "--theory-inverse-zoom": `${1 / zoom}`,
            } as React.CSSProperties
          }
        >
          {scene}
        </div>
      </main>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="theory-dialog" showCloseButton onKeyDown={submitNoteShortcut}>
          <DialogHeader>
            <DialogTitle>
              <Trans>Add to the theory board</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>Notes are shared with everyone in this Book Club.</Trans>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              <Trans>Type</Trans>
              <Select
                open={typeMenuOpen}
                onOpenChange={setTypeMenuOpen}
                value={newKind}
                onValueChange={(kind) => chooseNewKind(kind as TheoryNodeKind)}
              >
                <SelectTrigger
                  aria-label={t`Type`}
                  aria-keyshortcuts="Alt+Shift+1 Alt+Shift+2 Alt+Shift+3 Alt+Shift+4"
                  className="theory-dialog__select mt-1"
                >
                  <SelectValue>{kindLabel(newKind)}</SelectValue>
                </SelectTrigger>
                <SelectContent
                  className="theory-type-options"
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    newTitleRef.current?.focus();
                    newTitleRef.current?.select();
                  }}
                >
                  {(Object.keys(filters) as TheoryNodeKind[]).map((kind, index) => (
                    <SelectItem key={kind} value={kind} textValue={kindLabel(kind)}>
                      <span className="theory-type-option">
                        <span>{kindLabel(kind)}</span>
                        <kbd>Alt ⇧ {index + 1}</kbd>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="block text-sm font-medium">
              <Trans>Title</Trans>
              <Input
                ref={newTitleRef}
                autoFocus
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                maxLength={400}
                placeholder={t`What do you know?`}
                className="mt-1"
              />
            </label>
            <label className="block text-sm font-medium">
              <Trans>Description (optional)</Trans>
              <Textarea
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                maxLength={3_000}
                className="mt-1 min-h-24"
              />
            </label>
            <TagEditor tags={newTags} setTags={setNewTags} existingTags={existingTags} />
          </div>
          <DialogFooter>
            <Button
              className="theory-button theory-button--primary"
              disabled={!newTitle.trim() || savingNote}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              onClick={() => void createNode()}
            >
              <Plus className="size-4" />
              <Trans>Add note</Trans>
              <kbd className="theory-shortcut" aria-hidden="true">
                ⌘ / Ctrl ↵
              </kbd>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="theory-dialog" showCloseButton onKeyDown={submitNoteShortcut}>
          <DialogHeader>
            <DialogTitle>
              <Trans>Edit note</Trans>
            </DialogTitle>
            <DialogDescription>
              {editing?.sourceClueId ? (
                <Trans>This title stays in sync with the mystery clue list.</Trans>
              ) : (
                <Trans>Hover over a note to read its description.</Trans>
              )}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                <Trans>Title</Trans>
                <Input
                  autoFocus
                  value={editing.draftTitle}
                  disabled={Boolean(editing.sourceClueId)}
                  onChange={(event) => setEditing({ ...editing, draftTitle: event.target.value })}
                  maxLength={400}
                  className="mt-1"
                />
              </label>
              <label className="block text-sm font-medium">
                <Trans>Description (optional)</Trans>
                <Textarea
                  value={editing.draftDescription}
                  onChange={(event) =>
                    setEditing({ ...editing, draftDescription: event.target.value })
                  }
                  maxLength={
                    editing.sourceClueId ? 20_500 : Math.max(3_000, editing.description.length)
                  }
                  autoFocus={Boolean(editing.sourceClueId)}
                  className="mt-1 min-h-24"
                />
              </label>
              <TagEditor
                tags={editing.draftTags}
                setTags={(draftTags) => setEditing({ ...editing, draftTags })}
                existingTags={existingTags}
                baseTag={editing.baseTag}
              />
            </div>
          )}
          <DialogFooter className="sm:justify-between">
            <div>
              {editing && !editing.sourceClueId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="theory-delete-note"
                  aria-label={t`Delete note`}
                  disabled={savingNote}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                variant="outline"
                className="theory-button theory-button--secondary"
                onClick={closeEdit}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                className="theory-button theory-button--primary"
                onClick={() => void saveEdit()}
                disabled={
                  savingNote ||
                  Boolean(editing && !editing.sourceClueId && !editing.draftTitle.trim())
                }
                aria-keyshortcuts="Control+Enter Meta+Enter"
              >
                <Trans>Save note</Trans>
                <kbd className="theory-shortcut hidden sm:inline" aria-hidden="true">
                  ⌘ / Ctrl ↵
                </kbd>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirmDelete && Boolean(editing)}
        onOpenChange={(open) => !savingNote && setConfirmDelete(open)}
      >
        <DialogContent
          className="theory-dialog"
          showCloseButton={!savingNote}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelDeleteRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              <Trans>Delete this note?</Trans>
            </DialogTitle>
            <DialogDescription>
              <Trans>The note and its connections will be permanently removed.</Trans>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              ref={cancelDeleteRef}
              variant="outline"
              className="theory-button theory-button--secondary"
              disabled={savingNote}
              onClick={() => setConfirmDelete(false)}
            >
              <Trans>Keep note</Trans>
            </Button>
            <Button
              className="theory-button theory-button--destructive"
              disabled={savingNote}
              onClick={() => void deleteNode()}
            >
              <Trans>Delete</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TagEditor({
  tags,
  setTags,
  existingTags,
  baseTag,
}: {
  tags: string[];
  setTags: (tags: string[]) => void;
  existingTags: string[];
  baseTag?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (
      !value ||
      tags.some((tag) => tag.localeCompare(value, undefined, { sensitivity: "accent" }) === 0)
    )
      return;
    setTags([...tags, value]);
    setDraft("");
  };
  return (
    <section>
      <p className="flex items-center gap-1 text-sm font-medium">
        <Tag className="size-4" />
        <Trans>Tags</Trans>
      </p>
      {baseTag && (
        <p className="mt-1 text-xs text-gray-400">
          <Trans>The</Trans> <strong>{baseTag}</strong> <Trans>tag is automatic.</Trans>
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Button
            key={tag}
            type="button"
            variant="bare"
            onClick={() => setTags(tags.filter((entry) => entry !== tag))}
            className="theory-tag-choice is-selected rounded-full border px-2 py-1 text-xs"
            title={t`Remove tag`}
          >
            {tag} ×
          </Button>
        ))}
      </div>
      {existingTags.filter((tag) => !tags.includes(tag)).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="w-full text-xs text-gray-400">
            <Trans>Existing tags</Trans>
          </span>
          {existingTags
            .filter((tag) => !tags.includes(tag))
            .map((tag) => (
              <Button
                key={tag}
                type="button"
                variant="bare"
                onClick={() => setTags([...tags, tag])}
                className="theory-tag-choice rounded-full border px-2 py-0.5 text-xs"
              >
                + {tag}
              </Button>
            ))}
        </div>
      )}
      <div className="theory-tag-entry mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              add();
            }
          }}
          placeholder={t`Create a tag`}
          maxLength={40}
        />
        <Button
          type="button"
          variant="outline"
          className="theory-button theory-button--secondary"
          size="sm"
          onClick={add}
          disabled={!draft.trim()}
        >
          <Trans>Add</Trans>
        </Button>
      </div>
    </section>
  );
}
