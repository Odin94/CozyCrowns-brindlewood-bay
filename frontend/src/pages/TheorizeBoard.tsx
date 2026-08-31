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
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const BOARD_WIDTH = 6_000;
const BOARD_HEIGHT = 4_000;
const NODE_WIDTH = 286;
const NODE_HEIGHT = 126;

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
  clue: "border-teal-300/70 bg-teal-950/80 shadow-teal-400/10",
  voidClue: "border-violet-300/70 bg-violet-950/80 shadow-violet-400/10",
  suspect: "border-amber-300/70 bg-amber-950/80 shadow-amber-400/10",
  other: "border-slate-400/70 bg-slate-900/90 shadow-slate-400/10",
};

type EditNode = TheoryNode & { draftTitle: string; draftDescription: string; draftTags: string[] };

const midpoint = (source: TheoryNode, target: TheoryNode) => ({
  x: (source.x + NODE_WIDTH + target.x) / 2,
  y: (source.y + NODE_HEIGHT / 2 + target.y + NODE_HEIGHT / 2) / 2,
});

const pathFor = (source: TheoryNode, target: TheoryNode) => {
  const startX = source.x + NODE_WIDTH;
  const startY = source.y + NODE_HEIGHT / 2;
  const endX = target.x;
  const endY = target.y + NODE_HEIGHT / 2;
  const distance = Math.max(100, Math.abs(endX - startX) * 0.48);
  return `M ${startX} ${startY} C ${startX + distance} ${startY}, ${endX - distance} ${endY}, ${endX} ${endY}`;
};

export default function TheorizeBoard({
  bookClubId,
  mystery,
  onClose,
}: {
  bookClubId: string;
  mystery: { id: string; title: string };
  onClose: () => void;
}) {
  const [nodes, setNodes] = useState<TheoryNode[]>([]);
  const [edges, setEdges] = useState<TheoryEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<TheoryNodeKind, boolean>>({
    clue: true,
    voidClue: true,
    suspect: true,
    other: true,
  });
  const [zoom, setZoom] = useState(0.82);
  const [pan, setPan] = useState({ x: -45, y: -50 });
  const [drag, setDrag] = useState<
    | { type: "node"; node: TheoryNode; clientX: number; clientY: number; x: number; y: number }
    | { type: "pan"; clientX: number; clientY: number; x: number; y: number }
    | null
  >(null);
  const [connecting, setConnecting] = useState<{ sourceId: string; clientX: number; clientY: number } | null>(
    null,
  );
  const [creating, setCreating] = useState(false);
  const [newKind, setNewKind] = useState<TheoryNodeKind>("other");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [editing, setEditing] = useState<EditNode | null>(null);
  const [inlineEdge, setInlineEdge] = useState<TheoryEdge | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    try {
      const board = await api.getBookClubTheory(bookClubId, mystery.id);
      setNodes(board.nodes);
      setEdges(board.edges);
    } catch (error) {
      if (!quiet)
        toast.error(error instanceof Error ? error.message : t`Could not load the theory board`);
    } finally {
      setLoading(false);
    }
  }, [bookClubId, mystery.id]);

  useEffect(() => {
    void refresh();
    const socket = connectBookClubUpdates(() => void refresh(true));
    return () => socket?.close();
  }, [refresh]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      if (drag.type === "pan") {
        setPan({ x: drag.x + event.clientX - drag.clientX, y: drag.y + event.clientY - drag.clientY });
        return;
      }
      const x = Math.round(drag.x + (event.clientX - drag.clientX) / zoom);
      const y = Math.round(drag.y + (event.clientY - drag.clientY) / zoom);
      setNodes((current) => current.map((node) => (node.id === drag.node.id ? { ...node, x, y } : node)));
    };
    const onUp = (event: PointerEvent) => {
      if (drag.type === "node") {
        const x = Math.round(drag.x + (event.clientX - drag.clientX) / zoom);
        const y = Math.round(drag.y + (event.clientY - drag.clientY) / zoom);
        void (async () => {
          try {
            const updated = await api.updateBookClubTheoryNode(bookClubId, mystery.id, drag.node.id, {
              version: drag.node.version,
              x,
              y,
            });
            setNodes((current) => current.map((node) => (node.id === updated.id ? updated : node)));
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t`Could not move that note`);
            void refresh(true);
          }
        })();
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [bookClubId, drag, mystery.id, refresh, zoom]);

  const editingNodeId = editing?.id;

  useEffect(() => {
    if (!editingNodeId) return;
    const heartbeat = window.setInterval(() => {
      void api.lockBookClubTheoryNode(bookClubId, mystery.id, editingNodeId).catch(() => undefined);
    }, 25_000);
    return () => {
      window.clearInterval(heartbeat);
      void api.releaseBookClubTheoryNode(bookClubId, mystery.id, editingNodeId);
    };
  }, [bookClubId, editingNodeId, mystery.id]);

  const visibleNodes = useMemo(
    () => nodes.filter((node) => filters[node.kind]),
    [filters, nodes],
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const existingTags = useMemo(() => [...new Set(nodes.flatMap((node) => node.tags))], [nodes]);

  const startConnection = (event: React.PointerEvent, sourceId: string) => {
    event.stopPropagation();
    setConnecting({ sourceId, clientX: event.clientX, clientY: event.clientY });
  };

  const finishConnection = (event: React.PointerEvent, targetId: string) => {
    event.stopPropagation();
    if (!connecting || connecting.sourceId === targetId) {
      setConnecting(null);
      return;
    }
    const sourceId = connecting.sourceId;
    setConnecting(null);
    void (async () => {
      try {
        const edge = await api.createBookClubTheoryEdge(bookClubId, mystery.id, {
          sourceNodeId: sourceId,
          targetNodeId: targetId,
        });
        setEdges((current) => [...current, edge]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t`Could not connect those notes`);
      }
    })();
  };

  const openEdit = async (node: TheoryNode) => {
    try {
      const locked = await api.lockBookClubTheoryNode(bookClubId, mystery.id, node.id);
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
      const updated = await api.updateBookClubTheoryNode(bookClubId, mystery.id, editing.id, {
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
      await api.deleteBookClubTheoryNode(bookClubId, mystery.id, editing.id, editing.version);
      setNodes((current) => current.filter((node) => node.id !== editing.id));
      setEdges((current) => current.filter((edge) => edge.sourceNodeId !== editing.id && edge.targetNodeId !== editing.id));
      closeEdit();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not delete that note`);
    }
  };

  const createNode = async () => {
    if (!newTitle.trim()) return;
    try {
      const node = await api.createBookClubTheoryNode(bookClubId, mystery.id, {
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
      const updated = await api.updateBookClubTheoryEdge(bookClubId, mystery.id, inlineEdge.id, {
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
    try {
      await api.deleteBookClubTheoryEdge(bookClubId, mystery.id, inlineEdge.id, inlineEdge.version);
      setEdges((current) => current.filter((edge) => edge.id !== inlineEdge.id));
      setInlineEdge(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t`Could not delete that connection`);
    }
  };

  const connectorPreview = connecting ? nodeMap.get(connecting.sourceId) : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#11141c] text-gray-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-[#1b2230] px-4 py-3 shadow-lg">
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">
              <Trans>Theorize</Trans>
            </p>
            <h1 className="truncate !text-2xl leading-none text-white">{mystery.title}</h1>
          </div>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> <Trans>Add note</Trans>
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-[#151a24] px-4 py-2 text-sm">
        <span className="mr-1 flex items-center gap-1 text-slate-400">
          <Filter className="size-4" /> <Trans>Show</Trans>
        </span>
        {(Object.keys(filters) as TheoryNodeKind[]).map((kind) => (
          <Button
            key={kind}
            type="button"
            variant="bare"
            onClick={() => setFilters((current) => ({ ...current, [kind]: !current[kind] }))}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${filters[kind] ? "border-teal-300/60 bg-teal-300/15 text-teal-100" : "border-slate-700 bg-slate-900 text-slate-500"}`}
          >
            {kindLabel(kind)}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <span className="hidden sm:inline"><Trans>Drag a note to move it. Drag a dot to connect it.</Trans></span>
          <Button variant="ghost" size="sm" onClick={() => { setZoom(0.82); setPan({ x: -45, y: -50 }); }}>
            <Maximize className="size-4" /> <span className="sr-only"><Trans>Reset view</Trans></span>
          </Button>
        </div>
      </div>

      <main
        className="relative min-h-[calc(100vh-9.5rem)] flex-1 touch-none overflow-hidden bg-[#10131a]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.09) 1px, transparent 1px)",
          backgroundSize: `${26 * zoom}px ${26 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget)
            setDrag({ type: "pan", clientX: event.clientX, clientY: event.clientY, x: pan.x, y: pan.y });
        }}
        onPointerMove={(event) => {
          if (connecting) setConnecting({ ...connecting, clientX: event.clientX, clientY: event.clientY });
        }}
        onPointerUp={() => setConnecting(null)}
        onWheel={(event) => {
          event.preventDefault();
          setZoom((current) => Math.max(0.45, Math.min(1.35, current - event.deltaY * 0.001)));
        }}
      >
        {loading && <p className="absolute left-1/2 top-1/2 -translate-x-1/2 text-sm text-slate-400"><Trans>Opening the case files…</Trans></p>}
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <svg className="pointer-events-none absolute inset-0 overflow-visible" width={BOARD_WIDTH} height={BOARD_HEIGHT}>
            <defs>
              <marker id="theory-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L7,3 z" fill="#94a3b8" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const source = nodeMap.get(edge.sourceNodeId);
              const target = nodeMap.get(edge.targetNodeId);
              if (!source || !target || !visibleIds.has(source.id) || !visibleIds.has(target.id)) return null;
              return <path key={edge.id} d={pathFor(source, target)} fill="none" stroke="#94a3b8" strokeWidth="2.4" markerEnd="url(#theory-arrow)" />;
            })}
            {connectorPreview && (
              <path
                d={`M ${connectorPreview.x + NODE_WIDTH} ${connectorPreview.y + NODE_HEIGHT / 2} L ${(connecting!.clientX - pan.x) / zoom} ${(connecting!.clientY - pan.y) / zoom}`}
                fill="none"
                stroke="#5eead4"
                strokeWidth="3"
                strokeDasharray="8 6"
              />
            )}
          </svg>

          {edges.map((edge) => {
            const source = nodeMap.get(edge.sourceNodeId);
            const target = nodeMap.get(edge.targetNodeId);
            if (!source || !target || !visibleIds.has(source.id) || !visibleIds.has(target.id)) return null;
            const point = midpoint(source, target);
            if (inlineEdge?.id === edge.id) {
              return (
                <div key={edge.id} className="absolute z-30 flex gap-1" style={{ left: point.x - 86, top: point.y - 16 }}>
                  <Input
                    autoFocus
                    className="h-8 w-40 border-teal-300 bg-slate-950 px-2 text-xs text-white"
                    value={inlineEdge.label}
                    onChange={(event) => setInlineEdge({ ...inlineEdge, label: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void saveEdgeLabel();
                      if (event.key === "Escape") setInlineEdge(null);
                    }}
                    onBlur={() => void saveEdgeLabel()}
                  />
                  <Button type="button" variant="bare" aria-label={t`Delete connection`} onMouseDown={(event) => event.preventDefault()} onClick={() => void deleteEdge()} className="rounded bg-slate-950 px-2 text-rose-300 hover:bg-rose-950">
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
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded border border-slate-500 bg-[#151a24] px-2 py-0.5 text-xs text-slate-200 shadow hover:border-teal-300"
                style={{ left: point.x, top: point.y }}
                onDoubleClick={() => setInlineEdge({ ...edge })}
                title={t`Double click to name this connection`}
              >
                {edge.label || <Link2 className="size-3" />}
              </Button>
            );
          })}

          {visibleNodes.map((node) => (
            <article
              key={node.id}
              className={`absolute z-10 flex cursor-grab select-none flex-col border-2 p-3 shadow-xl active:cursor-grabbing ${nodeTone[node.kind]} ${node.kind === "suspect" ? "rounded-[1.65rem]" : "rounded-xl"}`}
              style={{ left: node.x, top: node.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.stopPropagation();
                setDrag({ type: "node", node, clientX: event.clientX, clientY: event.clientY, x: node.x, y: node.y });
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                void openEdit(node);
              }}
            >
              <Button
                type="button"
                variant="bare"
                aria-label={t`Create connection from this note`}
                className="absolute -right-2 top-1/2 z-20 size-5 -translate-y-1/2 rounded-full border-2 border-teal-200 bg-teal-500 shadow"
                onPointerDown={(event) => startConnection(event, node.id)}
              />
              {connecting && connecting.sourceId !== node.id && (
                <Button
                  type="button"
                  variant="bare"
                  aria-label={t`Connect to this note`}
                  className="absolute -left-2 top-1/2 z-20 size-5 -translate-y-1/2 rounded-full border-2 border-teal-100 bg-slate-800 shadow"
                  onPointerUp={(event) => finishConnection(event, node.id)}
                />
              )}
              <div className="flex items-start gap-2 pr-2">
                {node.kind === "suspect" ? <UserRound className="mt-0.5 size-4 shrink-0 text-amber-200" /> : <Crosshair className="mt-0.5 size-4 shrink-0 text-teal-200" />}
                <h2 className="line-clamp-4 text-sm font-semibold leading-snug text-white">{node.title}</h2>
              </div>
              <div className="mt-auto flex flex-wrap gap-1 pt-2">
                <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{node.baseTag}</span>
                {node.tags.map((tag) => <span key={tag} className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] text-slate-100">{tag}</span>)}
              </div>
              {node.editingByNickname && <span className="mt-1 flex items-center gap-1 text-[10px] text-amber-100"><Lock className="size-3" /> {node.editingByNickname}</span>}
            </article>
          ))}
        </div>
      </main>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle><Trans>Add to the theory board</Trans></DialogTitle>
            <DialogDescription><Trans>Notes are shared with everyone in this Book Club.</Trans></DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-medium"><Trans>Type</Trans>
              <select value={newKind} onChange={(event) => setNewKind(event.target.value as TheoryNodeKind)} className="mt-1 h-10 w-full rounded-md border border-gray-600 bg-gray-900 px-3 text-sm text-white">
                {(Object.keys(filters) as TheoryNodeKind[]).map((kind) => <option key={kind} value={kind}>{kindLabel(kind)}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium"><Trans>Title</Trans><Input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} maxLength={400} placeholder={t`What do you know?`} className="mt-1" /></label>
            <label className="block text-sm font-medium"><Trans>Description (optional)</Trans><Textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} maxLength={3_000} className="mt-1 min-h-24" /></label>
            <TagEditor tags={newTags} setTags={setNewTags} existingTags={existingTags} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreating(false)}><Trans>Cancel</Trans></Button><Button disabled={!newTitle.trim()} onClick={() => void createNode()}><Plus className="size-4" /><Trans>Add note</Trans></Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle><Trans>Edit note</Trans></DialogTitle>
            <DialogDescription>{editing?.sourceClueId ? <Trans>This title stays in sync with the mystery clue list.</Trans> : <Trans>Only the title and tags appear on the canvas.</Trans>}</DialogDescription>
          </DialogHeader>
          {editing && <div className="space-y-3">
            <label className="block text-sm font-medium"><Trans>Title</Trans><Input value={editing.draftTitle} disabled={Boolean(editing.sourceClueId)} onChange={(event) => setEditing({ ...editing, draftTitle: event.target.value })} maxLength={400} className="mt-1" /></label>
            <label className="block text-sm font-medium"><Trans>Description (optional)</Trans><Textarea value={editing.draftDescription} onChange={(event) => setEditing({ ...editing, draftDescription: event.target.value })} maxLength={3_000} className="mt-1 min-h-24" /></label>
            <TagEditor tags={editing.draftTags} setTags={(draftTags) => setEditing({ ...editing, draftTags })} existingTags={existingTags} baseTag={editing.baseTag} />
          </div>}
          <DialogFooter className="sm:justify-between">
            <div>{editing && !editing.sourceClueId && <Button variant="destructive" onClick={() => void deleteNode()}><Trash2 className="size-4" /><Trans>Delete</Trans></Button>}</div>
            <div className="flex gap-2"><Button variant="outline" onClick={closeEdit}><Trans>Cancel</Trans></Button><Button onClick={() => void saveEdit()}><Trans>Save note</Trans></Button></div>
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
    if (!value || tags.some((tag) => tag.localeCompare(value, undefined, { sensitivity: "accent" }) === 0)) return;
    setTags([...tags, value]);
    setDraft("");
  };
  return (
    <section>
      <p className="flex items-center gap-1 text-sm font-medium"><Tag className="size-4" /><Trans>Tags</Trans></p>
      {baseTag && <p className="mt-1 text-xs text-gray-400"><Trans>The</Trans> <strong>{baseTag}</strong> <Trans>tag is automatic.</Trans></p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((tag) => <Button key={tag} type="button" variant="bare" onClick={() => setTags(tags.filter((entry) => entry !== tag))} className="rounded-full border border-teal-300/50 bg-teal-300/10 px-2 py-1 text-xs text-teal-100" title={t`Remove tag`}>{tag} ×</Button>)}
      </div>
      {existingTags.filter((tag) => !tags.includes(tag)).length > 0 && <div className="mt-2 flex flex-wrap gap-1"><span className="w-full text-xs text-gray-400"><Trans>Existing tags</Trans></span>{existingTags.filter((tag) => !tags.includes(tag)).map((tag) => <Button key={tag} type="button" variant="bare" onClick={() => setTags([...tags, tag])} className="rounded-full border border-gray-600 px-2 py-0.5 text-xs text-gray-200 hover:border-teal-300">+ {tag}</Button>)}</div>}
      <div className="mt-2 flex gap-2"><Input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder={t`Create a tag`} maxLength={40} /><Button type="button" variant="outline" size="sm" onClick={add} disabled={!draft.trim()}><Trans>Add</Trans></Button></div>
    </section>
  );
}
