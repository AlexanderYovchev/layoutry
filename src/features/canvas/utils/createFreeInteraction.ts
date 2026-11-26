import { applyAutoScroll, collectScrollContainers, measureScrollers, planAutoScroll } from "@/features/canvas/utils/freeAutoScroll";
import { snapReferencesChanged, type FreeSnapContext } from "@/features/canvas/utils/createFreeSnapContext";
import { measureFreeContainerFrame } from "@/features/canvas/utils/freeLayoutFrame";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";
import { registerActiveInteraction } from "@/features/editor/utils/activeInteraction";
import { findNodeById, findParentId } from "@/features/editor/utils/findNodeById";
import { swallowReleaseClick } from "@/lib/swallowReleaseClick";

/**
 * BC-13.5 — the one lifecycle shared by the Free drag and the eight resize
 * handles (useFreeChildMoveSession, useFreeChildResizeSession). The hooks
 * keep their geometry and snapping math (onFrame); this owns everything
 * around it:
 *
 * - states: active → committed | cancelled | invalidated → cleaned up
 *   (exactly once; every later call is a no-op);
 * - one requestAnimationFrame loop per interaction: auto-scroll step →
 *   scroll compensation → snap-target refresh → the hook's frame; frames
 *   carry the interaction's generation and are dropped once it has ended;
 * - pointerup processes the final pointer position before committing; an
 *   unchanged result records nothing (no-op);
 * - cancellation (Escape, pointercancel, an unexpected lostpointercapture,
 *   window blur / hidden tab, unmount, a recognized editor command — see
 *   below, Preview)
 *   restores ONLY the touched nodes' original freeLayout and drops the
 *   transaction: no history entry, the redo stack and the selection kept;
 * - external invalidation (store subscription): the project replaced
 *   (documentSessionId) → stop without writing anything; the element (or
 *   an ancestor) deleted → stop, nothing recreated, and any history entry
 *   recorded meanwhile gets the committed geometry back; its parent changed
 *   → stop and restore; any other document change → refresh snap targets;
 * - keyboard during an interaction (BC-13.5.1, owner decision Option B):
 *   Escape is consumed (the Canvas never sees it, so the selection stays);
 *   modifier keys only update modifiers; every other key is left alone —
 *   it does NOT cancel. A recognized editor command (Delete, Undo/Redo,
 *   clipboard, Duplicate, Save, New/Open/Close, Preview…) cancels the
 *   interaction from its own execution path, only when it actually runs:
 *   the interaction registers itself (editor/utils/activeInteraction) and
 *   those commands call interruptActiveInteraction() first, so they act on
 *   the committed document, never on uncommitted live geometry.
 */

export type FreeInteractionEndReason =
  | "commit"
  | "no-op"
  | "escape"
  | "pointercancel"
  | "lost-capture"
  | "blur"
  | "command"
  | "unmount"
  | "preview"
  | "deleted"
  | "reparented"
  | "document-replaced"
  | "transaction-closed";

export interface FreeInteractionFrame {
  /** The pointer, compensated for any scrolling since pointer-down (client px; deltas from the start pointer stay correct). */
  pointer: { x: number; y: number };
  alt: boolean;
  shift: boolean;
  /** The current snap context (refreshed when targets may have changed), or null when snapping is unavailable. */
  snap: FreeSnapContext | null;
}

export interface FreeInteractionOptions {
  nodeId: string;
  captureEl: Element;
  pointerId: number;
  startPointer: { x: number; y: number };
  modifiers: { alt: boolean; shift: boolean };
  containerEl: HTMLElement | null;
  /** The nodes the interaction may write, with their geometry before it (undefined = none). */
  originals: ReadonlyMap<string, FreeLayoutGeometry | undefined>;
  /** Measures the snap context now (pointer-down and every refresh); null = no snapping. */
  measureSnap: () => FreeSnapContext | null;
  /** Computes and writes one frame. Returns the snap target ids the current result references (for invalidation). */
  onFrame: (frame: FreeInteractionFrame) => readonly string[];
  /** The hook resets its own UI state (cursor, flags). Called exactly once. */
  onEnd: (reason: FreeInteractionEndReason) => void;
}

export interface FreeInteraction {
  pointerMove: (event: PointerLikeEvent) => void;
  pointerUp: (event: PointerLikeEvent) => void;
  cancel: (reason: FreeInteractionEndReason) => void;
  isActive: () => boolean;
}

export interface PointerLikeEvent {
  clientX: number;
  clientY: number;
  altKey: boolean;
  shiftKey: boolean;
}

/** Scroll-only target refreshes (clipping changes) are throttled to this interval. */
export const SNAP_REFRESH_INTERVAL_MS = 250;

const MODIFIER_KEYS = new Set(["Alt", "AltGraph", "Shift", "Control", "Meta", "OS", "CapsLock", "Fn", "FnLock", "Hyper", "Super", "Symbol", "SymbolLock", "NumLock", "ScrollLock"]);

let generationCounter = 0;

/** Cancellations that happen while the pointer button is still down (its release click follows later). */
const BUTTON_HELD_REASONS: ReadonlySet<FreeInteractionEndReason> = new Set(["escape", "command", "deleted", "reparented", "document-replaced", "preview", "transaction-closed"]);

/** The generation of the interaction currently allowed to write; a frame queued by an earlier one compares unequal and does nothing. */
let activeGeneration = 0;

function sameGeometry(a: FreeLayoutGeometry | undefined, b: FreeLayoutGeometry | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}


export function createFreeInteraction(options: FreeInteractionOptions): FreeInteraction {
  const generation = ++generationCounter;
  const store = useEditorStore.getState();
  store.beginResizeTransaction();
  const transaction = useEditorStore.getState().transactionSnapshot;
  const sessionId = store.documentSessionId;
  const pastLength = store.past.length;
  const parentId = findParentId(store.document, options.nodeId);
  const { containerEl, originals } = options;

  let state: "active" | "ended" = "active";
  let pointer = { ...options.startPointer };
  let modifiers = { ...options.modifiers };
  let moved = false;
  let wrote = false;
  let ownWrite = false;
  let frameId: number | null = null;
  let lastFrameTime: number | null = null;
  let snap: FreeSnapContext | null = null;
  let references: readonly string[] = [];
  let targetsDirty = false;
  let lastRefresh = 0;

  const startOrigin = containerEl ? measureFreeContainerFrame(containerEl) : null;
  const scrollers = collectScrollContainers(containerEl ?? (options.captureEl instanceof HTMLElement ? options.captureEl : null));
  const scrollSignature = () => scrollers.map((el) => `${el.scrollLeft},${el.scrollTop}`).join("|");
  let lastSignature = scrollSignature();

  const withOwnWrite = (write: () => void) => {
    ownWrite = true;
    try {
      write();
    } finally {
      ownWrite = false;
    }
  };

  snap = options.measureSnap();
  lastRefresh = performance.now();

  /** The area the element can move in (its Free container's padding box, client px): auto-scroll only reveals more of it. */
  function measureReach() {
    if (!containerEl) return null;
    const rect = containerEl.getBoundingClientRect();
    const left = rect.left + containerEl.clientLeft;
    const top = rect.top + containerEl.clientTop;
    return { left, top, right: left + containerEl.clientWidth, bottom: top + containerEl.clientHeight };
  }

  /** Whether a referenced target (or the parent) moved, resized, vanished or was hidden since it was measured. */
  function referencesChanged(): boolean {
    return snap !== null && containerEl !== null && snapReferencesChanged(snap, containerEl, references);
  }

  function runFrame(now: number, final = false) {
    // Auto-scroll first, so this frame's geometry already sees the new scroll.
    let scrolled = false;
    if (!final && scrollers.length > 0) {
      const elapsed = lastFrameTime === null ? 16 : now - lastFrameTime;
      scrolled = applyAutoScroll(scrollers, planAutoScroll(pointer, measureScrollers(scrollers), elapsed, measureReach()));
    }
    lastFrameTime = now;

    const signature = scrollSignature();
    if (signature !== lastSignature) {
      lastSignature = signature;
      targetsDirty = true; // clipping (visibility) may have changed
    }
    const referencesStale = referencesChanged();
    if (referencesStale || (targetsDirty && now - lastRefresh >= SNAP_REFRESH_INTERVAL_MS)) {
      snap = options.measureSnap();
      references = [];
      targetsDirty = false;
      lastRefresh = now;
    }

    let compensated = pointer;
    if (containerEl && startOrigin) {
      const frame = measureFreeContainerFrame(containerEl);
      compensated = { x: pointer.x - (frame.originClientX - startOrigin.originClientX), y: pointer.y - (frame.originClientY - startOrigin.originClientY) };
    }
    if (moved || scrolled || compensated.x !== pointer.x || compensated.y !== pointer.y) {
      withOwnWrite(() => {
        references = options.onFrame({ pointer: compensated, alt: modifiers.alt, shift: modifiers.shift, snap });
      });
      wrote = true;
    }
    return scrolled || targetsDirty;
  }

  function requestFrame() {
    if (state !== "active" || frameId !== null) return;
    frameId = requestAnimationFrame((now) => {
      frameId = null;
      if (state !== "active" || generation !== currentGeneration()) return;
      const again = runFrame(now);
      if (again) requestFrame();
    });
  }

  activeGeneration = generation;
  function currentGeneration() {
    return activeGeneration;
  }

  function nodesUnchanged(): boolean {
    const document = useEditorStore.getState().document;
    for (const [id, original] of originals) {
      if (!sameGeometry(findNodeById(document, id)?.freeLayout, original)) return false;
    }
    return true;
  }

  function cleanup(reason: FreeInteractionEndReason) {
    state = "ended";
    if (activeGeneration === generation) activeGeneration = 0;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("dragstart", onNativeDragStart, true);
    document.body.style.userSelect = previousUserSelect;
    window.removeEventListener("scroll", onScroll, true);
    document.removeEventListener("visibilitychange", onVisibility);
    options.captureEl.removeEventListener("lostpointercapture", onLostCapture);
    unsubscribe();
    unregister();
    try {
      if (options.captureEl.hasPointerCapture?.(options.pointerId)) options.captureEl.releasePointerCapture(options.pointerId);
    } catch {
      // The element may already be detached (deleted mid-gesture).
    }
    useEditorStore.getState().setActiveSnapGuides(null);
    snap = null;
    references = [];
    options.onEnd(reason);
  }

  const ownsTransaction = () => transaction !== null && useEditorStore.getState().transactionSnapshot === transaction;

  function cancel(reason: FreeInteractionEndReason, restore = true) {
    if (state !== "active") return;
    state = "ended";
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    const current = useEditorStore.getState();
    if (restore && current.documentSessionId === sessionId) withOwnWrite(() => current.restoreFreeLayoutsLive(originals));
    if (ownsTransaction()) useEditorStore.getState().cancelResizeTransaction();
    // Cancelled with the button still held: the click its release produces
    // (now uncaptured, on whatever is under the pointer) must not change the
    // selection.
    if (BUTTON_HELD_REASONS.has(reason)) swallowReleaseClick();
    cleanup(reason);
  }

  /** An external change made the interaction invalid: stop without restoring into a context that no longer matches. */
  function invalidate(reason: FreeInteractionEndReason, restoreDocument: boolean) {
    if (state !== "active") return;
    const current = useEditorStore.getState();
    // Entries recorded meanwhile (e.g. the deletion) must never carry the uncommitted geometry.
    if (current.documentSessionId === sessionId && current.past.length > pastLength) withOwnWrite(() => current.restoreFreeLayoutsInHistory(originals, pastLength));
    cancel(reason, restoreDocument);
  }

  function pointerUp(event: PointerLikeEvent) {
    if (state !== "active") return;
    if (event.clientX !== pointer.x || event.clientY !== pointer.y) {
      pointer = { x: event.clientX, y: event.clientY };
      moved = true;
    }
    modifiers = { alt: event.altKey, shift: event.shiftKey };
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    if (moved) runFrame(lastFrameTime ?? performance.now(), true);
    state = "ended";
    if (!wrote || nodesUnchanged()) {
      // Nothing changed (a plain click, or back where it started): no history.
      if (wrote) withOwnWrite(() => useEditorStore.getState().restoreFreeLayoutsLive(originals));
      if (ownsTransaction()) useEditorStore.getState().cancelResizeTransaction();
      cleanup("no-op");
      return;
    }
    if (ownsTransaction()) useEditorStore.getState().commitResizeTransaction();
    cleanup("commit");
  }

  function pointerMove(event: PointerLikeEvent) {
    if (state !== "active") return;
    if (event.clientX !== pointer.x || event.clientY !== pointer.y) moved = true;
    pointer = { x: event.clientX, y: event.clientY };
    modifiers = { alt: event.altKey, shift: event.shiftKey };
    requestFrame();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (state !== "active") return;
    if (event.key === "Escape") {
      // Consumed here: the Canvas's Escape-clears-the-selection never runs.
      event.preventDefault();
      event.stopPropagation();
      cancel("escape");
      return;
    }
    if (MODIFIER_KEYS.has(event.key)) {
      if (event.key === "Alt") event.preventDefault(); // Firefox would toggle its menu bar on release
      modifiers = { alt: event.altKey, shift: event.shiftKey };
      requestFrame();
      return;
    }
    // Any other key is not ours: it neither cancels nor is suppressed. A key
    // that resolves to an editor command cancels through that command's own
    // execution path (interruptActiveInteraction), and only if it runs.
  }

  function onKeyUp(event: KeyboardEvent) {
    if (state !== "active" || !MODIFIER_KEYS.has(event.key)) return;
    if (event.key === "Alt") event.preventDefault();
    modifiers = { alt: event.altKey, shift: event.shiftKey };
    requestFrame();
  }

  const onBlur = () => cancel("blur");
  const onVisibility = () => {
    if (document.visibilityState === "hidden") cancel("blur");
  };
  // A normal release ends the interaction first (pointerup), so the
  // lostpointercapture that follows finds it ended and does nothing.
  const onLostCapture = () => cancel("lost-capture");
  const onScroll = () => requestFrame();
  // A native drag-and-drop (e.g. of text selected earlier) would cancel the
  // pointer stream (pointercancel → rollback): never start one mid-gesture.
  const onNativeDragStart = (event: DragEvent) => event.preventDefault();
  // A layout change (window resize) can clip or reveal targets without any
  // scroll: refresh them on the next frame (BC-13.5.1, D19).
  const onResize = () => {
    targetsDirty = true;
    lastRefresh = 0;
    requestFrame();
  };

  const unsubscribe = useEditorStore.subscribe((next, previous) => {
    if (state !== "active" || ownWrite) return;
    if (next.documentSessionId !== sessionId) return invalidate("document-replaced", false);
    if (next.editorMode === "preview" && previous.editorMode !== "preview") return invalidate("preview", true);
    if (next.document !== previous.document) {
      if (!findNodeById(next.document, options.nodeId)) return invalidate("deleted", false);
      if (findParentId(next.document, options.nodeId) !== parentId) return invalidate("reparented", true);
      targetsDirty = true;
      lastRefresh = 0; // a document change refreshes targets on the next frame
      requestFrame();
    }
    if (transaction !== null && next.transactionSnapshot !== transaction && previous.transactionSnapshot === transaction) {
      return invalidate("transaction-closed", true);
    }
  });

  // Recognized editor commands end this interaction before they run.
  const unregister = registerActiveInteraction(() => cancel("command"));

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("blur", onBlur);
  window.addEventListener("resize", onResize);
  window.addEventListener("dragstart", onNativeDragStart, true);
  // No text selection while dragging a (text) element: a selection left in it
  // would turn the NEXT press into a native drag-and-drop (BC-13.5.1).
  const previousUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  options.captureEl.addEventListener("lostpointercapture", onLostCapture);

  return { pointerMove, pointerUp, cancel: (reason) => cancel(reason), isActive: () => state === "active" };
}

