import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResourceScrollRegion } from "./ResourceScrollRegion";

/*
 * BC-03.2 — the position-keeping logic of a Resource panel list. jsdom
 * has no layout, so this tests only the logic: what is remembered, when,
 * and what is put back. The real scrolling, bounding and collapse
 * behavior is covered by e2e/resource-panel-scrolling.spec.ts in three
 * browsers.
 */

function regionElement() {
  return screen.getByTestId("region").parentElement as HTMLDivElement;
}

/** jsdom reports clientHeight 0 for everything; give the region a rendered height (or take it away). */
function setRendered(element: HTMLElement, rendered: boolean) {
  Object.defineProperty(element, "clientHeight", { configurable: true, get: () => (rendered ? 400 : 0) });
}

function scrollTo(element: HTMLElement, top: number) {
  element.scrollTop = top;
  fireEvent.scroll(element);
}

function renderRegion(hidden: boolean) {
  return render(
    <ResourceScrollRegion hidden={hidden} id="results" className="overflow-y-auto">
      <span data-testid="region" />
      <button type="button">Tile</button>
    </ResourceScrollRegion>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ResourceScrollRegion", () => {
  it("renders its id and classes, with scroll anchoring off", () => {
    renderRegion(false);
    const element = regionElement();
    expect(element.id).toBe("results");
    expect(element.className).toContain("overflow-y-auto");
    expect(element.className).toContain("[overflow-anchor:none]");
    // Opts out of drag auto-scroll (EditorApp's dnd-kit canScroll).
    expect(element).toHaveAttribute("data-no-drag-autoscroll");
  });

  it("puts the last position seen while visible back when shown again", () => {
    const { rerender } = renderRegion(false);
    const element = regionElement();
    setRendered(element, true);
    scrollTo(element, 640);

    // Collapsing: the region is display:none, the browser drops its offset.
    rerender(
      <ResourceScrollRegion hidden id="results" className="overflow-y-auto">
        <span data-testid="region" />
        <button type="button">Tile</button>
      </ResourceScrollRegion>,
    );
    setRendered(element, false);
    scrollTo(element, 0);

    rerender(
      <ResourceScrollRegion hidden={false} id="results" className="overflow-y-auto">
        <span data-testid="region" />
        <button type="button">Tile</button>
      </ResourceScrollRegion>,
    );
    expect(element.scrollTop).toBe(640);
  });

  it("ignores scroll events while it has no rendered height", () => {
    const { rerender } = renderRegion(false);
    const element = regionElement();
    setRendered(element, true);
    scrollTo(element, 300);
    setRendered(element, false);
    scrollTo(element, 0);
    rerender(
      <ResourceScrollRegion hidden={false} id="results" className="overflow-y-auto">
        <span data-testid="region" />
        <button type="button">Tile</button>
      </ResourceScrollRegion>,
    );
    // Nothing changed visibility, and the hidden-time 0 was not remembered.
    expect(element.scrollTop).toBe(0);
    rerender(
      <ResourceScrollRegion hidden id="results" className="overflow-y-auto">
        <span data-testid="region" />
        <button type="button">Tile</button>
      </ResourceScrollRegion>,
    );
    rerender(
      <ResourceScrollRegion hidden={false} id="results" className="overflow-y-auto">
        <span data-testid="region" />
        <button type="button">Tile</button>
      </ResourceScrollRegion>,
    );
    expect(element.scrollTop).toBe(300);
  });

  it("a new region (remounted, as on a section switch) starts at the top", () => {
    const first = renderRegion(false);
    const element = regionElement();
    setRendered(element, true);
    scrollTo(element, 500);
    first.unmount();
    renderRegion(false);
    expect(regionElement().scrollTop).toBe(0);
  });

  it("scrolls keyboard focus fully into view, but never pointer focus", () => {
    renderRegion(false);
    const tile = screen.getByRole("button", { name: "Tile" });
    const scrollIntoView = vi.fn();
    tile.scrollIntoView = scrollIntoView;
    const matches = vi.spyOn(tile, "matches");

    matches.mockReturnValue(false);
    fireEvent.focus(tile);
    expect(scrollIntoView).not.toHaveBeenCalled();

    matches.mockImplementation((selector: string) => selector === ":focus-visible");
    fireEvent.focus(tile);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
  });

  it("removes its scroll listener when unmounted", () => {
    const { unmount } = renderRegion(false);
    const element = regionElement();
    const remove = vi.spyOn(element, "removeEventListener");
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
