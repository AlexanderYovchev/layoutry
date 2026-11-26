import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFreeChildMoveSession } from "@/features/canvas/hooks/useFreeChildMoveSession";
import { useFreeChildResizeSession } from "@/features/canvas/hooks/useFreeChildResizeSession";
import { selectHasUnsavedChanges, useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { useEditorKeyboardShortcuts } from "@/features/editor/hooks/useEditorKeyboardShortcuts";
import { findNodeById } from "@/features/editor/utils/findNodeById";

/*
 * BC-13.5 — the shared Free interaction lifecycle (createFreeInteraction),
 * exercised through the real drag and resize hooks: every terminal path
 * (commit, Escape, pointercancel, lost capture, blur, commands, unmount,
 * deletion, reparenting, project replacement, Preview), exact node-scoped
 * rollback, history integrity (one entry, none on cancel, redo kept),
 * stale-frame protection, scroll compensation, target invalidation and
 * listener cleanup. Touch/pen are SIMULATED (pointerType on synthetic
 * events), not physical devices.
 */

const initialState = useEditorStore.getState();

type Box = { left: number; top: number; right: number; bottom: number };

function stubRect(el: Element, box: Box) {
  return vi.spyOn(el, "getBoundingClientRect").mockImplementation(() => ({
    ...box,
    width: box.right - box.left,
    height: box.bottom - box.top,
    x: box.left,
    y: box.top,
    toJSON: () => box,
  }));
}

function Harness({ targets }: { targets: string[] }) {
  const move = useFreeChildMoveSession("a");
  const resize = useFreeChildResizeSession("a");
  useEditorKeyboardShortcuts(); // the real editor shortcut dispatch (BC-13.5.1)
  return (
    <div data-testid="clip">
    <input data-testid="field" />
    <div data-node-id="free" data-testid="container">
      <div
        data-testid="a"
        data-node-id="a"
        data-node-type="div"
        onPointerDown={move.onPointerDown}
        onPointerMove={move.onPointerMove}
        onPointerUp={move.onPointerUp}
        onPointerCancel={move.onPointerCancel}
      />
      {targets.map((id) => (
        <div key={id} data-node-id={id} data-testid={id} />
      ))}
      <div
        data-testid="handle-e"
        onPointerDown={resize.onHandlePointerDown("e", { startX: 100, startY: 100, startWidth: 40, startHeight: 40 })}
        onPointerMove={resize.onHandlePointerMove}
        onPointerUp={resize.onHandlePointerUp}
        onPointerCancel={resize.onHandlePointerCancel}
      />
    </div>
    </div>
  );
}

const ORIGINAL = { x: 100, y: 100, width: 40, height: 40 };

function seed(extra: EditorElementNode[] = [], outer: Partial<EditorElementNode> = {}) {
  useEditorStore.setState((state) => ({
    document: {
      ...state.document,
      children: [
        {
          id: "wrap",
          tag: "div",
          ...outer,
          children: [
            {
              id: "free",
              tag: "div",
              layoutMode: "free",
              children: [{ id: "a", tag: "div", freeLayout: { ...ORIGINAL } }, ...extra],
            },
          ],
        },
        { id: "other-free", tag: "div", layoutMode: "free", children: [] },
      ],
    },
  }));
}

describe("createFreeInteraction (BC-13.5)", () => {
  let frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const flush = () => {
    const pending = [...frames.values()];
    frames = new Map();
    for (const callback of pending) callback(performance.now());
  };

  beforeEach(() => {
    frames = new Map();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  /** Container 500×400 at the origin; "a" at 100,100 40×40; optional measured targets. */
  function setup(targets: Record<string, Box> = {}) {
    const view = render(<Harness targets={Object.keys(targets)} />);
    const containerEl = view.getByTestId("container");
    const containerRect = stubRect(containerEl, { left: 0, top: 0, right: 500, bottom: 400 });
    Object.defineProperty(containerEl, "clientWidth", { value: 500, configurable: true });
    Object.defineProperty(containerEl, "clientHeight", { value: 400, configurable: true });
    // The dragged element renders where its live geometry says (relative to the container).
    vi.spyOn(view.getByTestId("a"), "getBoundingClientRect").mockImplementation(() => {
      const g = findNodeById(useEditorStore.getState().document, "a")?.freeLayout ?? ORIGINAL;
      const origin = containerEl.getBoundingClientRect();
      const box = { left: origin.left + g.x, top: origin.top + g.y, right: origin.left + g.x + g.width, bottom: origin.top + g.y + g.height };
      return { ...box, width: g.width, height: g.height, x: box.left, y: box.top, toJSON: () => box };
    });
    const targetSpies = new Map(Object.entries(targets).map(([id, box]) => [id, stubRect(view.getByTestId(id), box)]));
    return { ...view, a: view.getByTestId("a"), handle: view.getByTestId("handle-e"), containerEl, containerRect, targetSpies };
  }

  const geometry = (id = "a") => findNodeById(useEditorStore.getState().document, id)?.freeLayout;
  const past = () => useEditorStore.getState().past.length;
  const guides = () => useEditorStore.getState().activeSnapGuides;
  /** Pointer starts at (120,120); a move to (x,y) puts the stored x at 100 + (x − 120). */
  const down = (el: HTMLElement, init: Record<string, unknown> = {}) => fireEvent.pointerDown(el, { clientX: 120, clientY: 120, pointerId: 1, ...init });
  const move = (el: HTMLElement, x: number, y: number) => {
    fireEvent.pointerMove(el, { clientX: x, clientY: y, pointerId: 1 });
    flush();
  };

  describe("cancellation (D21)", () => {
    it("Escape after several live frames restores the exact geometry, keeps the selection and the redo stack, records nothing, and is consumed", () => {
      seed();
      useEditorStore.getState().setFreeChildGeometry("a", { x: 10, y: 10, width: 40, height: 40 });
      useEditorStore.getState().undo(); // one redo entry to preserve
      useEditorStore.getState().selectOnly("a");
      const { a } = setup();
      const bubbled = vi.fn();
      window.addEventListener("keydown", bubbled);
      down(a);
      for (const x of [140, 170, 230]) move(a, x, 150);
      expect(geometry()).not.toEqual(ORIGINAL);
      const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      window.dispatchEvent(escape);
      window.removeEventListener("keydown", bubbled);
      expect(geometry()).toEqual(ORIGINAL);
      expect(useEditorStore.getState().selection.ids).toEqual(["a"]);
      expect(past()).toBe(0);
      expect(useEditorStore.getState().future).toHaveLength(1);
      expect(useEditorStore.getState().transactionSnapshot).toBeNull();
      expect(guides()).toBeNull();
      expect(escape.defaultPrevented).toBe(true); // the Canvas's deselect skips it
      expect(bubbled).not.toHaveBeenCalled(); // and never even sees it
    });

    it("the click produced by releasing the button after an Escape is swallowed (it can't change the selection); later clicks are not", () => {
      seed();
      const { a } = setup();
      const clicks = vi.fn();
      window.addEventListener("click", clicks);
      down(a);
      move(a, 200, 200);
      fireEvent.keyDown(window, { key: "Escape" });
      fireEvent.pointerUp(document.body, { clientX: 200, clientY: 200, pointerId: 1 });
      fireEvent.click(document.body);
      expect(clicks).not.toHaveBeenCalled();
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          fireEvent.click(document.body);
          window.removeEventListener("click", clicks);
          expect(clicks).toHaveBeenCalledTimes(1);
          resolve();
        }, 5),
      );
    });

    it("Escape during a resize restores it too", () => {
      seed();
      const { handle } = setup();
      down(handle);
      move(handle, 200, 120);
      expect(geometry()?.width).toBe(120);
      fireEvent.keyDown(window, { key: "Escape" });
      expect(geometry()).toEqual(ORIGINAL);
      expect(past()).toBe(0);
    });

    it.each(["touch", "pen", "mouse"])("pointercancel (%s, simulated) rolls the drag back instead of committing", (pointerType) => {
      seed();
      const { a } = setup();
      down(a, { pointerType });
      move(a, 200, 200);
      fireEvent.pointerCancel(a, { pointerId: 1, pointerType });
      expect(geometry()).toEqual(ORIGINAL);
      expect(past()).toBe(0);
    });

    it("an unexpected lostpointercapture rolls back; the one that follows a normal release does not", () => {
      seed();
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      fireEvent(a, new Event("lostpointercapture"));
      expect(geometry()).toEqual(ORIGINAL);
      expect(past()).toBe(0);

      down(a);
      move(a, 200, 200);
      fireEvent.pointerUp(a, { clientX: 200, clientY: 200, pointerId: 1 });
      fireEvent(a, new Event("lostpointercapture"));
      expect(geometry()).toEqual({ x: 180, y: 180, width: 40, height: 40 });
      expect(past()).toBe(1); // committed exactly once
    });

    it("window blur rolls back; repeated cancellations are harmless", () => {
      seed();
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      window.dispatchEvent(new Event("blur"));
      fireEvent.pointerCancel(a, { pointerId: 1 });
      fireEvent.keyDown(window, { key: "Escape" });
      fireEvent.pointerUp(a, { clientX: 300, clientY: 300, pointerId: 1 });
      expect(geometry()).toEqual(ORIGINAL);
      expect(past()).toBe(0);
    });

    it("unmounting mid-drag rolls back", () => {
      seed();
      const { a, unmount } = setup();
      down(a);
      move(a, 200, 200);
      unmount();
      expect(geometry()).toEqual(ORIGINAL);
      expect(past()).toBe(0);
      expect(useEditorStore.getState().transactionSnapshot).toBeNull();
    });
  });

  describe("keyboard policy (BC-13.5.1, Option B) — through the real editor shortcuts", () => {
    const key = (init: KeyboardEventInit, target: EventTarget = window) => {
      const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };
    const live = () => useEditorStore.getState().transactionSnapshot !== null;
    const MOVED = { x: 180, y: 180, width: 40, height: 40 };

    it.each([
      ["an unassigned letter", { key: "q" }],
      ["an unassigned number", { key: "7" }],
      ["unassigned punctuation", { key: "." }],
      ["an unsupported Ctrl combination", { key: "k", ctrlKey: true }],
      ["an unsupported Ctrl+Shift combination", { key: "x", ctrlKey: true, shiftKey: true }],
      ["Ctrl alone", { key: "Control", ctrlKey: true }],
      ["Meta alone", { key: "Meta", metaKey: true }],
      ["Alt", { key: "Alt", altKey: true }],
      ["Shift", { key: "Shift", shiftKey: true }],
    ])("%s does not cancel the drag (and isn't suppressed unless it's a modifier we handle)", (_label, init) => {
      seed();
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      const event = key(init);
      expect(live()).toBe(true);
      expect(geometry()).toEqual(MOVED);
      if (!["Alt"].includes(String(init.key))) expect(event.defaultPrevented).toBe(false);
      fireEvent.pointerUp(a, { clientX: 200, clientY: 200, pointerId: 1 });
      expect(geometry()).toEqual(MOVED);
      expect(past()).toBe(1);
    });

    it("an unassigned key does not cancel a resize either", () => {
      seed();
      const { handle } = setup();
      down(handle);
      move(handle, 200, 120);
      key({ key: "g" });
      expect(live()).toBe(true);
      fireEvent.pointerUp(handle, { clientX: 200, clientY: 120, pointerId: 1 });
      expect(geometry()?.width).toBe(120);
      expect(past()).toBe(1);
    });

    it.each([
      ["drag", "a"],
      ["resize", "handle-e"],
    ])("Delete during a %s: rolled back first, then deleted once; Undo brings the element back at its committed geometry", (_label, testId) => {
      seed();
      useEditorStore.getState().selectOnly("a");
      const view = setup();
      const el = view.getByTestId(testId);
      down(el);
      move(el, 200, 200);
      key({ key: "Delete" });
      expect(findNodeById(useEditorStore.getState().document, "a")).toBeUndefined();
      expect(past()).toBe(1); // the deletion only
      expect(live()).toBe(false);
      fireEvent.pointerUp(el, { clientX: 220, clientY: 220, pointerId: 1 });
      expect(past()).toBe(1);
      useEditorStore.getState().undo();
      expect(geometry()).toEqual(ORIGINAL);
    });

    it("Undo (Ctrl+Z) cancels first and then undoes the last COMMITTED edit, exactly once; the redo stack is intact", () => {
      seed();
      useEditorStore.getState().setFreeChildGeometry("a", { x: 10, y: 10, width: 40, height: 40 }); // committed edit
      const { a } = setup();
      down(a, { clientX: 30, clientY: 30 });
      fireEvent.pointerMove(a, { clientX: 110, clientY: 110, pointerId: 1 });
      flush();
      key({ key: "z", ctrlKey: true });
      expect(geometry()).toEqual(ORIGINAL); // the edit before it, not the drag
      expect(past()).toBe(0);
      expect(useEditorStore.getState().future).toHaveLength(1);
      fireEvent.pointerUp(a, { clientX: 150, clientY: 150, pointerId: 1 });
      expect(geometry()).toEqual(ORIGINAL);
      useEditorStore.getState().redo();
      expect(geometry()).toEqual({ x: 10, y: 10, width: 40, height: 40 });
    });

    it("Redo (Ctrl+Shift+Z and Ctrl+Y) cancels first and redoes exactly once", () => {
      seed();
      useEditorStore.getState().setFreeChildGeometry("a", { x: 10, y: 10, width: 40, height: 40 });
      useEditorStore.getState().undo();
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      key({ key: "Z", ctrlKey: true, shiftKey: true });
      expect(geometry()).toEqual({ x: 10, y: 10, width: 40, height: 40 });
      expect(past()).toBe(1);
      expect(useEditorStore.getState().future).toHaveLength(0);
      useEditorStore.getState().undo();
      down(a);
      move(a, 200, 200);
      key({ key: "y", ctrlKey: true });
      expect(geometry()).toEqual({ x: 10, y: 10, width: 40, height: 40 });
      expect(past()).toBe(1);
    });

    it("disabled commands don't cancel: Ctrl+Z / Ctrl+Y with no history, Ctrl+C / Ctrl+D / Delete with nothing selected, Ctrl+V with an empty clipboard", () => {
      seed();
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      for (const init of [{ key: "z", ctrlKey: true }, { key: "y", ctrlKey: true }, { key: "c", ctrlKey: true }, { key: "d", ctrlKey: true }, { key: "v", ctrlKey: true }, { key: "Delete" }]) {
        key(init);
        expect(live()).toBe(true);
      }
      fireEvent.pointerUp(a, { clientX: 200, clientY: 200, pointerId: 1 });
      expect(geometry()).toEqual(MOVED);
      expect(past()).toBe(1);
    });

    it("Copy (Ctrl+C) cancels first: the clipboard holds the COMMITTED geometry; Paste and Duplicate then act on it too", () => {
      seed();
      useEditorStore.getState().selectOnly("a");
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      key({ key: "c", ctrlKey: true });
      expect(live()).toBe(false);
      expect(geometry()).toEqual(ORIGINAL);
      expect(useEditorStore.getState().clipboard?.nodes[0].freeLayout).toEqual(ORIGINAL);

      useEditorStore.getState().selectOnly("a");
      down(a);
      move(a, 200, 200);
      key({ key: "d", ctrlKey: true }); // duplicate
      expect(live()).toBe(false);
      const free = findNodeById(useEditorStore.getState().document, "free")!;
      expect(free.children!.map((c) => c.freeLayout)).toEqual([ORIGINAL, expect.objectContaining({ width: 40, height: 40 })]);
      expect(free.children![0].freeLayout).toEqual(ORIGINAL);
      expect(past()).toBe(1); // the duplicate only
    });

    it("Cut (Ctrl+X) cancels first and cuts the committed element; exactly one entry", () => {
      seed();
      useEditorStore.getState().selectOnly("a");
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      key({ key: "x", ctrlKey: true });
      expect(findNodeById(useEditorStore.getState().document, "a")).toBeUndefined();
      expect(useEditorStore.getState().clipboard?.nodes[0].freeLayout).toEqual(ORIGINAL);
      fireEvent.pointerUp(a, { clientX: 200, clientY: 200, pointerId: 1 });
      expect(past()).toBe(1);
    });

    it("focus restrictions are unchanged: Delete typed into a text field is the field's — no cancel, nothing deleted", () => {
      seed();
      useEditorStore.getState().selectOnly("a");
      const { a, getByTestId } = setup();
      const field = getByTestId("field");
      down(a);
      move(a, 200, 200);
      key({ key: "Delete" }, field);
      expect(live()).toBe(true);
      expect(findNodeById(useEditorStore.getState().document, "a")).toBeDefined();
    });

    it("Escape is still consumed and cancels (drag and resize), with the selection kept", () => {
      seed();
      useEditorStore.getState().selectOnly("a");
      const { a, handle } = setup();
      down(a);
      move(a, 200, 200);
      expect(key({ key: "Escape" }).defaultPrevented).toBe(true);
      expect(geometry()).toEqual(ORIGINAL);
      down(handle);
      move(handle, 200, 120);
      expect(key({ key: "Escape" }).defaultPrevented).toBe(true);
      expect(geometry()).toEqual(ORIGINAL);
      expect(useEditorStore.getState().selection.ids).toEqual(["a"]);
      expect(past()).toBe(0);
    });

    it("the project-replacing path and Preview interrupt BEFORE they run: replaceDocument restores the outgoing document first", () => {
      seed();
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      let outgoing: unknown;
      const unsubscribe = useEditorStore.subscribe((next, previous) => {
        if (next.documentSessionId !== previous.documentSessionId) outgoing = findNodeById(previous.document, "a")?.freeLayout;
      });
      useEditorStore.getState().replaceDocument({ id: "p2", tag: "page", children: [] });
      unsubscribe();
      expect(outgoing).toEqual(ORIGINAL); // the outgoing document had its committed geometry back first
    });
  });

  describe("outstanding lifecycle verification (BC-13.5.1)", () => {
    it("no text selection during a gesture (body user-select none, restored after) and a native dragstart mid-gesture is prevented", () => {
      seed();
      const { a } = setup();
      document.body.style.userSelect = "text";
      down(a);
      move(a, 200, 200);
      expect(document.body.style.userSelect).toBe("none");
      const drag = new Event("dragstart", { bubbles: true, cancelable: true });
      a.dispatchEvent(drag);
      expect(drag.defaultPrevented).toBe(true);
      fireEvent.pointerUp(a, { clientX: 200, clientY: 200, pointerId: 1 });
      expect(document.body.style.userSelect).toBe("text");
      const later = new Event("dragstart", { bubbles: true, cancelable: true });
      a.dispatchEvent(later);
      expect(later.defaultPrevented).toBe(false);
      document.body.style.userSelect = "";
    });

    it("a cancelled (or back-to-start) gesture on a saved document leaves it saved: the rolled-back document IS the original object", () => {
      seed();
      useEditorStore.getState().markDocumentPersisted(useEditorStore.getState().document);
      const unsaved = () => selectHasUnsavedChanges(useEditorStore.getState());
      const { a, handle } = setup();
      down(a);
      move(a, 200, 200);
      expect(unsaved()).toBe(true); // live geometry
      fireEvent.keyDown(window, { key: "Escape" });
      expect(unsaved()).toBe(false);
      down(handle);
      move(handle, 200, 120);
      fireEvent(handle, new Event("lostpointercapture"));
      expect(unsaved()).toBe(false);
      down(a);
      move(a, 250, 250);
      fireEvent.pointerUp(a, { clientX: 120, clientY: 120, pointerId: 1 }); // back where it started: no-op
      expect(unsaved()).toBe(false);
    });

    it.each([
      ["drag", "a"],
      ["resize", "handle-e"],
    ])("redo survives a cancelled %s after several live frames, and Redo then restores the expected committed state", (_label, testId) => {
      seed();
      useEditorStore.getState().setFreeChildGeometry("a", { x: 10, y: 10, width: 40, height: 40 });
      useEditorStore.getState().undo();
      const view = setup();
      const el = view.getByTestId(testId);
      down(el);
      for (const x of [150, 180, 210]) move(el, x, 150);
      fireEvent.keyDown(window, { key: "Escape" });
      expect(geometry()).toEqual(ORIGINAL);
      expect(useEditorStore.getState().future).toHaveLength(1);
      useEditorStore.getState().redo();
      expect(geometry()).toEqual({ x: 10, y: 10, width: 40, height: 40 });
      expect(past()).toBe(1);
    });

    it("an unexpected lostpointercapture during a RESIZE rolls back, keeps the selection, clears guides, records nothing; a normal release then lostpointercapture commits once", () => {
      seed([{ id: "t", tag: "div", freeLayout: { x: 300, y: 20, width: 40, height: 40 } }]);
      useEditorStore.getState().selectOnly("a");
      const { handle } = setup({ t: { left: 300, top: 20, right: 340, bottom: 60 } });
      down(handle);
      move(handle, 278, 120); // raw right 298 → snaps to 300 (guide shown)
      expect(guides()).not.toBeNull();
      fireEvent(handle, new Event("lostpointercapture"));
      expect(geometry()).toEqual(ORIGINAL);
      expect(guides()).toBeNull();
      expect(useEditorStore.getState().selection.ids).toEqual(["a"]);
      expect(past()).toBe(0);

      down(handle);
      move(handle, 200, 120);
      fireEvent.pointerUp(handle, { clientX: 200, clientY: 120, pointerId: 1 });
      fireEvent(handle, new Event("lostpointercapture"));
      expect(geometry()?.width).toBe(120);
      expect(past()).toBe(1);
    });

    it("a target that becomes completely clipped by a scrolling ancestor mid-drag stops being a target (its lock released, no guide)", () => {
      seed([{ id: "t", tag: "div", freeLayout: { x: 300, y: 20, width: 40, height: 40 } }]);
      const { a, containerRect, getByTestId, targetSpies } = setup({ t: { left: 300, top: 20, right: 340, bottom: 60 } });
      const clip = getByTestId("clip");
      clip.style.overflowX = "auto";
      clip.style.overflowY = "auto";
      stubRect(clip, { left: 0, top: 0, right: 1000, bottom: 300 });
      Object.defineProperty(clip, "clientWidth", { value: 1000, configurable: true });
      Object.defineProperty(clip, "clientHeight", { value: 300, configurable: true });
      let now = 1000;
      vi.spyOn(performance, "now").mockImplementation(() => now);
      down(a, { clientY: 260 }); // grab low on the element so it can stay in view
      move(a, 318, 260);
      expect(geometry()!.x).toBe(300);
      // The clip scrolls down 100px: the container (and t inside it) moves up; t (local y 20..60) is now above the clip's top edge.
      Object.defineProperty(clip, "scrollTop", { value: 100, configurable: true });
      containerRect.mockImplementation(() => ({ left: 0, top: -100, right: 500, bottom: 300, width: 500, height: 400, x: 0, y: -100, toJSON: () => ({}) }));
      targetSpies.get("t")!.mockImplementation(() => ({ left: 300, top: -80, right: 340, bottom: -40, width: 40, height: 40, x: 300, y: -80, toJSON: () => ({}) }));
      window.dispatchEvent(new Event("scroll"));
      now += 300; // past the scroll-refresh throttle
      flush();
      move(a, 318, 261);
      expect(geometry()!.x).toBe(298);
      expect(guides()?.vertical).toBeUndefined();
    });

    it("a window resize that clips a target (no scroll, no document change) refreshes targets too", () => {
      seed([{ id: "t", tag: "div", freeLayout: { x: 300, y: 20, width: 40, height: 40 } }]);
      const { a, getByTestId } = setup({ t: { left: 300, top: 20, right: 340, bottom: 60 } });
      const clip = getByTestId("clip");
      clip.style.overflowX = "hidden";
      clip.style.overflowY = "hidden";
      const clipRect = stubRect(clip, { left: 0, top: 0, right: 1000, bottom: 1000 });
      Object.defineProperty(clip, "clientWidth", { value: 1000, configurable: true });
      Object.defineProperty(clip, "clientHeight", { value: 1000, configurable: true });
      down(a);
      move(a, 318, 150);
      expect(geometry()!.x).toBe(300);
      clipRect.mockImplementation(() => ({ left: 0, top: 0, right: 250, bottom: 1000, width: 250, height: 1000, x: 0, y: 0, toJSON: () => ({}) }));
      Object.defineProperty(clip, "clientWidth", { value: 250, configurable: true });
      window.dispatchEvent(new Event("resize"));
      flush();
      move(a, 318, 151);
      expect(geometry()!.x).toBe(298);
    });
  });

  describe("frames and transactions (D27, D12, D28)", () => {
    it("a frame still queued when the drag is cancelled never writes", () => {
      seed();
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      fireEvent.pointerMove(a, { clientX: 260, clientY: 260, pointerId: 1 }); // queued, not flushed
      fireEvent.keyDown(window, { key: "Escape" });
      flush();
      expect(geometry()).toEqual(ORIGINAL);
    });

    it("rapid moves then a release: the release position is committed, once", () => {
      seed();
      const { a } = setup();
      down(a);
      for (const x of [130, 150, 170]) fireEvent.pointerMove(a, { clientX: x, clientY: 120, pointerId: 1 });
      fireEvent.pointerUp(a, { clientX: 230, clientY: 160, pointerId: 1 }); // no frame ran yet
      expect(geometry()).toEqual({ x: 210, y: 140, width: 40, height: 40 });
      expect(past()).toBe(1);
      useEditorStore.getState().undo();
      expect(geometry()).toEqual(ORIGINAL);
      useEditorStore.getState().redo();
      expect(geometry()).toEqual({ x: 210, y: 140, width: 40, height: 40 });
    });

    it("a drag that ends where it started records nothing (no-op)", () => {
      seed();
      const { a } = setup();
      down(a);
      move(a, 250, 250);
      fireEvent.pointerUp(a, { clientX: 120, clientY: 120, pointerId: 1 });
      expect(geometry()).toEqual(ORIGINAL);
      expect(past()).toBe(0);
    });

    it("leaves no listener behind once the interaction ends", () => {
      seed();
      const { a } = setup();
      const added = vi.spyOn(window, "addEventListener");
      const removed = vi.spyOn(window, "removeEventListener");
      down(a);
      move(a, 200, 200);
      fireEvent.pointerUp(a, { clientX: 200, clientY: 200, pointerId: 1 });
      const types = (spy: typeof added) => spy.mock.calls.map((call) => String(call[0])).filter((t) => ["keydown", "keyup", "blur", "scroll"].includes(t)).sort();
      expect(types(removed)).toEqual(types(added));
      expect(types(added).length).toBeGreaterThan(0);
    });
  });

  describe("document integrity (D47, D49)", () => {
    it("deleting the dragged element ends the drag: nothing recreated, no drag entry, and undoing the delete brings back the COMMITTED geometry", () => {
      seed();
      useEditorStore.getState().selectOnly("a");
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      useEditorStore.getState().deleteSelection();
      expect(geometry()).toBeUndefined();
      fireEvent.pointerMove(a, { clientX: 260, clientY: 260, pointerId: 1 });
      flush();
      fireEvent.pointerUp(a, { clientX: 260, clientY: 260, pointerId: 1 });
      expect(findNodeById(useEditorStore.getState().document, "a")).toBeUndefined();
      expect(past()).toBe(1); // the deletion only
      expect(useEditorStore.getState().transactionSnapshot).toBeNull();
      expect(guides()).toBeNull();
      useEditorStore.getState().undo();
      expect(geometry()).toEqual(ORIGINAL);
    });

    it("deleting an ancestor of the dragged element (and resizing: the same safeguard)", () => {
      seed();
      useEditorStore.getState().selectOnly("wrap");
      const { a, handle } = setup();
      down(handle);
      move(handle, 200, 120);
      useEditorStore.getState().deleteSelection();
      fireEvent.pointerUp(handle, { clientX: 260, clientY: 120, pointerId: 1 });
      expect(findNodeById(useEditorStore.getState().document, "a")).toBeUndefined();
      expect(past()).toBe(1);
      void a;
    });

    it("the element moved to another parent mid-drag: the drag ends without writing into the new context, and no drag entry", () => {
      seed();
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      useEditorStore.getState().moveElement("a", "other-free", "inside");
      fireEvent.pointerUp(a, { clientX: 300, clientY: 300, pointerId: 1 });
      expect(findNodeById(useEditorStore.getState().document, "other-free")?.children?.map((c) => c.id)).toContain("a");
      expect(past()).toBe(1); // the move only
      expect(useEditorStore.getState().transactionSnapshot).toBeNull();
    });

    it("a project replaced mid-drag: no later callback touches the new document, nothing recorded", () => {
      seed();
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      fireEvent.pointerMove(a, { clientX: 260, clientY: 260, pointerId: 1 }); // a frame still queued
      const next: EditorElementNode = { id: "page-2", tag: "page", children: [{ id: "free", tag: "div", layoutMode: "free", children: [{ id: "a", tag: "div", freeLayout: { x: 5, y: 5, width: 20, height: 20 } }] }] };
      useEditorStore.getState().replaceDocument(next);
      flush();
      fireEvent.pointerUp(a, { clientX: 300, clientY: 300, pointerId: 1 });
      expect(geometry()).toEqual({ x: 5, y: 5, width: 20, height: 20 });
      expect(past()).toBe(0);
    });

    it("entering Preview mid-drag rolls it back", () => {
      seed();
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      useEditorStore.getState().enterPreview();
      fireEvent.pointerUp(a, { clientX: 300, clientY: 300, pointerId: 1 });
      expect(geometry()).toEqual(ORIGINAL);
      expect(past()).toBe(0);
    });

    it("the snap preference survives cancellation", () => {
      seed();
      useEditorStore.setState({ snapEnabled: false });
      const { a } = setup();
      down(a);
      move(a, 200, 200);
      fireEvent.keyDown(window, { key: "Escape" });
      expect(useEditorStore.getState().snapEnabled).toBe(false);
    });
  });

  describe("scrolling (D41) and target invalidation (D26, D37)", () => {
    it("a scroll during the drag keeps the element under the pointer (no jump, no drift)", () => {
      seed();
      const { a, containerRect } = setup();
      down(a);
      move(a, 150, 150); // stored 130,130
      expect(geometry()).toEqual({ x: 130, y: 130, width: 40, height: 40 });
      // An ancestor scrolls down 60px: the container (and the element's origin) moves up 60px on screen.
      containerRect.mockImplementation(() => ({ left: 0, top: -60, right: 500, bottom: 340, width: 500, height: 400, x: 0, y: -60, toJSON: () => ({}) }));
      window.dispatchEvent(new Event("scroll"));
      flush();
      expect(geometry()).toEqual({ x: 130, y: 190, width: 40, height: 40 });
      move(a, 150, 160); // 10px more pointer movement, no extra drift
      expect(geometry()).toEqual({ x: 130, y: 200, width: 40, height: 40 });
      fireEvent.pointerUp(a, { clientX: 150, clientY: 160, pointerId: 1 });
      expect(past()).toBe(1);
    });

    it("a snapped-to target that moves releases that axis's lock, a new target is chosen, and the other axis's lock is kept", () => {
      seed([
        { id: "t", tag: "div", freeLayout: { x: 300, y: 20, width: 40, height: 40 } },
        { id: "floor", tag: "div", freeLayout: { x: 20, y: 300, width: 40, height: 40 } },
      ]);
      const { a, targetSpies } = setup({ t: { left: 300, top: 20, right: 340, bottom: 60 }, floor: { left: 20, top: 300, right: 60, bottom: 340 } });
      down(a);
      move(a, 318, 276); // raw x 298 → 300 (t's left edge); raw bottom 296 → 300 (the floor's top edge)
      const first = geometry()!;
      expect(first.x).toBe(300);
      expect(first.y + 40).toBe(300); // bottom on the floor's top edge
      // "t" moves 30px right (e.g. an image finished loading): its stale lock goes, the floor lock stays.
      targetSpies.get("t")!.mockImplementation(() => ({ left: 330, top: 20, right: 370, bottom: 60, width: 40, height: 40, x: 330, y: 20, toJSON: () => ({}) }));
      move(a, 318, 277);
      const second = geometry()!;
      expect(second.x).toBe(298); // no stale snap to 300
      expect(second.y + 40).toBe(300); // still locked
      expect(guides()?.vertical).toBeUndefined();
      expect(guides()?.horizontal?.coordinate).toBe(300);
      move(a, 348, 277); // raw x 328 → 330 (its new left edge)
      expect(geometry()!.x).toBe(330);
    });

    it("a target that becomes hidden mid-drag stops being a target (no stale guide)", () => {
      seed([{ id: "t", tag: "div", freeLayout: { x: 300, y: 20, width: 40, height: 40 } }]);
      const { a } = setup({ t: { left: 300, top: 20, right: 340, bottom: 60 } });
      down(a);
      move(a, 318, 150);
      expect(geometry()!.x).toBe(300);
      useEditorStore.setState((state) => ({
        document: {
          ...state.document,
          children: state.document.children!.map((wrap) =>
            wrap.id !== "wrap" ? wrap : { ...wrap, children: wrap.children!.map((free) => ({ ...free, children: free.children!.map((c) => (c.id === "t" ? { ...c, display: { display: "none" } } : c)) })) },
          ),
        },
      }));
      move(a, 318, 151);
      expect(geometry()!.x).toBe(298);
      expect(guides()?.vertical).toBeUndefined();
    });
  });
});
