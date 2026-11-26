import { buildFreeSnapGuides } from "@/features/canvas/utils/buildFreeSnapGuides";
import { clampFreeChildAxis } from "@/features/canvas/utils/computeFreeChildMoveResult";
import {
  createFreeInsertionSnapContext,
  referencedTargetIds,
  snapReferencesChanged,
  type FreeSnapContext,
} from "@/features/canvas/utils/createFreeSnapContext";
import { applyAutoScroll, collectScrollContainers, measureScrollers, planAutoScroll } from "@/features/canvas/utils/freeAutoScroll";
import { measureFreeContainerFrame, type Rect } from "@/features/canvas/utils/freeLayoutFrame";
import { ALL_EDGES, NO_SNAP_LOCK, resolveSnap, SNAP_EPSILON, translateBox, type SnapAdjust, type SnapLock } from "@/features/canvas/utils/snapEngine";
import { computeEqualSpacingCandidates } from "@/features/canvas/utils/snapEqualSpacing";
import { getDefaultFreeElementSizeForNode } from "@/features/editor/factories/elementFactories";
import { canParentAcceptChild } from "@/features/editor/rules/insertionRules";
import { getTransformBlockingAncestor } from "@/features/editor/rules/transformGeometrySafety";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getLayoutMode, getResizeConstraintsForTag, type FreeLayoutGeometry } from "@/features/editor/types/layout";
import type { ActiveSnapGuides, FreeInsertionPreview } from "@/features/editor/types/snap";
import { getElementSpacing } from "@/features/editor/types/spacing";
import { getTransformSettings, hasNonIdentityRotateOrScale } from "@/features/editor/types/transform";
import { registerActiveInteraction } from "@/features/editor/utils/activeInteraction";
import { findAncestorChain, findNodeById } from "@/features/editor/utils/findNodeById";
import { normalizeFreeLayoutGeometry } from "@/features/editor/utils/normalizeFreeLayoutGeometry";

/**
 * BC-13.6 (Decision 30) — the live part of dragging a Resource Panel
 * component into a Free container. The drag itself stays dnd-kit's (the
 * one DndContext in EditorApp, a PointerSensor — not the pointer-capture
 * gesture BC-13.5's createFreeInteraction drives), so this is a separate
 * session that EditorApp's DndContext handlers feed; it reuses the shared
 * pieces underneath: the coordinate frame, target collection, the snapping
 * engine, equal spacing, the guide builder and overlay, freeAutoScroll, the
 * command-interruption registry.
 *
 * One session per catalog drag (module state: there is only one pointer
 * drag at a time). While the destination is a Free container:
 * - the proposed box follows the pointer: the pointer keeps the same
 *   relative spot of the box that it had on the Resource Panel card
 *   (the card's hotspot, as fractions of its width/height), so the preview
 *   doesn't jump when it enters a container, whatever size the component;
 * - the component's default size, fitted by the existing Free placement rule
 *   (normalizeFreeLayoutGeometry: containment wins over the minimum), then
 *   containment of the position, then snapping (6 px, both axes, locks,
 *   equal spacing, Snap preference, Alt bypass), candidates the containment
 *   rejects are never applied or drawn;
 * - every frame maps the CURRENT pointer through the CURRENT container
 *   origin, so scrolling (automatic or manual) can't drift;
 * - one rAF loop: auto-scroll (innermost scroller, only while it reveals
 *   more of the destination; dnd-kit's own auto-scroll stands down) →
 *   target refresh (destination change, scroll, document change, window
 *   resize, a referenced target changing) → geometry → preview + guides;
 * - nothing is written to the document: the preview and guides are
 *   ephemeral store state; the drop inserts through the normal command.
 * A recognized editor command, a window blur or a project/Preview change
 * cancels the whole drag (dnd-kit's own Escape path), so nothing is
 * inserted afterwards.
 */

export interface FreeInsertionStart {
  /** An in-memory example of the component (never inserted): its tag, default size and margin. */
  prototype: EditorElementNode;
  label: string;
  pointer: { x: number; y: number };
  /** Where the pointer held the Resource Panel card, as fractions (0..1) of its width and height. */
  hotspot: { x: number; y: number };
}

export interface FreeInsertionPlacement {
  containerId: string;
  geometry: FreeLayoutGeometry;
}

/** Scroll-only target refreshes are throttled to this interval (the same as dragging). */
const SNAP_REFRESH_INTERVAL_MS = 250;

interface Destination {
  containerId: string;
  containerEl: HTMLElement;
  valid: boolean;
  snap: FreeSnapContext | null;
  references: readonly string[];
  lock: SnapLock;
  scrollers: HTMLElement[];
  signature: string;
  lastRefresh: number;
  dirty: boolean;
}

interface Session {
  generation: number;
  prototype: EditorElementNode;
  label: string;
  size: { width: number; height: number };
  margin: { left?: number; top?: number };
  hotspot: { x: number; y: number };
  pointer: { x: number; y: number };
  alt: boolean;
  destination: Destination | null;
  placement: FreeInsertionPlacement | null;
  interrupted: boolean;
  frameId: number | null;
  lastFrameTime: number | null;
  previewKey: string;
  guidesKey: string;
  cleanup: () => void;
}

let current: Session | null = null;
let generationCounter = 0;
/** Set when the current (or just-ended) drag was interrupted by a command; a drop that still arrives afterwards inserts nothing. Reset at the next start. */
let interruptedDrag = false;

const store = () => useEditorStore.getState();
const surfaceNode = (id: string) => window.document.querySelector<HTMLElement>(`[data-document-surface] [data-node-id="${CSS.escape(id)}"]`);
const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5);

function publishPreview(session: Session, preview: FreeInsertionPreview | null) {
  const key = JSON.stringify(preview);
  if (key === session.previewKey) return;
  session.previewKey = key;
  store().setFreeInsertionPreview(preview);
}

function publishGuides(session: Session, guides: ActiveSnapGuides | null) {
  const key = JSON.stringify(guides);
  if (key === session.guidesKey) return;
  session.guidesKey = key;
  store().setActiveSnapGuides(guides);
}

function scrollSignature(scrollers: readonly HTMLElement[]): string {
  return scrollers.map((el) => `${el.scrollLeft},${el.scrollTop}`).join("|");
}

/** Measures the destination's snap targets now. */
function refreshTargets(session: Session, destination: Destination, now: number) {
  const frame = measureFreeContainerFrame(destination.containerEl);
  destination.snap = destination.valid
    ? createFreeInsertionSnapContext(destination.containerEl, frame, store().document, destination.containerId, session.margin)
    : null;
  destination.references = [];
  destination.dirty = false;
  destination.lastRefresh = now;
}

/** Computes this frame's proposed placement (and publishes the preview and guides). Returns whether to keep the loop running. */
function computeFrame(session: Session, now: number, final: boolean): boolean {
  const destination = session.destination;
  if (!destination || !destination.containerEl.isConnected) {
    session.placement = null;
    publishPreview(session, null);
    publishGuides(session, null);
    return false;
  }

  let scrolled = false;
  if (!final && destination.scrollers.length > 0) {
    const elapsed = session.lastFrameTime === null ? 16 : now - session.lastFrameTime;
    const el = destination.containerEl;
    const rect = el.getBoundingClientRect();
    const left = rect.left + el.clientLeft;
    const top = rect.top + el.clientTop;
    const reach = { left, top, right: left + el.clientWidth, bottom: top + el.clientHeight };
    scrolled = applyAutoScroll(destination.scrollers, planAutoScroll(session.pointer, measureScrollers(destination.scrollers), elapsed, reach));
  }
  session.lastFrameTime = now;

  const signature = scrollSignature(destination.scrollers);
  if (signature !== destination.signature) {
    destination.signature = signature;
    destination.dirty = true; // what's visible (and so eligible) may have changed
  }
  const stale = destination.snap !== null && snapReferencesChanged(destination.snap, destination.containerEl, destination.references);
  if (stale || (destination.dirty && now - destination.lastRefresh >= SNAP_REFRESH_INTERVAL_MS)) refreshTargets(session, destination, now);

  const frame = measureFreeContainerFrame(destination.containerEl);
  const containment = frame.containment;
  // The component's size in this container: its default, fitted by the
  // existing Free placement rule (containment beats the minimum).
  const fitted = normalizeFreeLayoutGeometry({ x: 0, y: 0, ...session.size }, containment, getResizeConstraintsForTag());
  const width = fitted.width;
  const height = fitted.height;
  const maxX = Math.max(0, containment.width - width);
  const maxY = Math.max(0, containment.height - height);
  const offset = { x: session.margin.left ?? 0, y: session.margin.top ?? 0 };

  // The pointer, in the container's local frame, keeps the card's hotspot.
  const localX = (session.pointer.x - frame.originClientX) / frame.scale;
  const localY = (session.pointer.y - frame.originClientY) / frame.scale;
  let x = clampFreeChildAxis(localX - session.hotspot.x * width - offset.x, 0, maxX);
  let y = clampFreeChildAxis(localY - session.hotspot.y * height - offset.y, 0, maxY);

  let guides: ActiveSnapGuides | null = null;
  const snap = destination.snap;
  if (snap && destination.valid) {
    const visual: Rect = { x: x + offset.x, y: y + offset.y, width, height };
    const adjust: SnapAdjust = (box, axis, edge, delta) => {
      const next = translateBox(box, axis, edge, delta);
      if (!next) return null;
      const stored = axis === "x" ? next.x - offset.x : next.y - offset.y;
      const max = axis === "x" ? maxX : maxY;
      return stored < -SNAP_EPSILON || stored > max + SNAP_EPSILON ? null : next;
    };
    const result = resolveSnap({
      box: visual,
      edges: ALL_EDGES,
      index: snap.index,
      spacing: [...computeEqualSpacingCandidates("x", visual, snap.siblingTargets), ...computeEqualSpacingCandidates("y", visual, snap.siblingTargets)],
      enabled: store().snapEnabled && !session.alt,
      lock: destination.lock,
      adjust,
    });
    destination.lock = result.lock;
    destination.references = referencedTargetIds(result);
    x = clampFreeChildAxis(result.box.x - offset.x, 0, maxX);
    y = clampFreeChildAxis(result.box.y - offset.y, 0, maxY);
    guides = buildFreeSnapGuides(snap.containerId, result, { x: x + offset.x, y: y + offset.y, width, height }, snap.rectById, snap.parentRect);
  }

  session.placement = destination.valid ? { containerId: destination.containerId, geometry: { x, y, width, height } } : null;
  publishGuides(session, guides);
  publishPreview(session, {
    containerId: destination.containerId,
    rect: { x: x + offset.x, y: y + offset.y, width, height },
    label: session.label,
    valid: destination.valid,
  });
  return scrolled || destination.dirty;
}

function requestFrame(session: Session) {
  if (current !== session || session.frameId !== null) return;
  session.frameId = requestAnimationFrame((now) => {
    session.frameId = null;
    if (current !== session || session.generation !== generationCounter) return;
    if (computeFrame(session, now, false)) requestFrame(session);
  });
}

/** Cancels the dnd-kit drag through its own Escape path (EditorApp's Escape claim keeps the selection and swallows the release click). */
function cancelDndDrag() {
  window.document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
}

/** Starts the session for one Resource Panel drag. Any earlier session is ended first. */
export function startFreeInsertion(options: FreeInsertionStart): void {
  cancelFreeInsertion();
  interruptedDrag = false;
  const generation = ++generationCounter;
  const startSessionId = store().documentSessionId;

  const onPointer = (event: PointerEvent) => {
    if (current !== session) return;
    session.pointer = { x: event.clientX, y: event.clientY };
    session.alt = event.altKey;
    requestFrame(session);
  };
  const onKey = (event: KeyboardEvent) => {
    if (current !== session || event.key !== "Alt") return;
    event.preventDefault(); // Firefox would toggle its menu bar on release
    session.alt = event.type === "keydown";
    requestFrame(session);
  };
  const onScroll = () => requestFrame(session);
  const onResize = () => {
    if (session.destination) {
      session.destination.dirty = true;
      session.destination.lastRefresh = 0;
    }
    requestFrame(session);
  };
  // dnd-kit doesn't cancel on a window blur; a drag must not survive one.
  const onBlur = () => interrupt();
  const unsubscribe = useEditorStore.subscribe((next, previous) => {
    if (current !== session) return;
    if (next.documentSessionId !== startSessionId || (next.editorMode === "preview" && previous.editorMode !== "preview")) {
      interrupt();
      return;
    }
    if (next.document !== previous.document && session.destination) {
      if (!findNodeById(next.document, session.destination.containerId)) {
        // The destination was deleted: no preview, nothing can be inserted there.
        session.destination = null;
        session.placement = null;
      } else {
        session.destination.dirty = true;
        session.destination.lastRefresh = 0;
      }
      requestFrame(session);
    }
  });
  const unregister = registerActiveInteraction(() => interrupt());

  function interrupt() {
    if (current !== session) return;
    session.interrupted = true;
    interruptedDrag = true;
    endSession(session);
    cancelDndDrag();
  }

  const prototype = options.prototype;
  const session: Session = {
    generation,
    prototype,
    label: options.label,
    size: getDefaultFreeElementSizeForNode(prototype),
    margin: getElementSpacing(prototype).margin,
    hotspot: { x: clamp01(options.hotspot.x), y: clamp01(options.hotspot.y) },
    pointer: { ...options.pointer },
    alt: false,
    destination: null,
    placement: null,
    interrupted: false,
    frameId: null,
    lastFrameTime: null,
    previewKey: "null",
    guidesKey: "null",
    cleanup: () => {
      window.removeEventListener("pointermove", onPointer, true);
      window.removeEventListener("pointerup", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", onBlur);
      unsubscribe();
      unregister();
    },
  };
  current = session;
  window.addEventListener("pointermove", onPointer, { capture: true, passive: true });
  window.addEventListener("pointerup", onPointer, { capture: true, passive: true });
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKey, true);
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("blur", onBlur);
}

/**
 * The drop's current destination, resolved by EditorApp with the shared
 * insertion rule (resolveInsertionParent): a Free container id gets the
 * live preview; anything else (a Flow/Flex/Grid parent, nothing hovered)
 * clears it, and that drop keeps the existing placement.
 */
export function setFreeInsertionDestination(parentId: string | null): void {
  const session = current;
  if (!session) return;
  const document = store().document;
  // An ANCESTOR of the current Free destination doesn't take over while the
  // pointer is still inside that container: dnd-kit's droppable rects can
  // briefly lag while this session auto-scrolls under a stationary pointer,
  // which reports a coarser target. A nested or unrelated container still
  // switches at once.
  const held = session.destination;
  if (held && parentId !== held.containerId && pointerInside(session, held.containerEl)) {
    const isAncestor = parentId !== null && findAncestorChain(document, held.containerId).some((ancestor) => ancestor.id === parentId);
    if (parentId === null || isAncestor) return;
  }
  const parent = parentId ? findNodeById(document, parentId) : undefined;
  const containerEl = parent ? surfaceNode(parent.id) : null;
  const usable =
    parent !== undefined &&
    containerEl !== null &&
    getLayoutMode(parent) === "free" &&
    // Pointer → local px assumes no rotate/scale on the way (the same
    // safety rule that blocks dragging/resizing there): such a container
    // keeps the existing first-available placement.
    !getTransformBlockingAncestor(document, parent.id) &&
    !hasNonIdentityRotateOrScale(getTransformSettings(parent));
  if (!usable || !parent || !containerEl) {
    if (session.destination) {
      session.destination = null;
      session.placement = null;
      publishPreview(session, null);
      publishGuides(session, null);
    }
    return;
  }
  if (session.destination?.containerId === parent.id) return;

  const scrollers = collectScrollContainers(containerEl);
  const destination: Destination = {
    containerId: parent.id,
    containerEl,
    valid: canParentAcceptChild(parent.tag, session.prototype.tag),
    snap: null,
    references: [],
    lock: NO_SNAP_LOCK, // a new context starts without the previous one's locks
    scrollers,
    signature: scrollSignature(scrollers),
    lastRefresh: 0,
    dirty: false,
  };
  session.destination = destination;
  publishGuides(session, null);
  refreshTargets(session, destination, performance.now());
  computeFrame(session, performance.now(), true);
  requestFrame(session);
}

function pointerInside(session: Session, el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const { x, y } = session.pointer;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** Whether a Free destination owns auto-scrolling right now (dnd-kit's own auto-scroll stands down). */
export function isFreeInsertionScrolling(): boolean {
  return current?.destination != null;
}

function endSession(session: Session) {
  if (current !== session) return;
  current = null;
  if (session.frameId !== null) cancelAnimationFrame(session.frameId);
  session.frameId = null;
  session.cleanup();
  store().setFreeInsertionPreview(null);
  store().setActiveSnapGuides(null);
  session.destination = null;
}

/**
 * The drop: processes the final pointer position once more, then ends the
 * session. Returns the placement for the destination (or null: no Free
 * preview, or the destination can't accept it), and whether the drag was
 * interrupted by a command (then nothing may be inserted at all).
 */
export function finishFreeInsertion(): { placement: FreeInsertionPlacement | null; interrupted: boolean } {
  const session = current;
  if (!session) return { placement: null, interrupted: interruptedDrag };
  if (session.frameId !== null) cancelAnimationFrame(session.frameId);
  session.frameId = null;
  if (session.destination && session.destination.containerEl.isConnected) computeFrame(session, performance.now(), true);
  const result = { placement: session.placement, interrupted: session.interrupted };
  endSession(session);
  return result;
}

/** Ends the session without inserting anything (Escape, pointercancel, an unmount…). Idempotent. */
export function cancelFreeInsertion(): void {
  if (current) endSession(current);
}

/** Whether a Resource Panel insertion session is running. */
export function hasActiveFreeInsertion(): boolean {
  return current !== null;
}
