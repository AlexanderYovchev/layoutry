import { describe, expect, it } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";
import { exportHtmlCss } from "@/features/export";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import { interactionFixture } from "../../../../test/fixtures/export/exportInteractionDocument";

function page(children: EditorElementNode[]): EditorElementNode {
  return { id: "page-root", tag: "page", children };
}

function behaviorsOf(document: EditorElementNode) {
  const built = buildExportDocument(document);
  if (!built.ok) throw new Error(JSON.stringify(built.diagnostics));
  return { behaviors: built.document.behaviors, diagnostics: built.document.diagnostics };
}

function html(document: EditorElementNode): string {
  const result = exportHtmlCss(document, { mode: "standalone" });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.files[0].content;
}

const children = (node: EditorElementNode) => node.children ?? [];

describe("buildExportBehaviors — Preview's interaction model", () => {
  it("describes a dropdown as a dismissible, expandable toggle of an initially hidden menu", () => {
    const dropdown = createElementNode("dropdownButton");
    const [trigger, menu] = children(dropdown);
    const { behaviors } = behaviorsOf(page([dropdown]));
    expect(behaviors.targets).toEqual([{ token: 1, nodeId: menu.id, kind: "element", initiallyVisible: false, domId: "ly-target-1", generatedDomId: true }]);
    expect(behaviors.triggers).toEqual([{ nodeId: trigger.id, actions: [{ action: "toggle", targetToken: 1 }], dismissibleTargetTokens: [1], expandsTargetToken: 1, opensDialog: false }]);
  });

  it("never makes a collapsible (which starts open) dismissible", () => {
    const { behaviors } = behaviorsOf(page([createElementNode("collapsible")]));
    expect(behaviors.triggers[0]).toMatchObject({ dismissibleTargetTokens: [], expandsTargetToken: 1 });
    expect(behaviors.targets[0].initiallyVisible).toBe(true);
  });

  it("describes a modal's opener as opening a dialog and its Close button as hiding it", () => {
    const modal = createElementNode("modal");
    const [open, dialog] = children(modal);
    const close = children(children(dialog)[0])[2];
    const { behaviors } = behaviorsOf(page([modal]));
    expect(behaviors.targets).toEqual([expect.objectContaining({ nodeId: dialog.id, kind: "dialog", initiallyVisible: false })]);
    expect(behaviors.triggers).toEqual([
      expect.objectContaining({ nodeId: open.id, actions: [{ action: "show", targetToken: 1 }], opensDialog: true }),
      expect.objectContaining({ nodeId: close.id, actions: [{ action: "hide", targetToken: 1 }], opensDialog: false }),
    ]);
  });

  it("gives each instance its own tokens, so instances never address each other", () => {
    const { behaviors } = behaviorsOf(page([createElementNode("basicTabs"), createElementNode("basicTabs")]));
    expect(behaviors.targets.map((target) => target.token)).toEqual([1, 2, 3, 4, 5, 6]);
    const firstGroup = behaviors.triggers.slice(0, 3).flatMap((trigger) => trigger.actions.map((action) => action.targetToken));
    const secondGroup = behaviors.triggers.slice(3).flatMap((trigger) => trigger.actions.map((action) => action.targetToken));
    expect(new Set(firstGroup)).toEqual(new Set([1, 2, 3]));
    expect(new Set(secondGroup)).toEqual(new Set([4, 5, 6]));
  });

  it("records the nodes nested inside a trigger as click boundaries", () => {
    const { behaviors } = behaviorsOf(
      page([
        { id: "card-1", tag: "div", interactions: [{ id: "i", trigger: "click", action: "toggle", targetId: "t-1" }], children: [{ id: "p-1", tag: "p", text: "x" }, { id: "img-1", tag: "img", src: "https://example.com/a.png" }] },
        { id: "t-1", tag: "div" },
      ]),
    );
    expect(behaviors.nodesInsideTriggers).toEqual(["p-1", "img-1"]);
  });

  it("skips triggers Preview can never click, and flags triggers keyboards can't reach", () => {
    const { behaviors, diagnostics } = behaviorsOf({
      id: "page-root",
      tag: "page",
      interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "t-1" }],
      children: [{ id: "d-1", tag: "div", interactions: [{ id: "i-2", trigger: "click", action: "toggle", targetId: "t-1" }] }, { id: "t-1", tag: "div" }],
    });
    expect(behaviors.triggers.map((trigger) => trigger.nodeId)).toEqual(["d-1"]);
    expect(diagnostics.map((diagnostic) => `${diagnostic.nodeId}:${diagnostic.code}`)).toEqual(["page-root:unsupported-trigger", "d-1:non-operable-trigger"]);
  });

  it("references a target by its authored id only when that id is valid and unique", () => {
    const { behaviors } = behaviorsOf(
      page([
        { id: "b-1", tag: "button", text: "x", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "t-1" }, { id: "i-2", trigger: "click", action: "toggle", targetId: "t-2" }, { id: "i-3", trigger: "click", action: "toggle", targetId: "t-3" }] },
        { id: "t-1", tag: "div", htmlId: "details" },
        { id: "t-2", tag: "div", htmlId: "twice" },
        { id: "t-3", tag: "div", htmlId: "ly-target-1" },
        { id: "other", tag: "div", htmlId: "twice" },
      ]),
    );
    expect(behaviors.targets.map(({ domId, generatedDomId }) => ({ domId, generatedDomId }))).toEqual([
      { domId: "details", generatedDomId: false },
      // A duplicated authored id can't be referenced reliably, nor replaced.
      { domId: undefined, generatedDomId: false },
      // The reserved prefix is never authored (it is dropped), so the generated id is collision-free.
      { domId: "ly-target-3", generatedDomId: true },
    ]);
  });
});

describe("interaction export — security", () => {
  const hostile = page([
    {
      id: "b-1",
      tag: "button",
      text: `"><script>alert(1)</script>`,
      htmlId: `x"onclick="alert(1)`,
      className: `data-ly-on-click="toggle:1"`,
      interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "t-1" }],
    },
    { id: "t-1", tag: "div", htmlId: `y"onmouseover="alert(1)`, initialPreviewVisibility: "hidden", children: [{ id: "p-1", tag: "p", text: "</script><script>alert(2)</script>" }] },
  ]);

  it("writes only generated tokens and keywords into runtime attributes, and escapes authored ids", () => {
    const output = html(hostile);
    const parsed = new DOMParser().parseFromString(output, "text/html");
    for (const element of Array.from(parsed.querySelectorAll("*"))) {
      for (const { name, value } of Array.from(element.attributes)) {
        expect(name.startsWith("on"), name).toBe(false);
        if (name === "data-ly-on-click") expect(value).toMatch(/^(show|hide|toggle):\d+( (show|hide|toggle):\d+)*$/);
        if (name === "data-ly-target" || name === "data-ly-expands" || name === "data-ly-dismiss") expect(value).toMatch(/^\d+( \d+)*$/);
      }
    }
    // The authored id is kept, escaped, as a single attribute — and referenced verbatim by aria-controls.
    const target = parsed.querySelector("[data-ly-target]");
    expect(target?.id).toBe(`y"onmouseover="alert(1)`);
    expect(parsed.querySelector("[data-ly-on-click]")?.getAttribute("aria-controls")).toBe(`y"onmouseover="alert(1)`);
    expect(parsed.querySelectorAll("script")).toHaveLength(1);
    expect(parsed.querySelector("script")?.textContent).not.toContain("alert");
  });

  it.each([
    ["an unknown action", { id: "i", trigger: "click", action: "eval", targetId: "t-1" }],
    ["an unknown trigger", { id: "i", trigger: "mouseover", action: "show", targetId: "t-1" }],
    ["a selector-like target", { id: "i", trigger: "click", action: "show", targetId: `t-1"],[onclick` }],
  ])("refuses a document whose behavior metadata has %s", (_label, binding) => {
    const document = { id: "page-root", tag: "page", children: [{ id: "b-1", tag: "button", interactions: [binding] }, { id: "t-1", tag: "div" }] };
    // Deliberately ill-typed: this is the hostile project-file input the schema must refuse.
    const result = buildExportDocument(document as unknown as EditorElementNode);
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: "invalid-document" }] });
  });

  it("supports a trigger nested 95 levels deep", () => {
    let deep: EditorElementNode = { id: "b-deep", tag: "button", text: "deep", interactions: [{ id: "i", trigger: "click", action: "toggle", targetId: "t-1" }] };
    for (let level = 0; level < 95; level++) deep = { id: `div-${level}`, tag: "div", children: [deep] };
    const { behaviors } = behaviorsOf(page([deep, { id: "t-1", tag: "div" }]));
    expect(behaviors.triggers.map((trigger) => trigger.nodeId)).toEqual(["b-deep"]);
  });

  it("exports interactive pages deterministically", () => {
    const { document } = interactionFixture();
    expect(exportHtmlCss(document, { mode: "separate" })).toEqual(exportHtmlCss(document, { mode: "separate" }));
    expect(exportHtmlCss(structuredClone(document), { mode: "standalone" })).toEqual(exportHtmlCss(document, { mode: "standalone" }));
  });
});
