import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { CanvasInteractionBoundary } from "./CanvasInteractionBoundary";

/*
 * BC-02.5.1 — Preview keeps hidden targets mounted (as the exported page
 * does), so media keeps its position and aria-controls always points at
 * an element that exists. Through the real Canvas and store.
 */

const initialState = useEditorStore.getState();

const clip = "/clip.webm";
const tree: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "b-panel", tag: "button", text: "Toggle panel", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "panel" }] },
    {
      id: "panel",
      tag: "div",
      children: [
        { id: "v-plain", htmlId: "v-plain", tag: "video", src: clip },
        { id: "v-auto", htmlId: "v-auto", tag: "video", src: clip, autoplay: true, muted: true },
        { id: "v-sound", htmlId: "v-sound", tag: "video", src: clip, autoplay: true },
        { id: "deep", tag: "div", children: [{ id: "a-deep", htmlId: "a-deep", tag: "audio", src: clip }] },
      ],
    },
    { id: "b-second", tag: "button", text: "Second", interactions: [{ id: "i-2", trigger: "click", action: "toggle", targetId: "authored" }] },
    { id: "authored", tag: "div", htmlId: "my-panel", initialPreviewVisibility: "hidden", children: [{ id: "authored-text", tag: "p", text: "Authored id" }] },
    { id: "b-dialog", tag: "button", text: "Open", interactions: [{ id: "i-3", trigger: "click", action: "show", targetId: "dlg" }] },
    { id: "dlg", tag: "dialog", initialPreviewVisibility: "hidden", children: [{ id: "dlg-text", tag: "p", text: "Dialog" }] },
  ],
};

function Workspace() {
  const document = useEditorStore((state) => state.document);
  return (
    <main aria-label="Workspace">
      <CanvasInteractionBoundary document={document} />
    </main>
  );
}

const get = <T extends Element = HTMLElement>(nodeId: string): T => {
  const element = document.querySelector<T>(`[data-node-id="${nodeId}"]`);
  if (!element) throw new Error(`no ${nodeId}`);
  return element;
};
const media = (id: string) => {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLMediaElement)) throw new Error(`no media ${id}`);
  return element;
};
const hiddenRule = () => document.querySelector("style[data-runtime-hidden]")?.textContent ?? "";

let play: MockInstance<HTMLMediaElement["play"]>;
let pause: MockInstance<HTMLMediaElement["pause"]>;
const calls = (spy: MockInstance, id: string) => spy.mock.contexts.filter((context) => context === media(id)).length;

describe("Preview hidden targets stay mounted (BC-02.5.1)", () => {
  beforeEach(() => {
    useEditorStore.getState().replaceDocument(tree);
    play = vi.spyOn(HTMLMediaElement.prototype, "play");
    pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("a hidden target stays in the DOM and is not displayed; showing it removes the rule; Design has no rule", () => {
    render(<Workspace />);
    expect(hiddenRule()).toBe("");
    act(() => useEditorStore.getState().enterPreview());
    expect(get("authored")).toBeInTheDocument();
    expect(hiddenRule()).toContain('[data-node-id="authored"]{display:none!important}');
    fireEvent.click(get("b-panel"));
    expect(get("panel")).toBeInTheDocument();
    expect(hiddenRule()).toContain('[data-node-id="panel"]');
    fireEvent.click(get("b-panel"));
    expect(hiddenRule()).not.toContain('[data-node-id="panel"]');
    act(() => useEditorStore.getState().exitPreview());
    expect(hiddenRule()).toBe("");
  });

  it("hiding pauses every media element inside, at any depth, without re-creating it (position kept)", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    const before = { plain: media("v-plain"), deep: media("a-deep") };
    Object.defineProperty(before.plain, "currentTime", { value: 1.5, writable: true });
    fireEvent.click(get("b-panel"));
    expect(media("v-plain")).toBe(before.plain);
    expect(media("a-deep")).toBe(before.deep);
    for (const id of ["v-plain", "v-auto", "v-sound", "a-deep"]) expect(calls(pause, id), id).toBeGreaterThanOrEqual(1);
    fireEvent.click(get("b-panel"));
    expect(media("v-plain").currentTime).toBe(1.5);
  });

  it("showing resumes only muted autoplay; ordinary and unmuted media are never started", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    expect(calls(play, "v-auto")).toBe(1);
    fireEvent.click(get("b-panel"));
    fireEvent.click(get("b-panel"));
    expect(calls(play, "v-auto")).toBe(2);
    expect(calls(play, "v-plain")).toBe(0);
    expect(calls(play, "v-sound")).toBe(0);
    expect(calls(play, "a-deep")).toBe(0);
  });

  it("media hidden at Preview start is not started, and has no native autoplay attribute while hidden", () => {
    useEditorStore.getState().replaceDocument({ ...tree, children: tree.children?.map((child) => (child.id === "panel" ? { ...child, initialPreviewVisibility: "hidden" as const } : child)) });
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    expect(calls(play, "v-auto")).toBe(0);
    expect(media("v-auto").autoplay).toBe(false);
    fireEvent.click(get("b-panel"));
    expect(calls(play, "v-auto")).toBe(1);
    expect(media("v-auto").autoplay).toBe(true);
  });

  it("a dialog target is closed while hidden and opened when shown, staying mounted throughout", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    const dialog = get<HTMLDialogElement>("dlg");
    expect(dialog.hasAttribute("open")).toBe(false);
    fireEvent.click(get("b-dialog"));
    expect(get<HTMLDialogElement>("dlg")).toBe(dialog);
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("aria-controls names ids that exist: generated for targets without one, authored otherwise, in every state", () => {
    render(<Workspace />);
    act(() => useEditorStore.getState().enterPreview());
    const check = () => {
      for (const triggerId of ["b-panel", "b-second", "b-dialog"]) {
        const ids = (get(triggerId).getAttribute("aria-controls") ?? "").split(" ");
        for (const id of ids) expect(document.querySelectorAll(`[id="${id}"]`), `${triggerId} → ${id}`).toHaveLength(1);
      }
    };
    expect(get("b-panel").getAttribute("aria-controls")).toBe(get("panel").id);
    expect(get("panel").id).toMatch(/^ly-target-\d+$/);
    expect(get("b-second").getAttribute("aria-controls")).toBe("my-panel");
    expect(get("b-dialog").getAttribute("aria-controls")).toBe(get("dlg").id);
    check();
    fireEvent.click(get("b-panel"));
    fireEvent.click(get("b-second"));
    check();
    const idBefore = get("panel").id;
    fireEvent.click(get("b-panel"));
    expect(get("panel").id).toBe(idBefore);
    check();
  });

  it("Design shows neither generated ids nor aria-controls, and nothing reaches the document or history", () => {
    render(<Workspace />);
    const before = useEditorStore.getState();
    expect(get("panel").hasAttribute("id")).toBe(false);
    expect(get("b-panel").hasAttribute("aria-controls")).toBe(false);
    act(() => useEditorStore.getState().enterPreview());
    fireEvent.click(get("b-panel"));
    act(() => useEditorStore.getState().exitPreview());
    expect(get("panel").hasAttribute("id")).toBe(false);
    expect(get("b-panel").hasAttribute("aria-controls")).toBe(false);
    const after = useEditorStore.getState();
    expect(after.document).toBe(before.document);
    expect(after.persistedDocument).toBe(before.persistedDocument);
    expect(after.past).toBe(before.past);
  });
});
