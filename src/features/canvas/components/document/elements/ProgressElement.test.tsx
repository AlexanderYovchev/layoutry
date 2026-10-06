import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { ProgressElement } from "./ProgressElement";

describe("ProgressElement (Checkpoint 1.15.6.12.4)", () => {
  it("renders a genuine <progress>, not a div/placeholder standing in for one", () => {
    render(
      <ProgressElement
        node={{ id: "progress-1", tag: "progress", progressValue: 50, progressMax: 100 }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const progress = document.querySelector("progress");
    expect(progress).not.toBeNull();
    expect(progress?.tagName).toBe("PROGRESS");
  });

  it("maps value/max to real native properties", () => {
    render(
      <ProgressElement
        node={{ id: "progress-1", tag: "progress", progressValue: 30, progressMax: 50 }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const progress = document.querySelector("progress") as HTMLProgressElement;
    expect(progress.value).toBe(30);
    expect(progress.max).toBe(50);
  });

  it("an undefined progressValue renders genuine native indeterminate state (no value attribute)", () => {
    render(
      <ProgressElement
        node={{ id: "progress-1", tag: "progress", progressMax: 100 }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const progress = document.querySelector("progress") as HTMLProgressElement;
    expect(progress.hasAttribute("value")).toBe(false);
    expect(progress.position).toBe(-1);
  });

  it("falls back to an effective max of 100 when progressMax is unset", () => {
    render(
      <ProgressElement
        node={{ id: "progress-1", tag: "progress", progressValue: 50 }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    expect((document.querySelector("progress") as HTMLProgressElement).max).toBe(100);
  });

  it("stamps the node's own id/tag as data attributes directly on the <progress> itself — no wrapper", () => {
    render(
      <ProgressElement
        node={{ id: "progress-1", tag: "progress" }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const progress = document.querySelector("progress");
    expect(progress).toHaveAttribute("data-node-id", "progress-1");
    expect(progress).toHaveAttribute("data-node-type", "progress");
  });

  it("applies authored HTML id/class directly to the <progress> — no wrapper to misplace it on", () => {
    render(
      <ProgressElement
        node={{ id: "progress-1", tag: "progress", htmlId: "upload-progress", className: "my-custom-class" }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const progress = document.querySelector("progress") as HTMLProgressElement;
    expect(progress).toHaveAttribute("id", "upload-progress");
    expect(progress.className).toContain("my-custom-class");
  });

  it("renders no children, no text, no custom fill div", () => {
    render(
      <ProgressElement
        node={{ id: "progress-1", tag: "progress", progressValue: 50, progressMax: 100 }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const progress = document.querySelector("progress") as HTMLProgressElement;
    expect(progress.children.length).toBe(0);
    expect(progress.textContent).toBe("");
  });

  it("applies ordinary box CSS (opacity/filters) directly to the <progress> itself — no wrapper to intercept it", () => {
    render(
      <ProgressElement
        node={{
          id: "progress-1",
          tag: "progress",
          progressValue: 50,
          progressMax: 100,
          filters: { opacity: 50 },
        }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const progress = document.querySelector("progress") as HTMLProgressElement;
    expect(progress.style.opacity).toBe("0.5");
  });
});

describe("ProgressElement — CSS Transition Foundation (Checkpoint 1.15.6.14.1)", () => {
  const initialState = useEditorStore.getState();
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("supports an ordinary CSS transition on the element itself, Preview-only, completely unrelated to progressValue", () => {
    const transition = { property: "opacity" as const, durationMs: 200, timingFunction: "ease" as const, delayMs: 0 };
    useEditorStore.setState({ editorMode: "preview" });
    render(
      <ProgressElement
        node={{ id: "progress-1", tag: "progress", progressValue: 50, progressMax: 100, transition }}
        parentId="page-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );
    const progress = document.querySelector("progress") as HTMLProgressElement;
    expect(progress.style.transitionProperty).toBe("opacity");
    expect(progress.value).toBe(50);
  });
});
