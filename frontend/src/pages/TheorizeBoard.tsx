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
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  connectBookClubUpdates,
  type TheoryEdge,
  type TheoryNode,
  type TheoryNodeKind,
} from "@/utils/api";
import { t } from "@lingui/core/macro";
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
import "./theorize-board.css";

const BOARD_WIDTH = 6_000;
const BOARD_HEIGHT = 4_000;
const NODE_WIDTH = 286;
const NODE_HEIGHT = 150;
const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.35;
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

const nodeCenter = (node: TheoryNode): Point => ({
  x: node.x + NODE_WIDTH / 2,
  y: node.y + NODE_HEIGHT / 2,
});

const pointOnNodeEdge = (node: TheoryNode, toward: Point): Point => {
  const center = nodeCenter(node);
  const deltaX = toward.x - center.x;
  const deltaY = toward.y - center.y;
  if (!deltaX && !deltaY) return center;
  const scale =
    1 / Math.max(Math.abs(deltaX) / (NODE_WIDTH / 2), Math.abs(deltaY) / (NODE_HEIGHT / 2));
  return { x: center.x + deltaX * scale, y: center.y + deltaY * scale };
};

const edgeGeometry = (source: TheoryNode, target: TheoryNode) => {
  const sourceCenter = nodeCenter(source);
  const targetCenter = nodeCenter(target);
  const start = pointOnNodeEdge(source, targetCenter);
  const end = pointOnNodeEdge(target, sourceCenter);
  return {
    path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
    midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
  };
};

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
  positions.forEach((position) => {
    position.x += center.x - hub.x;
    position.y += center.y - hub.y;
  });

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
  const bulkUpdateRef = useRef(false);
  const [mysteryTitle, setMysteryTitle] = useState("");
  const [nodes, setNodes] = useState<TheoryNode[]>([]);
  const [edges, setEdges] = useState<TheoryEdge[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [aligning, setAligning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKind, setNewKind] = useState<TheoryNodeKind>("other");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [editing, setEditing] = useState<EditNode | null>(null);
  const [inlineEdge, setInlineEdge] = useState<TheoryEdge | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const refresh = useCallback(
    async (quiet = false) => {
      try {
        const board = await api.getBookClubTheory(bookClubId, mysteryId);
        setMysteryTitle(board.mystery.title);
        setNodes(board.nodes);
        setEdges(board.edges);
      } catch (error) {
        if (!quiet)
          toast.error(error instanceof Error ? error.message : t`Could not load the theory board`);
      } finally {
        setLoading(false);
      }
    },
    [bookClubId, mysteryId],
  );

  useEffect(() => {
    void refresh();
    const socket = connectBookClubUpdates(() => {
      if (!bulkUpdateRef.current) void refresh(true);
    });
    return () => socket?.close();
  }, [refresh]);

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
  }, [bookClubId, drag, mysteryId, refresh, zoom]);

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
  const existingTags = useMemo(() => [...new Set(nodes.flatMap((node) => node.tags))], [nodes]);

  const centerViewport = useCallback((candidates: TheoryNode[]) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const nextZoom = DEFAULT_ZOOM;
    if (!candidates.length) {
      const nextPan = { x: 48, y: 48 };
      zoomRef.current = nextZoom;
      panRef.current = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
      return;
    }
    const minX = Math.min(...candidates.map((node) => node.x));
    const maxX = Math.max(...candidates.map((node) => node.x + NODE_WIDTH));
    const minY = Math.min(...candidates.map((node) => node.y));
    const maxY = Math.max(...candidates.map((node) => node.y + NODE_HEIGHT));
    const nextPan = {
      x: bounds.width / 2 - ((minX + maxX) / 2) * nextZoom,
      y: bounds.height / 2 - ((minY + maxY) / 2) * nextZoom,
    };
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  const resetView = () => centerViewport(visibleNodes.length ? visibleNodes : nodes);

  const alignBoard = async () => {
    if (nodes.length < 2 || aligning) return;
    setAligning(true);
    bulkUpdateRef.current = true;
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
      const positions = new Map(result.nodes.map((node) => [node.id, node]));
      const updated = arranged.map((node) => Object.assign(node, positions.get(node.id)!));
      setNodes(updated);
      centerViewport(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not auto-align the board`);
      await refresh(true);
    } finally {
      bulkUpdateRef.current = false;
      setAligning(false);
    }
  };

  const startConnection = (event: React.PointerEvent, sourceId: string) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setConnecting({
      sourceId,
      mode: "pointer",
      pointer: clientToBoard(event.clientX, event.clientY),
    });
  };

  const createConnection = useCallback(
    (sourceId: string, targetId: string) => {
      void (async () => {
        try {
          const edge = await api.createBookClubTheoryEdge(bookClubId, mysteryId, {
            sourceNodeId: sourceId,
            targetNodeId: targetId,
          });
          setEdges((current) => [...current, edge]);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : t`Could not connect those notes`);
        }
      })();
    },
    [bookClubId, mysteryId],
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

  const openEdit = async (node: TheoryNode) => {
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
  };

  const closeEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing || (!editing.sourceClueId && !editing.draftTitle.trim())) return;
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
    }
  };

  const deleteNode = async () => {
    if (!editing || editing.sourceClueId) return;
    try {
      await api.deleteBookClubTheoryNode(bookClubId, mysteryId, editing.id, editing.version);
      setNodes((current) => current.filter((node) => node.id !== editing.id));
      setEdges((current) =>
        current.filter(
          (edge) => edge.sourceNodeId !== editing.id && edge.targetNodeId !== editing.id,
        ),
      );
      closeEdit();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not delete that note`);
    }
  };

  const createNode = async () => {
    if (!newTitle.trim()) return;
    try {
      const node = await api.createBookClubTheoryNode(bookClubId, mysteryId, {
        kind: newKind,
        title: newTitle.trim(),
        description: newDescription.trim(),
        tags: newTags,
        x: Math.round((260 - pan.x) / zoom),
        y: Math.round((180 - pan.y) / zoom),
      });
      setNodes((current) => [...current, node]);
      setNewTitle("");
      setNewDescription("");
      setNewTags([]);
      setNewKind("other");
      setCreating(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not add that note`);
    }
  };

  const saveEdgeLabel = async () => {
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
  };

  const deleteEdge = async () => {
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
  };

  const connectorPreview = connecting?.mode === "pointer" ? nodeMap.get(connecting.sourceId) : null;
  const connectorStart =
    connectorPreview && connecting?.mode === "pointer"
      ? pointOnNodeEdge(connectorPreview, connecting.pointer)
      : null;

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
        <Button className="theory-board__primary-action" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> <Trans>Add note</Trans>
        </Button>
      </header>

      <div className="theory-board__toolbar flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
        <span className="mr-1 flex items-center gap-1">
          <Filter className="size-4" /> <Trans>Show</Trans>
        </span>
        {(Object.keys(filters) as TheoryNodeKind[]).map((kind) => (
          <Button
            key={kind}
            type="button"
            variant="bare"
            onClick={() => setFilters((current) => ({ ...current, [kind]: !current[kind] }))}
            className={`theory-filter rounded-full border px-3 py-1 text-xs font-semibold transition ${filters[kind] ? "is-active" : ""}`}
          >
            {kindLabel(kind)}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="hidden sm:inline">
            <Trans>Drag the board to move around. Drag a pin to connect notes.</Trans>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void alignBoard()}
            disabled={aligning || nodes.length < 2}
            title={t`Auto-align notes`}
          >
            <WandSparkles className="size-4" />
            <span className="hidden md:inline">
              {aligning ? <Trans>Aligning…</Trans> : <Trans>Auto-align</Trans>}
            </span>
          </Button>
          <Button variant="ghost" size="sm" onClick={resetView} title={t`Recenter and reset zoom`}>
            <Maximize className="size-4" />
            <span className="sr-only">
              <Trans>Recenter and reset zoom</Trans>
            </span>
          </Button>
        </div>
      </div>

      <main
        ref={canvasRef}
        className="theory-board__canvas relative min-h-0 flex-1 touch-none overflow-hidden"
        onPointerDown={(event) => {
          if (
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
                  d={edgeGeometry(source, target).path}
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
            const point = edgeGeometry(source, target).midpoint;
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
                    onChange={(event) =>
                      setInlineEdge({ ...inlineEdge, label: event.target.value })
                    }
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
            <article
              key={node.id}
              data-theory-node-id={node.id}
              data-board-interactive
              role={
                connecting?.mode === "keyboard" && connecting.sourceId !== node.id
                  ? "button"
                  : undefined
              }
              tabIndex={
                connecting?.mode === "keyboard" && connecting.sourceId !== node.id ? 0 : undefined
              }
              aria-label={
                connecting?.mode === "keyboard" && connecting.sourceId !== node.id
                  ? `${t`Connect to this note`}: ${node.title}`
                  : undefined
              }
              className={`theory-node absolute z-10 flex cursor-grab select-none flex-col p-3 active:cursor-grabbing ${nodeTone[node.kind]} ${connecting?.sourceId === node.id ? "is-connection-source" : connecting ? "is-connection-target" : ""}`}
              style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
              onPointerEnter={() => setHoveredNodeId(node.id)}
              onPointerLeave={() =>
                setHoveredNodeId((current) => (current === node.id ? null : current))
              }
              onPointerDown={(event) => {
                if (event.button !== 0 || (event.pointerType === "touch" && !event.isPrimary))
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
                void openEdit(node);
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
              <button
                type="button"
                aria-label={t`Create connection from this note`}
                aria-hidden={connecting?.mode === "keyboard" && connecting.sourceId !== node.id}
                tabIndex={
                  connecting?.mode === "keyboard" && connecting.sourceId !== node.id
                    ? -1
                    : undefined
                }
                data-board-interactive
                className="theory-node__pin absolute z-20 rounded-full"
                onPointerDown={(event) => startConnection(event, node.id)}
                onClick={(event) => {
                  if (event.detail === 0) setConnecting({ sourceId: node.id, mode: "keyboard" });
                }}
              />
              <div className="flex items-start gap-2 pr-2">
                {node.kind === "suspect" ? (
                  <UserRound className="theory-node__icon mt-0.5 size-4 shrink-0" />
                ) : (
                  <Crosshair className="theory-node__icon mt-0.5 size-4 shrink-0" />
                )}
                <h2 className="line-clamp-4 text-sm font-semibold leading-snug">{node.title}</h2>
              </div>
              <div className="theory-node__tags mt-auto flex max-h-11 flex-wrap gap-1 overflow-hidden pt-2">
                <span className="theory-node__base-tag rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  {node.baseTag}
                </span>
                {node.tags.map((tag) => (
                  <span key={tag} className="theory-node__tag rounded-full px-2 py-0.5 text-[10px]">
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
          ))}
        </div>
      </main>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="theory-dialog" showCloseButton>
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
              <select
                value={newKind}
                onChange={(event) => setNewKind(event.target.value as TheoryNodeKind)}
                className="theory-dialog__select mt-1 h-10 w-full rounded-md border px-3 text-sm"
              >
                {(Object.keys(filters) as TheoryNodeKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabel(kind)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              <Trans>Title</Trans>
              <Input
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
            <Button variant="outline" onClick={() => setCreating(false)}>
              <Trans>Cancel</Trans>
            </Button>
            <Button disabled={!newTitle.trim()} onClick={() => void createNode()}>
              <Plus className="size-4" />
              <Trans>Add note</Trans>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="theory-dialog" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              <Trans>Edit note</Trans>
            </DialogTitle>
            <DialogDescription>
              {editing?.sourceClueId ? (
                <Trans>This title stays in sync with the mystery clue list.</Trans>
              ) : (
                <Trans>Only the title and tags appear on the canvas.</Trans>
              )}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                <Trans>Title</Trans>
                <Input
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
                  maxLength={3_000}
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
                <Button variant="destructive" onClick={() => void deleteNode()}>
                  <Trash2 className="size-4" />
                  <Trans>Delete</Trans>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeEdit}>
                <Trans>Cancel</Trans>
              </Button>
              <Button onClick={() => void saveEdit()}>
                <Trans>Save note</Trans>
              </Button>
            </div>
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
            className="theory-tag-choice rounded-full border px-2 py-1 text-xs"
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
      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={t`Create a tag`}
          maxLength={40}
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!draft.trim()}>
          <Trans>Add</Trans>
        </Button>
      </div>
    </section>
  );
}
