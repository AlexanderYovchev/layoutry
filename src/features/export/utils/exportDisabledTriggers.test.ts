import { describe, expect, it } from "vitest";
import { createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import type { EditorElementNode } from "@/features/editor/types/document";
import { exportHtmlCss } from "@/features/export/utils/exportHtmlCss";

/**
 * BC-09.2.1 — Export never makes a disabled control a trigger: no
 * data-ly-on-click, aria-controls or aria-expanded on it, so the shared
 * runtime can't run it by any activation path. Enabled controls keep
 * their behaviour. Preview: see disabledInteractionSafety.test.tsx.
 */

const toggle = (id: string, targetId: string) => [{ id, trigger: "click" as const, action: "toggle" as const, targetId }];

function exported(children: EditorElementNode[]) {
  const result = exportHtmlCss({ id: "page-root", tag: "page", children }, { mode: "separate" });
  const html = result.files.find((file) => file.path === "index.html")?.content ?? "";
  return { result, html };
}

const tag = (html: string, text: string) => html.match(new RegExp(`<(a|button)[^>]*>${text}</(a|button)>`))?.[0] ?? "";

describe("Export — disabled triggers (BC-09.2.1)", () => {
  it("a disabled Previous exports no trigger; the enabled Next with the same binding does", () => {
    const pagination = createPaginationNode();
    pagination.children![0].interactions = toggle("i-1", "panel");
    pagination.children![4].interactions = toggle("i-2", "panel");
    const { html, result } = exported([pagination, { id: "panel", tag: "p", text: "Panel", initialPreviewVisibility: "hidden" }]);
    const previous = tag(html, "Previous");
    expect(previous).toMatch(/role="link" aria-disabled="true"/);
    expect(previous).not.toMatch(/data-ly-on-click|aria-controls|aria-expanded|href=/);
    expect(tag(html, "Next")).toMatch(/data-ly-on-click="toggle:\d+"/);
    expect(tag(html, "Next")).toMatch(/aria-expanded="false"/);
    expect(result.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.severity, diagnostic.nodeId])).toEqual([["disabled-trigger", "info", pagination.children![0].id]]);
  });

  it("a disabled button exports natively disabled and without trigger attributes", () => {
    const { html } = exported([
      { id: "b-1", tag: "button", text: "Go", disabled: true, interactions: toggle("i-1", "panel") },
      { id: "panel", tag: "p", text: "Panel", initialPreviewVisibility: "hidden" },
    ]);
    expect(tag(html, "Go")).toMatch(/ disabled /);
    expect(tag(html, "Go")).not.toMatch(/data-ly-on-click|aria-controls/);
  });

  it("with only disabled triggers, no script is exported at all", () => {
    const { result } = exported([
      { id: "a-1", tag: "a", text: "Prev", href: "#", disabled: true, interactions: toggle("i-1", "panel") },
      { id: "panel", tag: "p", text: "Panel", initialPreviewVisibility: "hidden" },
    ]);
    expect(result.files.map((file) => file.path)).not.toContain("script.js");
  });

  it("a disabled link inside an enabled trigger is a click boundary, as in Preview: clicking it doesn't fire the container", () => {
    const { html } = exported([
      {
        id: "box",
        tag: "div",
        interactions: toggle("i-box", "panel"),
        children: [{ id: "a-1", tag: "a", text: "Prev", href: "#", disabled: true, interactions: toggle("i-1", "panel") }],
      },
      { id: "panel", tag: "p", text: "Panel", initialPreviewVisibility: "hidden" },
    ]);
    expect(html).toMatch(/<div [^>]*data-ly-on-click=/);
    const link = tag(html, "Prev");
    expect(link).toContain("data-ly-node");
    expect(link).not.toContain("data-ly-on-click");
  });

  it("an enabled link next to a disabled sibling keeps its trigger", () => {
    const { html } = exported([
      { id: "a-1", tag: "a", text: "Off", href: "#", disabled: true, interactions: toggle("i-1", "panel") },
      { id: "a-2", tag: "a", text: "On", href: "#", interactions: toggle("i-2", "panel") },
      { id: "panel", tag: "p", text: "Panel", initialPreviewVisibility: "hidden" },
    ]);
    expect(tag(html, "On")).toMatch(/data-ly-on-click=/);
    expect(tag(html, "Off")).not.toMatch(/data-ly-on-click=/);
  });
});
