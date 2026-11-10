import { describe, expect, it } from "vitest";
import { exportHtmlCss } from "@/features/export";
import type { EditorElementNode } from "@/features/editor/types/document";

/*
 * BC-05.3 — Export keeps an authored spacing 0 as a real declaration and
 * writes nothing for an unset side, exactly as the Canvas does (both go
 * through elementPositionStyle).
 */

function stylesheet(children: EditorElementNode[]): string {
  const result = exportHtmlCss(
    { id: "page-root", tag: "page", children },
    { mode: "separate" },
  );
  const css = result.files.find((file) => file.path === "styles.css");
  if (!css) throw new Error("no styles.css");
  return css.content;
}

const spacingDeclarations = (css: string) =>
  css.match(/(?:margin|padding)-(?:top|right|bottom|left): [^;]+;/g) ?? [];

describe("Export — spacing zero (BC-05.3)", () => {
  it("writes an authored padding 0 on a button, on every side", () => {
    const css = stylesheet([
      {
        id: "b",
        tag: "button",
        text: "Go",
        spacing: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      },
    ]);
    expect(spacingDeclarations(css)).toEqual([
      "padding-top: 0;",
      "padding-right: 0;",
      "padding-bottom: 0;",
      "padding-left: 0;",
    ]);
  });

  it("writes only the authored sides of a mixed box", () => {
    const css = stylesheet([
      {
        id: "b",
        tag: "button",
        text: "Go",
        spacing: { padding: { top: 12, left: 0 } },
      },
    ]);
    expect(spacingDeclarations(css)).toEqual([
      "padding-top: 12px;",
      "padding-left: 0;",
    ]);
  });

  it("writes an authored margin 0 on a heading and a paragraph", () => {
    const css = stylesheet([
      {
        id: "h",
        tag: "h2",
        text: "T",
        spacing: { margin: { top: 0, right: 0, bottom: 0, left: 0 } },
      },
      { id: "p", tag: "p", text: "B", spacing: { margin: { bottom: 0 } } },
    ]);
    expect(spacingDeclarations(css)).toEqual([
      "margin-left: 0;",
      "margin-top: 0;",
      "margin-right: 0;",
      "margin-bottom: 0;",
      "margin-bottom: 0;",
    ]);
  });

  it("writes an authored padding 0 on a container", () => {
    const css = stylesheet([
      {
        id: "c",
        tag: "div",
        flowLayout: { display: "block" },
        spacing: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
        children: [],
      },
    ]);
    expect(spacingDeclarations(css)).toEqual([
      "padding-top: 0;",
      "padding-right: 0;",
      "padding-bottom: 0;",
      "padding-left: 0;",
    ]);
  });

  it("writes no spacing declaration for unset or reset spacing, so the default presentation applies", () => {
    const css = stylesheet([
      { id: "b", tag: "button", text: "Go" },
      {
        id: "c",
        tag: "div",
        flowLayout: { display: "block" },
        spacing: {},
        children: [],
      },
    ]);
    expect(spacingDeclarations(css)).toEqual([]);
    // The button keeps its own default padding.
    expect(css).toMatch(/padding-inline: 1rem;/);
  });
});
