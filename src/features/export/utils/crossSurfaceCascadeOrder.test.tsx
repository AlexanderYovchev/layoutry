import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DocumentNodeRenderer } from "@/features/canvas/components/document/DocumentNodeRenderer";
import { compileDocumentSheet } from "@/features/canvas/styling/documentStyleCompiler";
import { createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { getPaginationParts } from "@/features/editor/types/pagination";
import { buildExportDocument } from "@/features/export/utils/buildExportDocument";
import { printExportHtml } from "@/features/export/utils/printExportHtml";
import { printExportStylesheet } from "@/features/export/utils/printExportStylesheet";

/*
 * BC-17.3.1 QA-1 — cross-surface cascade order. Every generated rule has
 * the same specificity, so ORDER decides between rules that reach the same
 * element under the same order key. Design/Preview order owners inside a
 * key by node id; Export prints in document order. These fixtures put
 * overlapping rules of DIFFERENT owners on one element — role groups,
 * structural chains and the element's own rules — with node ids chosen so
 * that id order and document order disagree, and require the winning
 * declaration to be the same on the Preview sheet and the exported page.
 */

const initialState = useEditorStore.getState();
afterEach(() => {
  useEditorStore.setState(initialState, true);
  for (const element of document.querySelectorAll("style[data-qa1]"))
    element.remove();
  document.body.innerHTML = "";
});

/** The last declaration of `property` among the rules of `sheet` matching `element` (equal specificity: last wins). */
function winning(
  element: Element,
  sheet: HTMLStyleElement,
  property: string,
): string {
  let value = "";
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      let matches = false;
      try {
        matches = element.matches(rule.selectorText);
      } catch {
        // The export base reset has engine-specific selectors (:-moz-focusring) jsdom cannot parse; none sets backgrounds.
      }
      if (matches) {
        const declared = rule.style.getPropertyValue(property);
        if (declared) value = declared;
      }
    }
  };
  visit(sheet.sheet?.cssRules ?? new CSSRuleList());
  return value;
}

function installSheet(css: string): HTMLStyleElement {
  const style = document.createElement("style");
  style.setAttribute("data-qa1", "");
  style.textContent = css;
  document.head.appendChild(style);
  return style;
}

/** Winning value of `property` for each node, on the Preview Canvas and on the exported page. */
/** The document with an HTML id on every element, so each one can be found on both surfaces (export gives a class only to elements that need one). */
function withHtmlIds(node: EditorElementNode): EditorElementNode {
  return {
    ...node,
    ...(node.tag === "page" ? {} : { htmlId: `qa-${node.id}` }),
    children: node.children?.map(withHtmlIds),
  };
}

function bothSurfaces(
  source: EditorElementNode,
  nodeIds: readonly string[],
  property: string,
) {
  const root = withHtmlIds(source);
  useEditorStore.setState({ editorMode: "preview", runtimeVisibility: {} });
  const canvas = render(
    <DocumentNodeRenderer
      node={root}
      parentId={null}
      parentLayoutMode="flow"
      parentFlowDisplay="block"
    />,
  );
  const previewSheet = installSheet(compileDocumentSheet(root, "preview"));
  const preview = Object.fromEntries(
    nodeIds.map((id) => [
      id,
      winning(
        canvas.container.querySelector(`[id="qa-${id}"]`)!,
        previewSheet,
        property,
      ),
    ]),
  );
  canvas.unmount();

  const built = buildExportDocument(root);
  if (!built.ok) throw new Error(JSON.stringify(built.diagnostics));
  const exportSheet = installSheet(printExportStylesheet(built.document));
  const host = document.createElement("div");
  host.innerHTML = printExportHtml(
    built.document,
    {
      title: "QA-1",
      lang: "en",
      stylesheet: { kind: "linked", href: "styles.css" },
    },
    [],
  ).replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/g, "");
  document.body.appendChild(host);
  const exported = Object.fromEntries(
    nodeIds.map((id) => {
      const element = host.querySelector(`[id="qa-${id}"]`);
      if (!element) throw new Error(`no exported element for ${id}`);
      return [id, winning(element, exportSheet, property)];
    }),
  );
  return { preview, exported };
}

const red = { background: { color: "#ff0000" } };
const blue = { background: { color: "#0000ff" } };

describe("cross-surface cascade order (BC-17.3.1 QA-1)", () => {
  it("a container's structural rule (group.first) and its first child's OWN base background: same winner on both surfaces — the element's own styling", () => {
    // Owner id "a-box" sorts BEFORE the child "z-para"; in document order the owner also comes first.
    const root: EditorElementNode = {
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "a-box",
          tag: "div",
          styleRules: [
            { id: "first", target: "group.first", condition: {}, groups: red },
          ],
          children: [
            { id: "z-para", tag: "p", text: "x", ...blue },
            { id: "m-para", tag: "p", text: "y" },
          ],
        },
      ],
    };
    const { preview, exported } = bothSurfaces(
      root,
      ["z-para", "m-para"],
      "background-color",
    );
    expect(preview).toEqual(exported);
    // The element's own declaration wins over the container's structural rule (role-group-tier contract).
    expect(preview["z-para"]).toBe("rgb(0, 0, 255)");
    expect(preview["m-para"]).toBe("");
  });

  it("the same with the ids reversed (owner sorts AFTER its child)", () => {
    const root: EditorElementNode = {
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "z-box",
          tag: "div",
          styleRules: [
            { id: "first", target: "group.first", condition: {}, groups: red },
          ],
          children: [{ id: "a-para", tag: "p", text: "x", ...blue }],
        },
      ],
    };
    const { preview, exported } = bothSurfaces(
      root,
      ["a-para"],
      "background-color",
    );
    expect(preview).toEqual(exported);
    expect(preview["a-para"]).toBe("rgb(0, 0, 255)");
  });

  it("a table's structural cell rule against a cell's own base background, and against an untouched cell", () => {
    const cell = (
      id: string,
      extra: Partial<EditorElementNode> = {},
    ): EditorElementNode => ({ id, tag: "td", text: id, ...extra });
    const root: EditorElementNode = {
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "m-table",
          tag: "table",
          styleRules: [
            { id: "cells", target: "table.cell", condition: {}, groups: red },
          ],
          children: [
            {
              id: "z-body",
              tag: "tbody",
              children: [
                {
                  id: "b-row",
                  tag: "tr",
                  children: [cell("a-cell", blue), cell("z-cell")],
                },
              ],
            },
          ],
        },
      ],
    };
    const { preview, exported } = bothSurfaces(
      root,
      ["a-cell", "z-cell"],
      "background-color",
    );
    expect(preview).toEqual(exported);
    expect(preview["a-cell"]).toBe("rgb(0, 0, 255)");
    expect(preview["z-cell"]).toBe("rgb(255, 0, 0)");
  });

  it("a Pagination role group, the root's own structural rule and a member's own base background on the same member", () => {
    const factory = createPaginationNode();
    const pages = getPaginationParts(factory).pages;
    const [firstPage] = pages;
    const withOwn = (node: EditorElementNode): EditorElementNode =>
      node.id === firstPage.id
        ? { ...node, ...blue }
        : { ...node, children: node.children?.map(withOwn) };
    const pagination: EditorElementNode = {
      ...withOwn(factory),
      styleRules: [
        { id: "pages", target: "pagination.page", condition: {}, groups: red },
        {
          id: "first",
          target: "list.first",
          condition: {},
          groups: { background: { color: "#00ff00" } },
        },
      ],
    };
    const root: EditorElementNode = {
      id: "page-root",
      tag: "page",
      children: [pagination],
    };
    const ids = pages.map((page) => page.id);
    const { preview, exported } = bothSurfaces(root, ids, "background-color");
    expect(preview).toEqual(exported);
    expect(preview[firstPage.id]).toBe("rgb(0, 0, 255)");
  });
});
