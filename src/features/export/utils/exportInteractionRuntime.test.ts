import { describe, expect, it } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import { exportHtmlCss } from "@/features/export";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import { EXPORT_INTERACTION_RUNTIME } from "@/features/export/utils/exportInteractionRuntime";

/**
 * Runs the real exported page — markup plus its embedded runtime — in an
 * isolated jsdom window per test and drives it with DOM events, checking
 * the runtime reproduces Preview's interaction rules. Browser-level parity
 * with the Canvas itself is e2e/export-interactions.spec.ts.
 */

const DIALOG_POLYFILL = `
HTMLDialogElement.prototype.showModal = function () {
  if (this.hasAttribute("open")) throw new DOMException("already open", "InvalidStateError");
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  if (!this.hasAttribute("open")) return;
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};
// BC-02.5: jsdom has no media playback; record play()/pause() per element id.
window.__media = [];
HTMLMediaElement.prototype.play = function () { window.__media.push("play:" + this.id); return Promise.resolve(); };
HTMLMediaElement.prototype.pause = function () { window.__media.push("pause:" + this.id); };`;

function page(children: EditorElementNode[]): EditorElementNode {
  return { id: "page-root", tag: "page", children };
}

/** Loads an exported standalone page; elements are addressed by editor node id via the IR's document order. */
function load(document: EditorElementNode) {
  const result = exportHtmlCss(document, { mode: "standalone" });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const built = buildExportDocument(document);
  if (!built.ok) throw new Error("unbuildable");
  const keys: string[] = [];
  const visit = (element: typeof built.document.root) => {
    keys.push(/^node-\d+$/.test(element.styleKey) ? element.sourceNodeId : `${element.sourceNodeId}#${element.styleKey}`);
    for (const child of element.children) if (child.kind === "element") visit(child);
  };
  visit(built.document.root);

  // A fresh iframe per page: its own window, so runtime listeners never
  // leak between tests. jsdom has no modal dialog support, so a minimal
  // polyfill (mirroring test/setup.ts) runs before the page.
  const frame = window.document.createElement("iframe");
  window.document.body.append(frame);
  const frameDocument = frame.contentDocument;
  if (!frameDocument) throw new Error("no iframe document");
  frameDocument.open();
  frameDocument.write(result.files[0].content.replace("<head>", `<head><script>${DIALOG_POLYFILL}</script>`));
  frameDocument.close();
  const elements = [frameDocument.body.firstElementChild, ...Array.from(frameDocument.body.firstElementChild?.querySelectorAll("*") ?? [])];
  const byNode = new Map(keys.map((key, index) => [key, elements[index]]));
  const element = (nodeId: string) => {
    const found = byNode.get(nodeId);
    if (!found) throw new Error(`no element for ${nodeId}`);
    return found;
  };
  return {
    document: frameDocument,
    media: (): string[] => {
      const log: unknown = Reflect.get(frameDocument.defaultView ?? {}, "__media");
      return Array.isArray(log) ? log.map(String) : [];
    },
    element,
    click: (nodeId: string) => element(nodeId).dispatchEvent(new MouseEvent("click", { bubbles: true })),
    escape: () => (frameDocument.activeElement ?? frameDocument.body).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    shown: (nodeId: string) => {
      const target = element(nodeId);
      return target.tagName === "DIALOG" ? target.hasAttribute("open") : !target.hasAttribute("hidden");
    },
  };
}

const children = (node: EditorElementNode) => node.children ?? [];

describe("interaction runtime — Preview semantics", () => {
  it("toggles a dropdown, dismisses it from outside, and keeps two dropdowns independent", () => {
    const first = createElementNode("dropdownButton");
    const second = createElementNode("dropdownButton");
    const outside: EditorElementNode = { id: "p-outside", tag: "p", text: "outside" };
    const [triggerA, menuA] = children(first);
    const [triggerB, menuB] = children(second);
    const view = load(page([first, second, outside]));

    expect([view.shown(menuA.id), view.shown(menuB.id)]).toEqual([false, false]);
    view.click(triggerA.id);
    expect([view.shown(menuA.id), view.shown(menuB.id)]).toEqual([true, false]);
    expect(view.element(triggerA.id).getAttribute("aria-expanded")).toBe("true");
    // Opening B is a click outside A: A closes first, then B opens.
    view.click(triggerB.id);
    expect([view.shown(menuA.id), view.shown(menuB.id)]).toEqual([false, true]);
    expect(view.element(triggerA.id).getAttribute("aria-expanded")).toBe("false");
    // A click inside the open menu keeps it open.
    view.click(children(menuB)[0].id);
    expect(view.shown(menuB.id)).toBe(true);
    view.click(outside.id);
    expect(view.shown(menuB.id)).toBe(false);
    // Clicking the trigger again toggles closed.
    view.click(triggerA.id);
    view.click(triggerA.id);
    expect(view.shown(menuA.id)).toBe(false);
  });

  it("dismisses only the first open relationship on Escape and returns focus from inside it to its trigger", () => {
    const first = createElementNode("popover");
    const second = createElementNode("popover");
    const [triggerA, panelA] = children(first);
    const [triggerB, panelB] = children(second);
    const view = load(page([first, second]));
    view.click(triggerA.id);
    // A popover's region doesn't contain the other trigger: opening B dismisses A.
    view.click(triggerB.id);
    expect([view.shown(panelA.id), view.shown(panelB.id)]).toEqual([false, true]);
    const heading = view.element(children(panelB)[0].id);
    heading.setAttribute("tabindex", "-1");
    (heading as HTMLElement).focus();
    view.escape();
    expect(view.shown(panelB.id)).toBe(false);
    expect(view.document.activeElement).toBe(view.element(triggerB.id));
  });

  it("collapses and re-expands a collapsible that starts open, never dismissing it from outside", () => {
    const collapsible = createElementNode("collapsible");
    const other = createElementNode("collapsible");
    const [trigger, content] = children(collapsible);
    const view = load(page([collapsible, other]));
    expect(view.shown(content.id)).toBe(true);
    expect(view.element(trigger.id).getAttribute("aria-expanded")).toBe("true");
    view.click(children(other)[0].id);
    expect(view.shown(content.id)).toBe(true);
    view.click(trigger.id);
    expect(view.shown(content.id)).toBe(false);
    view.escape();
    view.click(trigger.id);
    expect(view.shown(content.id)).toBe(true);
  });

  it("switches tabs within one tab group only and keeps panel content", () => {
    const tabsA = createElementNode("basicTabs");
    const tabsB = createElementNode("basicTabs");
    const panels = (tabs: EditorElementNode) => children(children(tabs)[1]);
    const buttons = (tabs: EditorElementNode) => children(children(tabs)[0]);
    const view = load(page([tabsA, tabsB]));
    const state = (tabs: EditorElementNode) => panels(tabs).map((panel) => view.shown(panel.id));
    expect(state(tabsA)).toEqual([true, false, false]);
    view.click(buttons(tabsA)[1].id);
    expect(state(tabsA)).toEqual([false, true, false]);
    expect(state(tabsB)).toEqual([true, false, false]);
    expect(view.element(panels(tabsA)[1].id).textContent).toContain("Tab 2 Content");
    // Tabs have no tab keyboard model in the editor, so no tab roles are claimed.
    expect(view.document.querySelector("[role=tab], [role=tablist], [role=tabpanel]")).toBeNull();
  });

  it("opens a modal with showModal, closes it from its Close button, and keeps two modals separate", () => {
    const first = createElementNode("modal");
    const second = createElementNode("modal");
    const [openA, dialogA] = children(first);
    const [, dialogB] = children(second);
    const closeA = children(children(dialogA)[0])[2];
    const view = load(page([first, second]));
    expect([view.shown(dialogA.id), view.shown(dialogB.id)]).toEqual([false, false]);
    expect(view.element(openA.id).getAttribute("aria-haspopup")).toBe("dialog");
    view.click(openA.id);
    expect([view.shown(dialogA.id), view.shown(dialogB.id)]).toEqual([true, false]);
    view.click(closeA.id);
    expect(view.shown(dialogA.id)).toBe(false);
    // Backdrop: a click whose target is the dialog itself.
    view.click(openA.id);
    view.click(dialogA.id);
    expect(view.shown(dialogA.id)).toBe(false);
  });

  it("keeps a dialog's own Escape from dismissing a dropdown inside it", () => {
    const modal = createElementNode("modal");
    const dropdown = createElementNode("dropdownButton");
    const [open, dialog] = children(modal);
    children(children(dialog)[0]).push(dropdown);
    const [trigger, menu] = children(dropdown);
    const view = load(page([modal]));
    view.click(open.id);
    view.click(trigger.id);
    expect(view.shown(menu.id)).toBe(true);
    // Escape reaching the open dialog stops there (native Escape closes the dialog itself).
    view.element(trigger.id).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(view.shown(menu.id)).toBe(true);
  });

  it("shows two toasts independently and hides each from its own Close button", () => {
    const toastA = createElementNode("manualToast");
    const toastB = createElementNode("manualToast");
    const [showA, panelA] = children(toastA);
    const [showB, panelB] = children(toastB);
    const view = load(page([toastA, toastB]));
    view.click(showA.id);
    view.click(showB.id);
    expect([view.shown(panelA.id), view.shown(panelB.id)]).toEqual([true, true]);
    view.click(children(panelB)[1].id);
    expect([view.shown(panelA.id), view.shown(panelB.id)]).toEqual([true, false]);
  });

  it("dismisses one alert without touching another", () => {
    const alertA = createElementNode("dismissibleAlert");
    const alertB = createElementNode("dismissibleAlert");
    const view = load(page([alertA, alertB]));
    view.click(children(alertA)[1].id);
    expect([view.shown(alertA.id), view.shown(alertB.id)]).toEqual([false, true]);
  });

  it("runs only the nearest node's actions: a click on a node inside a trigger doesn't fire the trigger", () => {
    const document = page([
      { id: "card-1", tag: "div", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "panel-1" }], children: [{ id: "p-1", tag: "p", text: "inner" }] },
      { id: "panel-1", tag: "div" },
    ]);
    const view = load(document);
    view.click("p-1");
    expect(view.shown("panel-1")).toBe(true);
    view.click("card-1");
    expect(view.shown("panel-1")).toBe(false);
  });

  it("applies a trigger's actions in order", () => {
    const document = page([
      { id: "b-1", tag: "button", text: "x", interactions: [{ id: "i-1", trigger: "click", action: "hide", targetId: "t-1" }, { id: "i-2", trigger: "click", action: "toggle", targetId: "t-1" }] },
      { id: "t-1", tag: "div", initialPreviewVisibility: "hidden" },
    ]);
    const view = load(document);
    view.click("b-1");
    expect(view.shown("t-1")).toBe(true);
  });

  it("re-opens a dialog that is open at load as a modal", () => {
    const dialog = createElementNode("dialog");
    delete dialog.initialPreviewVisibility;
    const view = load(page([dialog]));
    expect(view.shown(dialog.id)).toBe(true);
  });
});

describe("interaction runtime — safety", () => {
  it("is a constant script with no dynamic code execution or HTML injection sinks", () => {
    for (const forbidden of ["eval(", "Function(", "innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "setTimeout", "setInterval", "</script", "<!--"]) {
      expect(EXPORT_INTERACTION_RUNTIME, forbidden).not.toContain(forbidden);
    }
  });
});

describe("interaction runtime — media in hidden targets (BC-02.5, B5)", () => {
  const clip = "https://example.com/clip.webm";
  const media = (id: string, extra: Partial<EditorElementNode> = {}): EditorElementNode => ({ id, htmlId: id, tag: "video", src: clip, ...extra });
  const document = (initiallyHidden: boolean) =>
    page([
      { id: "b-toggle", tag: "button", text: "Toggle", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "panel" }] },
      {
        id: "panel",
        tag: "div",
        ...(initiallyHidden ? { initialPreviewVisibility: "hidden" as const } : {}),
        children: [
          media("v-plain"),
          media("v-auto", { autoplay: true, muted: true }),
          media("v-sound", { autoplay: true }),
          { id: "deep", tag: "div", children: [{ id: "deeper", tag: "div", children: [{ id: "a-deep", htmlId: "a-deep", tag: "audio", src: clip }] }] },
        ],
      },
    ]);

  /** jsdom does not initialise the muted property from the muted attribute, as browsers do. */
  function loadMuted(initiallyHidden: boolean) {
    const loaded = load(document(initiallyHidden));
    const auto = loaded.document.getElementById("v-auto") as HTMLMediaElement | null;
    if (auto) auto.muted = true;
    return loaded;
  }

  it("hiding a target pauses every video and audio in it, at any depth", () => {
    const page = loadMuted(false);
    page.click("b-toggle");
    expect(page.shown("panel")).toBe(false);
    expect(page.media().filter((entry) => entry.startsWith("pause:")).sort()).toEqual(["pause:a-deep", "pause:v-auto", "pause:v-plain", "pause:v-sound"]);
  });

  it("showing it again starts only muted autoplay media; nothing else resumes", () => {
    const page = loadMuted(false);
    page.click("b-toggle");
    page.click("b-toggle");
    expect(page.shown("panel")).toBe(true);
    expect(page.media().filter((entry) => entry.startsWith("play:"))).toEqual(["play:v-auto"]);
  });

  it("repeated toggling pauses on every hide and plays muted autoplay on every show", () => {
    const page = loadMuted(false);
    for (let round = 0; round < 3; round++) {
      page.click("b-toggle");
      page.click("b-toggle");
    }
    expect(page.media().filter((entry) => entry === "pause:v-plain")).toHaveLength(3);
    expect(page.media().filter((entry) => entry === "play:v-auto")).toHaveLength(3);
    expect(page.media().filter((entry) => entry.startsWith("play:") && entry !== "play:v-auto")).toEqual([]);
  });

  it("media inside hidden content cannot start: a play event there is paused at once", () => {
    const page = loadMuted(true);
    const video = page.document.getElementById("v-auto");
    if (!video) throw new Error("no video");
    video.dispatchEvent(new Event("play"));
    expect(page.media()).toEqual(["pause:v-auto"]);
    page.click("b-toggle");
    page.document.getElementById("v-plain")?.dispatchEvent(new Event("play"));
    expect(page.media()).not.toContain("pause:v-plain");
  });

  it("never rewinds: hiding only pauses, it does not reset the position", () => {
    const page = loadMuted(false);
    const video = page.document.getElementById("v-plain") as HTMLMediaElement | null;
    if (!video) throw new Error("no video");
    Object.defineProperty(video, "currentTime", { value: 2.5, writable: true });
    page.click("b-toggle");
    page.click("b-toggle");
    expect(video.currentTime).toBe(2.5);
  });

  it("the exported markup writes autoplay only for the muted video (BC-02.2.1 still holds)", () => {
    const page = loadMuted(false);
    expect(page.document.getElementById("v-auto")?.hasAttribute("autoplay")).toBe(true);
    expect(page.document.getElementById("v-sound")?.hasAttribute("autoplay")).toBe(false);
  });
});

describe("interaction runtime — media the user unmuted (BC-02.5 with BC-02.2.1)", () => {
  it("is not auto-started with sound when its target is shown again", () => {
    const loaded = load(
      page([
        { id: "b-toggle", tag: "button", text: "Toggle", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "panel" }] },
        { id: "panel", tag: "div", children: [{ id: "v-auto", htmlId: "v-auto", tag: "video", src: "https://example.com/clip.webm", autoplay: true, muted: true }] },
      ]),
    );
    const video = loaded.document.getElementById("v-auto") as HTMLMediaElement | null;
    if (!video) throw new Error("no video");
    video.muted = false;
    loaded.click("b-toggle");
    loaded.click("b-toggle");
    expect(loaded.media()).toEqual(["pause:v-auto"]);
  });
});
