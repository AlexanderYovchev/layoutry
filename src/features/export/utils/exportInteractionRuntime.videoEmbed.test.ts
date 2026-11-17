import { afterEach, describe, expect, it } from "vitest";
import { createVideoEmbedNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import { exportHtmlCss } from "./exportHtmlCss";

/**
 * BC-08.3 — the exported page's Video Embed lifecycle, running the real
 * exported markup and runtime in an isolated jsdom window. jsdom does no
 * layout, so getClientRects reports "rendered" unless the element or an
 * ancestor is hidden or display: none (as a browser would), and
 * matchMedia answers the reduced-motion query from a flag. jsdom never
 * loads remote frames, so nothing is fetched.
 */

const YT = "dQw4w9WgXcQ";
const AUTOPLAY = `https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&mute=1`;
const STILL = `https://www.youtube-nocookie.com/embed/${YT}?mute=1`;

const STUBS = (reducedMotion: boolean) => `
Element.prototype.getClientRects = function () {
  for (var element = this; element; element = element.parentElement) {
    if (element.hidden || getComputedStyle(element).display === "none") return [];
  }
  return [{}];
};
window.matchMedia = function (query) {
  return { matches: ${reducedMotion} && /reduce/.test(query), addEventListener: function () {}, removeEventListener: function () {} };
};`;

const frames: HTMLIFrameElement[] = [];
afterEach(() => {
  frames.splice(0).forEach((frame) => frame.remove());
});

const video = (id: string, extra: Partial<EditorElementNode> = {}): EditorElementNode => ({ ...createVideoEmbedNode(), id, src: `https://www.youtube-nocookie.com/embed/${YT}`, muted: true, autoplay: true, ...extra });

function documentWith(children: EditorElementNode[]): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      { id: "btn-toggle", tag: "button", text: "Toggle", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "box" }] },
      { id: "btn-show-late", tag: "button", text: "Show", interactions: [{ id: "i-2", trigger: "click", action: "show", targetId: "iframe-late" }] },
      { id: "box", tag: "div", children: [video("iframe-in-box")] },
      ...children,
    ],
  };
}

function load(document: EditorElementNode, reducedMotion = false) {
  const result = exportHtmlCss(document, { mode: "standalone" });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const host = window.document.createElement("iframe");
  window.document.body.append(host);
  frames.push(host);
  const page = host.contentDocument;
  if (!page) throw new Error("no document");
  page.open();
  page.write(result.files[0].content.replace("<head>", `<head><script>${STUBS(reducedMotion)}</script>`));
  page.close();
  const buttons = Array.from(page.querySelectorAll("button"));
  return {
    page,
    players: () => Array.from(page.querySelectorAll<HTMLIFrameElement>("iframe[data-ly-video-src]")),
    click: (text: string) => buttons.find((button) => button.textContent === text)?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
  };
}

describe("exported Video Embed lifecycle (BC-08.3)", () => {
  it("a shown player loads its authored URL (muted autoplay); hiding its parent removes it; showing creates a fresh one", () => {
    const view = load(documentWith([]));
    const [first] = view.players();
    expect(view.players()).toHaveLength(1);
    expect(first.getAttribute("src")).toBe(AUTOPLAY);
    view.click("Toggle");
    expect(view.players()).toHaveLength(0);
    expect(first.isConnected).toBe(false);
    view.click("Toggle");
    const [second] = view.players();
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(second.getAttribute("src")).toBe(AUTOPLAY);
    // Repeated changes never accumulate players.
    for (let round = 0; round < 5; round += 1) {
      view.click("Toggle");
      view.click("Toggle");
    }
    expect(view.players()).toHaveLength(1);
  });

  it("hidden at load: no player until shown", () => {
    const view = load(documentWith([video("iframe-late", { initialPreviewVisibility: "hidden" })]));
    expect(view.players()).toHaveLength(1);
    view.click("Show");
    expect(view.players()).toHaveLength(2);
  });

  it("authored display: none: never a player", () => {
    const view = load(documentWith([{ id: "gone", tag: "div", display: { display: "none" }, children: [video("iframe-gone")] }]));
    expect(view.players()).toHaveLength(1);
    expect(view.page.querySelector('[data-ly-video-src]')?.closest("[hidden]")).toBeNull();
  });

  it("BC-08.5: authored visibility: hidden (on an ancestor) means no player, like Preview; a descendant's own visible overrides it", () => {
    const view = load(
      documentWith([
        { id: "invisible", tag: "div", display: { visibility: "hidden" }, children: [video("iframe-invisible", { title: "Inherits hidden" })] },
        { id: "invisible-but", tag: "div", display: { visibility: "hidden" }, children: [video("iframe-visible-again", { title: "Own visible", display: { visibility: "visible" } })] },
      ]),
    );
    // The box's player and the one whose own Visibility is "visible" remain; the inherited-hidden one is removed.
    expect(view.players().map((frame) => frame.getAttribute("title"))).toEqual(["Embedded video", "Own visible"]);
  });

  it("reduced motion: the player is kept without autoplay, and stays so after hide/show", () => {
    const view = load(documentWith([]), true);
    expect(view.players().map((player) => player.getAttribute("src"))).toEqual([STILL]);
    view.click("Toggle");
    view.click("Toggle");
    expect(view.players().map((player) => player.getAttribute("src"))).toEqual([STILL]);
  });

  it("every recreated player keeps the original's sandbox, allow, referrer policy and title", () => {
    const view = load(documentWith([]));
    view.click("Toggle");
    view.click("Toggle");
    const [player] = view.players();
    expect(player.getAttribute("sandbox")).toBe("allow-forms allow-popups allow-scripts allow-same-origin");
    expect(player.getAttribute("allow")).toBe("fullscreen");
    expect(player.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(player.getAttribute("title")).toBe("Embedded video");
  });
});

describe("exported generic Embed lifecycle (BC-08.3.1)", () => {
  const generic = (id: string, extra: Partial<EditorElementNode> = {}): EditorElementNode => ({ id, tag: "iframe", src: `https://widget.example/${id}`, title: id, ...extra });
  const frames = (page: Document, id: string) => Array.from(page.querySelectorAll<HTMLIFrameElement>(`iframe[title="${id}"]`));

  function genericDocument(): EditorElementNode {
    return {
      id: "page-root",
      tag: "page",
      children: [
        { id: "btn-toggle", tag: "button", text: "Toggle", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "box" }] },
        { id: "btn-show-late", tag: "button", text: "Show", interactions: [{ id: "i-2", trigger: "click", action: "show", targetId: "late" }] },
        { id: "box", tag: "div", children: [{ id: "inner", tag: "section", children: [generic("in-box")] }] },
        generic("late", { initialPreviewVisibility: "hidden" }),
        generic("static"),
      ],
    };
  }

  it("hidden ancestor removes the frame; shown again recreates it from its own src; a static frame is never touched", () => {
    const view = load(genericDocument());
    const staticFrame = frames(view.page, "static")[0];
    const [first] = frames(view.page, "in-box");
    expect(first.getAttribute("src")).toBe("https://widget.example/in-box");
    view.click("Toggle");
    expect(frames(view.page, "in-box")).toHaveLength(0);
    expect(first.isConnected).toBe(false);
    view.click("Toggle");
    const [second] = frames(view.page, "in-box");
    expect(second).not.toBe(first);
    expect(second.getAttribute("src")).toBe("https://widget.example/in-box");
    expect(second.getAttribute("sandbox")).toBe("allow-forms allow-popups allow-scripts allow-same-origin");
    expect(second.hasAttribute("allow")).toBe(false);
    for (let round = 0; round < 5; round += 1) {
      view.click("Toggle");
      view.click("Toggle");
    }
    expect(frames(view.page, "in-box")).toHaveLength(1);
    expect(frames(view.page, "static")[0]).toBe(staticFrame);
  });

  it("hidden at load: no frame until shown", () => {
    const view = load(genericDocument());
    expect(frames(view.page, "late")).toHaveLength(0);
    view.click("Show");
    expect(frames(view.page, "late")).toHaveLength(1);
  });
});
