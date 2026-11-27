// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getPaginationParts } from "@/features/editor/types/pagination";
import type {
  ExportDocument,
  ExportElement,
} from "@/features/export/types/exportIr";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import { exportElementClassNames } from "@/features/export/utils/exportClassNames";
import { printExportStylesheet } from "@/features/export/utils/printExportStylesheet";

/*
 * BC-17.3 — the export prints the authored state, pseudo-element, part and
 * role-group rules from the same compiler the Canvas and Preview use, with
 * its own ly-node-N classes, in the global order-key order.
 */

function built(root: EditorElementNode): ExportDocument {
  const result = buildExportDocument(root);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.document;
}

function elementFor(document: ExportDocument, nodeId: string): ExportElement {
  const found: ExportElement[] = [];
  const visit = (element: ExportElement) => {
    if (element.sourceNodeId === nodeId && /^node-\d+$/.test(element.styleKey))
      found.push(element);
    for (const child of element.children)
      if (child.kind === "element") visit(child);
  };
  visit(document.root);
  if (found.length !== 1) throw new Error(`no element for ${nodeId}`);
  return found[0];
}

describe("export style rules (BC-17.3)", () => {
  it("prints a hover rule after every base rule, and gives the element its class even with no base declarations", () => {
    const button: EditorElementNode = {
      id: "btn",
      tag: "button",
      text: "Go",
      styleRules: [
        {
          id: "h",
          target: "element",
          condition: { self: ["hover"] },
          groups: { background: { color: "#1d4ed8" } },
        },
      ],
    };
    const document = built({
      id: "page-root",
      tag: "page",
      children: [
        button,
        { id: "p", tag: "p", text: "x", typography: { color: "#111111" } },
      ],
    });
    const element = elementFor(document, "btn");
    const css = printExportStylesheet(document);
    const hover = `.ly-${element.styleKey}:where(:hover)`;
    expect(css).toContain(`${hover} {\n  background-color: #1d4ed8;\n}`);
    // The paragraph's base rule (later in document order) still precedes the hover rule.
    expect(
      css.indexOf(`.ly-${elementFor(document, "p").styleKey} {`),
    ).toBeLessThan(css.indexOf(hover));
    expect(exportElementClassNames(element)).toContain(
      `ly-${element.styleKey}`,
    );
    // Export never prints the Design-only forced-state hooks or the Canvas classes.
    expect(css).not.toContain("data-ly-force");
    expect(css).not.toContain("ly-n-");
  });

  it("prints role-group rules before the members' own rules, and gives every member its class", () => {
    const pagination: EditorElementNode = {
      ...createPaginationNode(),
      styleRules: [
        {
          id: "cur",
          target: "pagination.current",
          condition: {},
          groups: { background: { color: "#2563eb" } },
        },
      ],
    };
    const document = built({
      id: "page-root",
      tag: "page",
      children: [pagination],
    });
    const css = printExportStylesheet(document);
    const root = elementFor(document, pagination.id);
    const roleRule = css.indexOf(`.ly-${root.styleKey} > :where(:is(`);
    expect(roleRule).toBeGreaterThan(-1);
    for (const page of getPaginationParts(pagination).pages) {
      const member = elementFor(document, page.id);
      expect(exportElementClassNames(member)).toContain(
        `ly-${member.styleKey}`,
      );
      const own = css.indexOf(`.ly-${member.styleKey} {`);
      if (own > -1) expect(roleRule).toBeLessThan(own);
    }
  });

  it("includes a state rule's transition in the reduced-motion block", () => {
    const box: EditorElementNode = {
      id: "box",
      tag: "div",
      styleRules: [
        {
          id: "h",
          target: "element",
          condition: { self: ["hover"] },
          groups: {
            transition: {
              property: "opacity",
              durationMs: 200,
              timingFunction: "ease",
              delayMs: 0,
            },
          },
        },
      ],
    };
    const document = built({ id: "page-root", tag: "page", children: [box] });
    const css = printExportStylesheet(document);
    const reduced = css.slice(
      css.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reduced).toContain(
      `.ly-${elementFor(document, "box").styleKey}:where(:hover)`,
    );
  });

  it("produces byte-identical output for identical documents", () => {
    const make = (): EditorElementNode => ({
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "a",
          tag: "a",
          text: "x",
          styleRules: [
            {
              id: "f",
              target: "element",
              condition: { self: ["focus-visible"] },
              groups: {
                outline: { style: "solid", width: { value: 2, unit: "px" } },
              },
            },
          ],
        },
      ],
    });
    expect(printExportStylesheet(built(make()))).toBe(
      printExportStylesheet(built(make())),
    );
  });
});
