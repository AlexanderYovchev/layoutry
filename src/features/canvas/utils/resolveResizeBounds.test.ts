import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveResizeBounds } from "./resolveResizeBounds";

function stubRect(el: Element, rect: { left: number; top: number; right: number; bottom: number }) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    x: rect.left,
    y: rect.top,
    toJSON: () => rect,
  });
}

describe("resolveResizeBounds", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bounds width and top to the immediate parent's content box, but leaves the bottom unbounded when the parent auto-sizes", () => {
    const canvasRoot = document.createElement("div");
    const parent = document.createElement("div");
    parent.setAttribute("data-node-id", "page-root");
    const target = document.createElement("div");
    target.setAttribute("data-node-id", "section-1");
    parent.appendChild(target);
    canvasRoot.appendChild(parent);
    document.body.appendChild(canvasRoot);

    stubRect(canvasRoot, { left: 0, top: 0, right: 900, bottom: 600 });
    stubRect(parent, { left: 0, top: 0, right: 900, bottom: 600 });
    // No inline height set on `parent` — it auto-sizes to its content.

    const bounds = resolveResizeBounds(canvasRoot, target);

    expect(bounds.left).toBe(0);
    expect(bounds.right).toBe(900);
    expect(bounds.top).toBe(0);
    expect(bounds.bottom).toBe(Infinity);
  });

  it("insets the horizontal bound by the containing block's own padding and border", () => {
    const canvasRoot = document.createElement("div");
    const parent = document.createElement("div");
    parent.setAttribute("data-node-id", "container-1");
    parent.style.paddingLeft = "32px";
    parent.style.paddingRight = "32px";
    parent.style.borderWidth = "1px";
    parent.style.borderStyle = "solid";
    const target = document.createElement("div");
    target.setAttribute("data-node-id", "image-1");
    parent.appendChild(target);
    canvasRoot.appendChild(parent);
    document.body.appendChild(canvasRoot);

    stubRect(canvasRoot, { left: 0, top: 0, right: 900, bottom: 600 });
    stubRect(parent, { left: 100, top: 50, right: 500, bottom: 400 });

    const bounds = resolveResizeBounds(canvasRoot, target);

    expect(bounds.left).toBe(133);
    expect(bounds.right).toBe(467);
  });

  it("bounds height to the nearest ancestor that has an explicit (inline) height set", () => {
    const canvasRoot = document.createElement("div");
    const parent = document.createElement("div");
    parent.setAttribute("data-node-id", "container-1");
    parent.style.height = "400px"; // explicitly resized at some point — a real ceiling
    parent.style.paddingTop = "32px";
    parent.style.paddingBottom = "32px";
    const target = document.createElement("div");
    target.setAttribute("data-node-id", "image-1");
    parent.appendChild(target);
    canvasRoot.appendChild(parent);
    document.body.appendChild(canvasRoot);

    stubRect(canvasRoot, { left: 0, top: 0, right: 900, bottom: 900 });
    stubRect(parent, { left: 0, top: 50, right: 900, bottom: 450 });

    const bounds = resolveResizeBounds(canvasRoot, target);

    expect(bounds.top).toBe(82);
    expect(bounds.bottom).toBe(418);
  });

  it("walks past multiple auto-height ancestors to find a deeper explicitly-sized one", () => {
    const canvasRoot = document.createElement("div");
    const grandparent = document.createElement("div");
    grandparent.setAttribute("data-node-id", "outer-container");
    grandparent.style.height = "500px";
    const parent = document.createElement("div");
    parent.setAttribute("data-node-id", "inner-container"); // auto-height, no inline height
    const target = document.createElement("div");
    target.setAttribute("data-node-id", "image-1");
    parent.appendChild(target);
    grandparent.appendChild(parent);
    canvasRoot.appendChild(grandparent);
    document.body.appendChild(canvasRoot);

    stubRect(canvasRoot, { left: 0, top: 0, right: 900, bottom: 900 });
    stubRect(grandparent, { left: 0, top: 0, right: 900, bottom: 500 });
    stubRect(parent, { left: 0, top: 0, right: 900, bottom: 300 }); // shorter than grandparent — must not be used

    const bounds = resolveResizeBounds(canvasRoot, target);

    expect(bounds.bottom).toBe(500);
  });

  it("bounds the top to the immediate parent even when no ancestor up to the canvas root has an explicit height, but leaves the bottom unbounded", () => {
    const canvasRoot = document.createElement("div");
    const grandparent = document.createElement("div");
    grandparent.setAttribute("data-node-id", "outer-container");
    const parent = document.createElement("div");
    parent.setAttribute("data-node-id", "inner-container");
    const target = document.createElement("div");
    target.setAttribute("data-node-id", "image-1");
    parent.appendChild(target);
    grandparent.appendChild(parent);
    canvasRoot.appendChild(grandparent);
    document.body.appendChild(canvasRoot);

    stubRect(canvasRoot, { left: 0, top: 0, right: 900, bottom: 900 });
    stubRect(grandparent, { left: 0, top: 0, right: 900, bottom: 500 });
    stubRect(parent, { left: 0, top: 200, right: 900, bottom: 300 });

    const bounds = resolveResizeBounds(canvasRoot, target);

    // top must come from the immediate parent (inner-container, top: 200),
    // never from walking past it the way the bottom bound does — a north
    // resize must never be able to escape past its own parent's edge just
    // because that parent (and everything above it) happens to auto-size.
    expect(bounds.top).toBe(200);
    expect(bounds.bottom).toBe(Infinity);
  });

  it("stops at the immediate parent for height when it is itself explicitly sized", () => {
    const canvasRoot = document.createElement("div");
    const parent = document.createElement("div");
    parent.setAttribute("data-node-id", "container-1");
    parent.style.height = "300px";
    const target = document.createElement("div");
    target.setAttribute("data-node-id", "image-1");
    parent.appendChild(target);
    canvasRoot.appendChild(parent);
    document.body.appendChild(canvasRoot);

    stubRect(canvasRoot, { left: 0, top: 0, right: 900, bottom: 900 });
    stubRect(parent, { left: 0, top: 100, right: 900, bottom: 400 });

    const bounds = resolveResizeBounds(canvasRoot, target);

    expect(bounds.top).toBe(100);
    expect(bounds.bottom).toBe(400);
  });

  it("falls back to the canvas root's own box, with an unbounded bottom, when no containing data-node-id ancestor exists", () => {
    const canvasRoot = document.createElement("div");
    const target = document.createElement("div");
    target.setAttribute("data-node-id", "orphan-1");
    canvasRoot.appendChild(target);
    document.body.appendChild(canvasRoot);

    stubRect(canvasRoot, { left: 0, top: 0, right: 900, bottom: 600 });

    const bounds = resolveResizeBounds(canvasRoot, target);

    expect(bounds.left).toBe(0);
    expect(bounds.right).toBe(900);
    expect(bounds.top).toBe(0);
    expect(bounds.bottom).toBe(Infinity);
  });
});
