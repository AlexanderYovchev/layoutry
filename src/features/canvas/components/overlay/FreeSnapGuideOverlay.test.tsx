import { act, render } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
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

describe("FreeSnapGuideOverlay (Checkpoint 1.15.6.1.1)", () => {
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
    expect(container.querySelector('[data-canvas-overlay^="snap-guide"]')).not.toBeInTheDocument();
  });

  it("renders a vertical guide line positioned at the container's left edge plus padding plus the guide's own content-box offset", () => {
    const { container } = render(
      <Harness>
        <div data-node-id="free-container-1" style={{ paddingLeft: "10px" }} />
      </Harness>,
    );
    const containerEl = container.querySelector('[data-node-id="free-container-1"]') as HTMLElement;
    stubRect(containerEl, { left: 20, top: 0, right: 220, bottom: 200 });

    act(() => {
      useEditorStore.getState().setActiveSnapGuides({ containerId: "free-container-1", vertical: 50 });
    });

    const guide = container.querySelector('[data-canvas-overlay="snap-guide-vertical"]') as HTMLElement;
    expect(guide).toBeInTheDocument();
    // left = containerRect.left(20) + paddingLeft(10) + guide.vertical(50) = 80
    expect(guide.style.left).toBe("80px");
    expect(container.querySelector('[data-canvas-overlay="snap-guide-horizontal"]')).not.toBeInTheDocument();
  });

  it("renders a horizontal guide line the same way, independently of the vertical one", () => {
    const { container } = render(
      <Harness>
        <div data-node-id="free-container-1" style={{ paddingTop: "5px" }} />
      </Harness>,
    );
    const containerEl = container.querySelector('[data-node-id="free-container-1"]') as HTMLElement;
    stubRect(containerEl, { left: 0, top: 30, right: 200, bottom: 230 });

    act(() => {
      useEditorStore.getState().setActiveSnapGuides({ containerId: "free-container-1", horizontal: 40 });
    });

    const guide = container.querySelector('[data-canvas-overlay="snap-guide-horizontal"]') as HTMLElement;
    expect(guide).toBeInTheDocument();
    // top = containerRect.top(30) + paddingTop(5) + guide.horizontal(40) = 75
    expect(guide.style.top).toBe("75px");
    expect(container.querySelector('[data-canvas-overlay="snap-guide-vertical"]')).not.toBeInTheDocument();
  });

  it("disappears once the store clears activeSnapGuides", () => {
    const { container, rerender } = render(
      <Harness>
        <div data-node-id="free-container-1" />
      </Harness>,
    );
    const containerEl = container.querySelector('[data-node-id="free-container-1"]') as HTMLElement;
    stubRect(containerEl, { left: 0, top: 0, right: 200, bottom: 200 });

    act(() => {
      useEditorStore.getState().setActiveSnapGuides({ containerId: "free-container-1", vertical: 10 });
    });
    expect(container.querySelector('[data-canvas-overlay="snap-guide-vertical"]')).toBeInTheDocument();

    act(() => {
      useEditorStore.getState().setActiveSnapGuides(null);
    });
    rerender(
      <Harness>
        <div data-node-id="free-container-1" />
      </Harness>,
    );
    expect(container.querySelector('[data-canvas-overlay="snap-guide-vertical"]')).not.toBeInTheDocument();
  });
});
