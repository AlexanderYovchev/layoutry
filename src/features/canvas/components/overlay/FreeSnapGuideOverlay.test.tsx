import { act, render } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { ActiveSnapGuides } from "@/features/editor/types/snap";
import { FreeSnapGuideOverlay } from "./FreeSnapGuideOverlay";

const initialState = useEditorStore.getState();

function Harness({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      {children}
      <FreeSnapGuideOverlay canvasRootRef={ref} />
    </div>
  );
}

function stubRect(el: Element, box: { left: number; top: number; right: number; bottom: number }) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    ...box,
    width: box.right - box.left,
    height: box.bottom - box.top,
    x: box.left,
    y: box.top,
    toJSON: () => box,
  });
}

function renderWith(guides: ActiveSnapGuides) {
  const result = render(
    <Harness>
      <div data-node-id="free-container-1" style={{ paddingLeft: "10px", paddingTop: "5px" }} />
    </Harness>,
  );
  const containerEl = result.container.querySelector('[data-node-id="free-container-1"]') as HTMLElement;
  stubRect(containerEl, { left: 20, top: 30, right: 420, bottom: 330 });
  Object.defineProperty(containerEl, "clientLeft", { value: 4, configurable: true });
  Object.defineProperty(containerEl, "clientTop", { value: 3, configurable: true });
  act(() => useEditorStore.getState().setActiveSnapGuides(guides));
  return result.container;
}

const query = (root: Element, name: string) => root.querySelector<HTMLElement>(`[data-canvas-overlay="${name}"]`);

describe("FreeSnapGuideOverlay (Checkpoint 1.15.6.1.1; BC-13.2 frame; BC-13.3 guides)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders nothing while no snap guide is active", () => {
    const { container } = render(
      <Harness>
        <div data-node-id="free-container-1" />
      </Harness>,
    );
    expect(container.querySelector('[data-canvas-overlay^="snap-"]')).not.toBeInTheDocument();
  });

  // The local frame's origin is the container's padding-box corner (left + border), never left + padding.
  it("a vertical line at left + border + coordinate, spanning its from/to extent; padding ignored", () => {
    const root = renderWith({ containerId: "free-container-1", vertical: { coordinate: 50, from: 10, to: 90, achieved: true }, distances: [], spacing: [] });
    const line = query(root, "snap-guide-vertical")!;
    expect(line.style.left).toBe("74px"); // 20 + 4 + 50
    expect(line.style.top).toBe("43px"); // 30 + 3 + 10
    expect(line.style.height).toBe("80px");
    expect(line.dataset.achieved).toBe("true");
    expect(query(root, "snap-guide-horizontal")).toBeNull();
  });

  it("a horizontal line the same way, independently of the vertical one", () => {
    const root = renderWith({ containerId: "free-container-1", horizontal: { coordinate: 40, from: 0, to: 200, achieved: true }, distances: [], spacing: [] });
    const line = query(root, "snap-guide-horizontal")!;
    expect(line.style.top).toBe("73px"); // 30 + 3 + 40
    expect(line.style.left).toBe("24px");
    expect(line.style.width).toBe("200px");
  });

  it("a nearby alignment that wasn't applied (Snap off / Alt) is drawn dashed, never as a snap", () => {
    const root = renderWith({ containerId: "free-container-1", vertical: { coordinate: 50, from: 0, to: 10, achieved: false }, distances: [], spacing: [] });
    const line = query(root, "snap-guide-vertical")!;
    expect(line.dataset.achieved).toBe("false");
    expect(line.className).toContain("border-dashed");
  });

  it("distance labels and equal-spacing indicators show CSS px values", () => {
    const root = renderWith({
      containerId: "free-container-1",
      vertical: { coordinate: 50, from: 0, to: 100, achieved: true },
      distances: [{ axis: "y", from: 40, to: 64, at: 50, value: 24 }],
      spacing: [{ axis: "x", gaps: [{ from: 100, to: 140 }, { from: 240, to: 280 }], at: 25, value: 40, achieved: true }],
    });
    const label = query(root, "snap-distance-label")!;
    expect(label.textContent).toBe("24");
    expect(label.style.left).toBe("74px");
    expect(label.style.top).toBe(`${30 + 3 + 52}px`);
    const gaps = root.querySelectorAll('[data-canvas-overlay="snap-spacing-gap"]');
    expect(gaps).toHaveLength(2);
    expect((gaps[1] as HTMLElement).style.left).toBe(`${20 + 4 + 240}px`);
    expect([...root.querySelectorAll('[data-canvas-overlay="snap-spacing-label"]')].map((node) => node.textContent)).toEqual(["40", "40"]);
  });

  it("never intercepts pointer events", () => {
    const root = renderWith({ containerId: "free-container-1", vertical: { coordinate: 50, from: 0, to: 100, achieved: true }, distances: [], spacing: [] });
    expect(query(root, "snap-guides")!.className).toContain("pointer-events-none");
  });
});
