import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRef, type ReactNode } from "react";
import { DropIndicatorOverlay } from "./DropIndicatorOverlay";

function Harness({
  zone,
  children,
}: {
  zone: "before" | "after" | "inside";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}>
      {children}
      <DropIndicatorOverlay canvasRootRef={ref} targetId="target-1" zone={zone} />
    </div>
  );
}

describe("DropIndicatorOverlay", () => {
  it("renders nothing when the target isn't in the DOM", () => {
    const { container } = render(
      <Harness zone="before">
        <div data-node-id="other" />
      </Harness>,
    );

    expect(container.querySelector('[data-canvas-overlay]')).not.toBeInTheDocument();
  });

  it("renders a line indicator for before/after zones", () => {
    const { container } = render(
      <Harness zone="before">
        <div data-node-id="target-1" />
      </Harness>,
    );

    expect(container.querySelector('[data-canvas-overlay="drop-line"]')).toBeInTheDocument();
    expect(
      container.querySelector('[data-canvas-overlay="drop-inside"]'),
    ).not.toBeInTheDocument();
  });

  it("renders the inside treatment for the inside zone", () => {
    const { container } = render(
      <Harness zone="inside">
        <div data-node-id="target-1" />
      </Harness>,
    );

    expect(container.querySelector('[data-canvas-overlay="drop-inside"]')).toBeInTheDocument();
    expect(container.querySelector('[data-canvas-overlay="drop-line"]')).not.toBeInTheDocument();
  });
});
