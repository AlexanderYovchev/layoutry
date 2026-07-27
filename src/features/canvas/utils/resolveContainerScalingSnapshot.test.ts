import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { resolveContainerScalingSnapshot } from "./resolveContainerScalingSnapshot";

const initialState = useEditorStore.getState();

function stubClientSize(el: HTMLElement, width: number, height: number) {
  Object.defineProperty(el, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: height, configurable: true });
}

describe("resolveContainerScalingSnapshot", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("returns null when there is no target element", () => {
    expect(resolveContainerScalingSnapshot(null, 400, 300)).toBeNull();
  });

  it("returns null when the target isn't a Free container", () => {
    const el = document.createElement("div");
    el.setAttribute("data-node-id", "section-1"); // real node, but Flow (fixture default)
    stubClientSize(el, 400, 300);
    expect(resolveContainerScalingSnapshot(el, 400, 300)).toBeNull();
  });

  it("returns null when the target is a Free container with no children", () => {
    useEditorStore.getState().convertToFreeLayout("section-1", {});
    useEditorStore.setState((state) => ({
      document: {
        ...state.document,
        children: state.document.children?.map((c) => (c.id === "section-1" ? { ...c, children: [] } : c)),
      },
    }));
    const el = document.createElement("div");
    el.setAttribute("data-node-id", "section-1");
    stubClientSize(el, 400, 300);
    expect(resolveContainerScalingSnapshot(el, 400, 300)).toBeNull();
  });

  it("resolves a full snapshot for a Free container with children", () => {
    useEditorStore.getState().convertToFreeLayout("section-1", {
      "heading-1": { x: 16, y: 16, width: 240, height: 48 },
    });
    const el = document.createElement("div");
    el.setAttribute("data-node-id", "section-1");
    el.style.paddingLeft = "10px";
    el.style.paddingRight = "10px";
    stubClientSize(el, 420, 300); // clientWidth includes the 20px total horizontal padding

    const snapshot = resolveContainerScalingSnapshot(el, 460, 300);

    expect(snapshot).not.toBeNull();
    expect(snapshot!.containerId).toBe("section-1");
    expect(snapshot!.policy).toBe("scale");
    expect(snapshot!.startContentBounds).toEqual({ width: 400, height: 300 });
    expect(snapshot!.outerToContentInset).toEqual({ width: 60, height: 0 });
    expect(snapshot!.children).toEqual([
      { id: "heading-1", tag: "h1", geometry: { x: 16, y: 16, width: 240, height: 48 } },
    ]);
  });

  it("respects an explicitly set clamp policy", () => {
    useEditorStore.getState().convertToFreeLayout("section-1", {
      "heading-1": { x: 16, y: 16, width: 240, height: 48 },
    });
    useEditorStore.getState().setChildResizePolicy("section-1", "clamp");
    const el = document.createElement("div");
    el.setAttribute("data-node-id", "section-1");
    stubClientSize(el, 400, 300);

    const snapshot = resolveContainerScalingSnapshot(el, 400, 300);
    expect(snapshot!.policy).toBe("clamp");
  });

  it("excludes children with no freeLayout yet from the snapshot", () => {
    useEditorStore.getState().convertToFreeLayout("section-1", {
      "heading-1": { x: 16, y: 16, width: 240, height: 48 },
    });
    // paragraph-1/button-1 remain without freeLayout (simulating a child added before its geometry was assigned).
    const el = document.createElement("div");
    el.setAttribute("data-node-id", "section-1");
    stubClientSize(el, 400, 300);

    const snapshot = resolveContainerScalingSnapshot(el, 400, 300);
    expect(snapshot!.children.map((c) => c.id)).toEqual(["heading-1"]);
  });
});
