import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelFreeInsertion,
  finishFreeInsertion,
  isFreeInsertionScrolling,
  setFreeInsertionDestination,
  startFreeInsertion,
} from "@/features/canvas/utils/freeInsertionSession";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { interruptActiveInteraction } from "@/features/editor/utils/activeInteraction";

/*
 * BC-13.6 — the Resource Panel → Free container insertion session, in jsdom
 * with measured rects: pointer placement with the card hotspot, default size
 * fitted by containment, the shared snapping (Snap off / Alt), guides, an
 * invalid child, destination switching/deletion, the final pointer at the
 * drop, cancellation and command interruption, and no document change.
 */

const initialState = useEditorStore.getState();
type Box = { left: number; top: number; right: number; bottom: number };

function stubRect(el: Element, box: Box) {
  return vi.spyOn(el, "getBoundingClientRect").mockImplementation(() => ({ ...box, width: box.right - box.left, height: box.bottom - box.top, x: box.left, y: box.top, toJSON: () => box }));
}

const paragraph = () => createElementNode("paragraph"); // default Free size 240 × 80

let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
const flush = () => {
  const pending = [...frames.values()];
  frames = new Map();
  for (const callback of pending) callback(performance.now());
};
const pointer = (x: number, y: number, init: PointerEventInit = {}) => {
  window.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, bubbles: true, ...init }));
  flush();
};

/** A 700×500 Free container "free" at (0,0) holding "t" (300,40 100×50), plus a Flow container "flow". */
function setup(children: EditorElementNode[] = [{ id: "t", tag: "div", freeLayout: { x: 300, y: 40, width: 100, height: 50 } }], container: Partial<EditorElementNode> = {}) {
  useEditorStore.setState((state) => ({
    document: {
      ...state.document,
      children: [{ id: "free", tag: "div", layoutMode: "free", ...container, children }, { id: "flow", tag: "div", children: [] }],
    },
  }));
  document.body.innerHTML = `<div data-document-surface><div data-node-id="free">${children.map((c) => `<div data-node-id="${c.id}"></div>`).join("")}</div><div data-node-id="flow"></div></div>`;
  const free = document.querySelector<HTMLElement>('[data-node-id="free"]')!;
  stubRect(free, { left: 0, top: 0, right: 700, bottom: 500 });
  Object.defineProperty(free, "clientWidth", { value: 700, configurable: true });
  Object.defineProperty(free, "clientHeight", { value: 500, configurable: true });
  for (const c of children) {
    const g = c.freeLayout!;
    stubRect(document.querySelector(`[data-node-id="${c.id}"]`)!, { left: g.x, top: g.y, right: g.x + g.width, bottom: g.y + g.height });
  }
  return free;
}

const preview = () => useEditorStore.getState().freeInsertionPreview;
const guides = () => useEditorStore.getState().activeSnapGuides;

describe("freeInsertionSession (BC-13.6)", () => {
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
    cancelFreeInsertion();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
    document.body.innerHTML = "";
  });

  const begin = (hotspot = { x: 0.5, y: 0.5 }, x = 100, y = 100) => startFreeInsertion({ prototype: paragraph(), label: "Paragraph", pointer: { x, y }, hotspot });

  it("previews the component's default size at the pointer (keeping the card's hotspot) without touching the document or history", () => {
    setup();
    const documentBefore = useEditorStore.getState().document;
    begin({ x: 0.25, y: 0.5 });
    setFreeInsertionDestination("free");
    pointer(160, 200);
    expect(preview()).toEqual({ containerId: "free", rect: { x: 100, y: 160, width: 240, height: 80 }, label: "Paragraph", valid: true }); // 160 − 0.25×240, 200 − 0.5×80
    expect(useEditorStore.getState().document).toBe(documentBefore);
    expect(useEditorStore.getState().past).toHaveLength(0);
    expect(isFreeInsertionScrolling()).toBe(true);
  });

  it("the drop gets exactly the last preview, after processing the final pointer position", () => {
    setup();
    begin();
    setFreeInsertionDestination("free");
    pointer(200, 200);
    window.dispatchEvent(new PointerEvent("pointerup", { clientX: 230, clientY: 260, bubbles: true })); // no frame ran yet
    const { placement, interrupted } = finishFreeInsertion();
    expect(interrupted).toBe(false);
    expect(placement).toEqual({ containerId: "free", geometry: { x: 110, y: 220, width: 240, height: 80 } });
    expect(preview()).toBeNull();
    expect(guides()).toBeNull();
    expect(finishFreeInsertion().placement).toBeNull(); // a second completion does nothing
  });

  it("containment: the position is clamped inside, and a too-big default size is fitted by the existing Free rule", () => {
    setup();
    begin();
    setFreeInsertionDestination("free");
    pointer(5000, 5000);
    expect(preview()?.rect).toEqual({ x: 460, y: 420, width: 240, height: 80 });
    cancelFreeInsertion();
    const small = setup();
    Object.defineProperty(small, "clientWidth", { value: 200, configurable: true });
    stubRect(small, { left: 0, top: 0, right: 200, bottom: 500 });
    begin();
    setFreeInsertionDestination("free");
    pointer(100, 100);
    expect(preview()?.rect.width).toBe(200); // the existing rule: containment wins over the default size
  });

  it("snaps to an element's edge within 6px (achieved guide), not beyond; Snap off and Alt keep it at the pointer with a nearby guide", () => {
    setup();
    begin({ x: 0, y: 0 });
    setFreeInsertionDestination("free");
    pointer(296, 200); // left edge 4px from t's left edge (300)
    expect(preview()?.rect.x).toBe(300);
    expect(guides()?.vertical).toMatchObject({ coordinate: 300, achieved: true });
    pointer(292, 200); // 8px away (the lock releases at 9; still held)
    pointer(280, 200); // well beyond
    expect(preview()?.rect.x).toBe(280);

    pointer(296, 200, { altKey: true });
    expect(preview()?.rect.x).toBe(296);
    expect(guides()?.vertical?.achieved).toBe(false);
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Alt" }));
    flush();
    expect(preview()?.rect.x).toBe(300);

    useEditorStore.setState({ snapEnabled: false });
    pointer(297, 200);
    expect(preview()?.rect.x).toBe(297);
    expect(guides()?.vertical?.achieved).toBe(false);
  });

  it("equal spacing: one gap after a pair", () => {
    setup([
      { id: "a", tag: "div", freeLayout: { x: 20, y: 300, width: 60, height: 40 } },
      { id: "b", tag: "div", freeLayout: { x: 110, y: 300, width: 60, height: 40 } }, // gap 30
    ]);
    begin({ x: 0, y: 0 });
    setFreeInsertionDestination("free");
    pointer(198, 290); // left 198 → 200 (= 170 + 30)
    expect(preview()?.rect.x).toBe(200);
    expect(guides()?.spacing[0]).toMatchObject({ value: 30, achieved: true });
  });

  it("a component the container can't hold (List Item in a div): an invalid preview, no snapping, no placement", () => {
    setup();
    startFreeInsertion({ prototype: createElementNode("listItem"), label: "List Item", pointer: { x: 0, y: 0 }, hotspot: { x: 0, y: 0 } });
    setFreeInsertionDestination("free");
    pointer(296, 200);
    expect(preview()?.valid).toBe(false);
    expect(guides()).toBeNull();
    expect(finishFreeInsertion().placement).toBeNull();
  });

  it("leaving for a Flow parent (or nothing) removes the preview and guides; coming back starts fresh", () => {
    setup();
    begin({ x: 0, y: 0 });
    setFreeInsertionDestination("free");
    pointer(296, 200);
    expect(guides()).not.toBeNull();
    setFreeInsertionDestination("flow");
    expect(preview()).toBeNull();
    expect(guides()).toBeNull();
    expect(isFreeInsertionScrolling()).toBe(false);
    expect(finishFreeInsertion().placement).toBeNull();
  });

  it("a container under a rotated/scaled ancestor keeps the existing placement (no preview)", () => {
    setup([], { transform: { rotateDeg: 10 } });
    begin();
    setFreeInsertionDestination("free");
    expect(preview()).toBeNull();
  });

  it("the destination deleted mid-drag: the preview goes, nothing can be inserted there", () => {
    setup();
    begin();
    setFreeInsertionDestination("free");
    pointer(200, 200);
    useEditorStore.setState((state) => ({ document: { ...state.document, children: state.document.children!.filter((c) => c.id !== "free") } }));
    flush();
    expect(preview()).toBeNull();
    expect(finishFreeInsertion().placement).toBeNull();
  });

  it("a recognized command interrupts it first: the dnd-kit drag is cancelled through Escape, and the drop (if any) inserts nothing", () => {
    setup();
    begin();
    setFreeInsertionDestination("free");
    pointer(200, 200);
    const escapes = vi.fn();
    document.addEventListener("keydown", (event) => event.code === "Escape" && escapes());
    expect(interruptActiveInteraction()).toBe(true);
    expect(escapes).toHaveBeenCalledTimes(1);
    expect(preview()).toBeNull();
    expect(finishFreeInsertion()).toEqual({ placement: null, interrupted: true });
  });

  it("a window blur, entering Preview, or a project switch interrupts it too", () => {
    for (const trigger of [() => window.dispatchEvent(new Event("blur")), () => useEditorStore.getState().enterPreview(), () => useEditorStore.getState().replaceDocument({ id: "p2", tag: "page", children: [] })]) {
      useEditorStore.setState(initialState, true);
      setup();
      begin();
      setFreeInsertionDestination("free");
      pointer(200, 200);
      trigger();
      expect(preview()).toBeNull();
      expect(finishFreeInsertion().interrupted).toBe(true);
    }
  });

  it("cancel (Escape, pointercancel) clears everything, is idempotent, and a stale frame never publishes", () => {
    setup();
    begin();
    setFreeInsertionDestination("free");
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 250, clientY: 250 })); // queued
    cancelFreeInsertion();
    cancelFreeInsertion();
    flush();
    expect(preview()).toBeNull();
    expect(guides()).toBeNull();
    expect(finishFreeInsertion()).toEqual({ placement: null, interrupted: false });
  });

  it("unrelated keys don't affect it; the Snap preference is untouched", () => {
    setup();
    begin();
    setFreeInsertionDestination("free");
    pointer(200, 200);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "q" }));
    expect(preview()).not.toBeNull();
    expect(useEditorStore.getState().snapEnabled).toBe(true);
  });

  it("a component with a margin: the preview is its rendered box, the placement its stored geometry", () => {
    setup([]);
    const prototype = { ...paragraph(), spacing: { margin: { left: 10, top: 6 } } };
    startFreeInsertion({ prototype, label: "P", pointer: { x: 0, y: 0 }, hotspot: { x: 0, y: 0 } });
    setFreeInsertionDestination("free");
    pointer(120, 120);
    expect(preview()?.rect).toMatchObject({ x: 120, y: 120 });
    expect(finishFreeInsertion().placement?.geometry).toMatchObject({ x: 110, y: 114 });
  });
});
